"""Étape 5 (1.3) : affecter chaque PDV à un secteur (point dans polygone).

PDV pris en compte : ceux qui ont un GPS, et ceux dont le GPS a été récupéré par les visites
(confiance haute ou moyenne, Methode = GPS visite). Les colonnes Zone / Commune / Quartier /
Localisation d'ATOM ne servent qu'au contrôle (confiance et alertes).

Sortie : data/cache/affectation.pkl, data/cache/anomalies_05.csv
"""
from __future__ import annotations

import importlib

import geopandas as gpd
import numpy as np
import pandas as pd

from atom.commun import DATA_CACHE, DATA_OUT, DATA_REF, config, haversine_m, norm
from atom.planif import couverture_pdv, distributeurs_merch, distributeurs_pdv, proprietaires

alias = importlib.import_module("02_alias")
sect = importlib.import_module("04_secteurs")
routing = importlib.import_module("10_routing_existant")
COLS_ANOMALIES = sect.COLS_ANOMALIES


def main() -> None:
    cfg = config()
    ali = alias.table_alias()
    # Caches écrits par les étapes 01 à 04 du pipeline (fichiers locaux, pas une source externe).
    p = pd.read_pickle(DATA_CACHE / "pdv.pkl")
    unites = pd.read_pickle(DATA_CACHE / "unites.pkl")
    anc = pd.read_pickle(DATA_CACHE / "ancrages.pkl").set_index("Cle")
    poly = gpd.read_file(DATA_OUT / "secteurs.geojson")
    rec = pd.read_csv(DATA_OUT / "gps_recuperes.csv", dtype={"ID_PDV": str})
    rec = rec[rec.Confiance.isin(["haute", "moyenne"])].set_index("ID_PDV")

    p["Merchandiser"] = p["Créé_par"].map(lambda n: ali.get(norm(n), n))
    p["Methode"] = np.where(p.a_gps, "GPS PDV", "")
    p["Confiance_gps_visite"] = ""
    for i in p.index[~p.a_gps & p.ID_PDV.isin(rec.index)]:
        r = rec.loc[p.at[i, "ID_PDV"]]
        p.loc[i, ["lat", "lng", "Methode", "Confiance_gps_visite"]] = [r.GPS_Lat, r.GPS_Lng, "GPS visite", r.Confiance]
    a = p[p.lat.notna()].copy()
    g = gpd.GeoDataFrame(a, geometry=gpd.points_from_xy(a.lng, a.lat), crs="EPSG:4326")

    # Unité administrative la plus précise, puis secteur (cellule de Voronoï de cette unité).
    ju = gpd.sjoin(g[["ID_PDV", "geometry"]], unites[["Unite", "Niveau", "geometry"]], predicate="within")
    ju = ju.sort_values("Niveau", ascending=False).drop_duplicates("ID_PDV").set_index("ID_PDV").Unite
    g["Unite"] = g.ID_PDV.map(ju)
    js = gpd.sjoin(g[["ID_PDV", "Unite", "geometry"]], poly[["Cle", "Unite", "geometry"]].rename(
        columns={"Unite": "Unite_secteur"}), predicate="within")
    js = js[js.Unite == js.Unite_secteur].drop_duplicates("ID_PDV").set_index("ID_PDV").Cle
    g["Cle"] = g.ID_PDV.map(js)
    # Bord de polygone (précision des limites) : ancrage le plus proche de la même unité.
    anc_u = anc[anc.lat.notna()].reset_index()
    for i in g.index[g.Cle.isna() & g.Unite.notna()]:
        cands = anc_u[anc_u.Unite == g.at[i, "Unite"]]
        if len(cands):
            d = haversine_m(g.at[i, "lat"], g.at[i, "lng"], cands.lat.to_numpy(), cands.lng.to_numpy())
            g.at[i, "Cle"] = cands.Cle.iloc[int(np.argmin(d))]

    anomalies = []
    terr_par_unite = pd.read_csv(sect.DATA_REF / "territoire_communes.csv").groupby("Unite_OSM").Territoire.apply(set)
    jet = {c: sect.jetons(s) for c, s in zip(anc.index, anc.Secteur)}
    conf, alerte, dist = [], [], []
    for r in g.itertuples():
        al = []
        if r.Methode == "GPS visite":
            al.append(f"GPS récupéré des visites ({r.Confiance_gps_visite})")
        if not isinstance(r.Cle, str):
            conf.append("")
            dist.append(None)
            al.append("hors de tout polygone")
            alerte.append(" ; ".join(al))
            anomalies.append(dict(zip(COLS_ANOMALIES, [
                "hors de tout polygone", r.ID_PDV, r.Nom_PDV, r.Merchandiser, "",
                f"{r.lat:.6f},{r.lng:.6f} ; unité : {r.Unite if isinstance(r.Unite, str) else 'aucune unité du découpage'}"])))
            continue
        ar = anc.loc[r.Cle]
        d = float(haversine_m(r.lat, r.lng, ar.lat, ar.lng))
        dist.append(round(d))
        # Contrôle par le quartier ATOM (indice seulement)
        cands = [(c, jet[c]) for c in anc.index
                 if anc.at[c, "Territoire"] in terr_par_unite.get(r.Unite, set())]
        vus = {m for t in (r.Quartier, r.Localisation) for m in sect.correspondances(t, cands)}
        if d > cfg["CONFIANCE_BASSE_DISTANCE_M"] or ar.Methode_ancrage == "géocodage Nominatim":
            c = "basse"
            al.append("loin de l'ancrage" if d > cfg["CONFIANCE_BASSE_DISTANCE_M"] else "ancrage géocodé")
        elif r.Cle in vus:
            c = "haute"
        else:
            c = "moyenne"
        autres = vus - {r.Cle}
        if autres and r.Cle not in vus:
            al.append("quartier ATOM = " + " / ".join(sorted(x.split("|")[2] for x in autres)))
            anomalies.append(dict(zip(COLS_ANOMALIES, [
                "quartier ATOM incohérent", r.ID_PDV, r.Nom_PDV, r.Merchandiser, r.Cle,
                f"Quartier « {r.Quartier} » / Localisation « {r.Localisation} » désigne {', '.join(sorted(autres))}"])))
        conf.append(c)
        alerte.append(" ; ".join(al))
    g["Confiance"] = conf
    g["Alerte"] = alerte
    g["Distance_ancrage_m"] = dist
    s = anc[["Territoire", "Zone", "Secteur", "Commercial"]]
    g = g.rename(columns={"Zone": "Zone_ATOM", "Commune": "Commune_ATOM"}).join(s, on="Cle")

    # Merchandisers retirés (29/10) : leurs PDV vont au merchandiser qui couvre le secteur,
    # avec la règle stricte du distributeur (29/10) : jamais un merchandiser d'un autre distributeur.
    retires = alias.retires()
    g["Cree_par"] = g.Merchandiser
    g["Attribution"] = "créateur du PDV"
    g["Distributeur"] = g.ID_PDV.map(distributeurs_pdv(pd.read_pickle(DATA_CACHE / "visites.pkl"))).fillna("")
    man = pd.read_csv(DATA_REF / "couverture_manuelle.csv", dtype=str).fillna("")
    points = routing.calculer()
    prop = proprietaires(points, pd.read_pickle(DATA_CACHE / "secteurs.pkl"), man, g).set_index("Cle")
    md = distributeurs_merch()
    idx = g.index[g.Merchandiser.isin(retires)]
    res = couverture_pdv(g.loc[idx], points, prop, md, man)
    for i in idx:
        m, regle = res.at[i, "couvert_par"], res.at[i, "raison"]
        g.at[i, "Merchandiser"] = m
        g.at[i, "Attribution"] = f"reprise ({g.at[i, 'Cree_par']} retiré) : {regle}"
        if not m:
            anomalies.append(dict(zip(COLS_ANOMALIES, ["PDV sans merchandiser", g.at[i, "ID_PDV"], g.at[i, "Nom_PDV"],
                                                       g.at[i, "Cree_par"], g.at[i, "Cle"] or "", regle])))
    rep = g[g.Cree_par.isin(retires)]
    print("  PDV des merchandisers retirés :", len(rep), "→",
          rep.Merchandiser.replace("", "personne").value_counts().to_dict())
    print("  règle :", rep.Attribution.str.split(" : ").str[1].value_counts().to_dict())
    out = pd.DataFrame(g.drop(columns="geometry"))
    out.to_pickle(DATA_CACHE / "affectation.pkl")
    pd.DataFrame(anomalies, columns=COLS_ANOMALIES).to_csv(DATA_CACHE / "anomalies_05.csv", index=False)
    print(f"  PDV positionnés : {len(out)} (dont GPS visite : {(out.Methode == 'GPS visite').sum()})")
    print(f"  affectés : {out.Cle.notna().sum()} ; hors polygone : {out.Cle.isna().sum()}")
    print("  confiance :", out.Confiance.replace("", "—").value_counts().to_dict())


if __name__ == "__main__":
    main()
