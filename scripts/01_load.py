"""Étape 1 : charger et nettoyer le découpage et les PDV ATOM.

Sorties (data/cache/) : secteurs.pkl, pdv.pkl, anomalies_01.csv
"""
from __future__ import annotations

import sys

import numpy as np
import openpyxl
import pandas as pd

from atom.commun import DATA_CACHE, chemin, cle_secteur, config, gps, haversine_m, norm, tel8

COLS_ANOMALIES = ["Type", "ID_PDV", "Nom_PDV", "Merchandiser", "Cle_secteur", "Detail"]


def anomalie(type_, id_pdv="", nom="", merch="", cle="", detail="") -> dict:
    return dict(zip(COLS_ANOMALIES, [type_, id_pdv, nom, merch, cle, detail]))


def charger_secteurs(cfg) -> pd.DataFrame:
    d = pd.read_csv(chemin(cfg["SOURCES"]["decoupage_definitif"]["fichier"]), dtype=str).fillna("")
    d = d.apply(lambda c: c.str.strip())
    d["Cle"] = [cle_secteur(t, z, s) for t, z, s in zip(d.Territoire, d.Zone, d.Secteur)]
    if d.Cle.duplicated().any():
        print("ARRÊT : clé de secteur en double :", d.Cle[d.Cle.duplicated()].tolist())
        sys.exit(1)
    d = d.rename(columns={"Commerciaux": "Commercial"})
    d["secteur_norm"] = d.Secteur.map(norm)
    return d[["Cle", "Territoire", "Zone", "Secteur", "Commercial", "SSF", "secteur_norm"]]


def charger_pdv(cfg, anomalies: list) -> pd.DataFrame:
    p = pd.read_csv(chemin(cfg["SOURCES"]["pdv_atom"]["fichier"]), dtype=str, keep_default_na=False)
    p = p.apply(lambda c: c.str.strip())
    n0 = len(p)

    # Lignes répétées à l'identique : signalées, une seule gardée (même ID, mêmes valeurs).
    rep = p.duplicated(keep="first")
    for _, r in p[rep].iterrows():
        anomalies.append(anomalie("ligne répétée", r.ID_PDV, r.Nom_PDV, r["Créé_par"],
                                  detail="ligne identique à une autre dans l'onglet PDV"))
    p = p[~rep].copy()
    # Même ID sur deux lignes qui diffèrent (souvent les compteurs de visite) : on garde
    # la ligne la plus visitée, l'autre est signalée.
    if p.ID_PDV.duplicated().any():
        p["_nv"] = pd.to_numeric(p.Nombre_Visites, errors="coerce").fillna(0)
        p = p.sort_values(["ID_PDV", "_nv"], ascending=[True, False])
        dup = p.ID_PDV.duplicated(keep="first")
        for _, r in p[dup].iterrows():
            gardee = p[(p.ID_PDV == r.ID_PDV) & ~dup].iloc[0]
            diff = [c for c in p.columns if not c.startswith("_") and r[c] != gardee[c]]
            anomalies.append(anomalie("ID en double", r.ID_PDV, r.Nom_PDV, r["Créé_par"],
                                      detail=f"deux lignes, colonnes différentes : {', '.join(diff)} ; la plus visitée est gardée"))
        print(f"  {dup.sum()} ID_PDV en double (valeurs différentes) : la ligne la plus visitée est gardée")
        p = p[~dup].drop(columns="_nv").sort_index()

    pos = [gps(a, b, cfg["BORNES_CI"]) for a, b in zip(p.GPS_Lat, p.GPS_Lng)]
    p["lat"] = [x[0] for x in pos]
    p["lng"] = [x[1] for x in pos]
    p["etat_gps"] = [x[2] for x in pos]
    for _, r in p[p.etat_gps.isin(["inversé", "hors CI", "illisible"])].iterrows():
        anomalies.append(anomalie(f"GPS {r.etat_gps}", r.ID_PDV, r.Nom_PDV, r["Créé_par"],
                                  detail=f"GPS_Lat={r.GPS_Lat} GPS_Lng={r.GPS_Lng}"))
    p["nom_norm"] = p.Nom_PDV.map(norm)
    p["tel8"] = p.Contact_Telephone.map(tel8)
    p["a_gps"] = p.lat.notna()
    print(f"  PDV : {n0} lignes, {rep.sum()} répétées à l'identique, {len(p)} gardées ; "
          f"GPS : {p.etat_gps.value_counts().to_dict()}")
    return p


def doublons(p: pd.DataFrame, dist_m: float, anomalies: list) -> None:
    g = p[p.a_gps & (p.nom_norm != "")]
    n = 0
    for nom, grp in g.groupby("nom_norm"):
        if len(grp) < 2:
            continue
        lat, lng = grp.lat.to_numpy(), grp.lng.to_numpy()
        d = haversine_m(lat[:, None], lng[:, None], lat[None, :], lng[None, :])
        ids = grp.ID_PDV.to_numpy()
        for i, j in zip(*np.where(np.triu(d <= dist_m, k=1))):
            n += 1
            anomalies.append(anomalie("doublon probable", ids[i], grp.Nom_PDV.iloc[i], grp["Créé_par"].iloc[i],
                                      detail=f"même nom que {ids[j]} à {d[i, j]:.0f} m (non supprimé)"))
    print(f"  doublons probables (même nom, < {dist_m} m) : {n} paires")


def controle_407(cfg, p: pd.DataFrame, anomalies: list) -> None:
    wb = openpyxl.load_workbook(chemin(cfg["SOURCES"]["rattachement_407"]["fichier"]), read_only=True)
    rows = list(wb["RATTACHEMENT_407_PDV"].iter_rows(values_only=True))
    h = list(rows[0])
    ids = {r[h.index("ID_PDV")] for r in rows[1:] if r[h.index("ID_PDV")]}
    sans = set(p.ID_PDV[~p.a_gps])
    en_trop, manquants = ids - sans, sans - ids
    for i in sorted(en_trop):
        anomalies.append(anomalie("407 : ID avec GPS", i, detail="présent dans le rattachement manuel mais le PDV a un GPS"))
    for i in sorted(manquants):
        anomalies.append(anomalie("407 : ID absent", i, detail="PDV sans GPS absent du rattachement manuel"))
    print(f"  rattachement manuel : {len(ids)} ID ; PDV sans GPS : {len(sans)} ; "
          f"écarts : {len(en_trop)} en trop, {len(manquants)} manquants")


def main() -> None:
    cfg = config()
    anomalies: list[dict] = []
    s = charger_secteurs(cfg)
    print(f"  découpage : {len(s)} secteurs, {s.Territoire.nunique()} territoires, "
          f"{s[['Territoire', 'Zone']].drop_duplicates().shape[0]} zones")
    p = charger_pdv(cfg, anomalies)
    doublons(p, cfg["DOUBLON_DISTANCE_M"], anomalies)
    controle_407(cfg, p, anomalies)
    for _, r in p[~p.a_gps].iterrows():
        anomalies.append(anomalie("PDV sans GPS", r.ID_PDV, r.Nom_PDV, r["Créé_par"],
                                  detail=f"GPS {r.etat_gps} ; voir rattachement_407_croise.csv"))
    DATA_CACHE.mkdir(parents=True, exist_ok=True)
    s.to_pickle(DATA_CACHE / "secteurs.pkl")
    p.to_pickle(DATA_CACHE / "pdv.pkl")
    pd.DataFrame(anomalies, columns=COLS_ANOMALIES).to_csv(DATA_CACHE / "anomalies_01.csv", index=False)
    print(f"  anomalies : {len(anomalies)}")


if __name__ == "__main__":
    main()
