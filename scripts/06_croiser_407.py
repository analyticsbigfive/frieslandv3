"""Étape 6 (1.1 ter) : croiser le rattachement manuel des 407 PDV avec le GPS récupéré.

Le fichier manuel n'est jamais modifié : le résultat va dans de nouveaux fichiers.
Le « Territoire déclaré (agence) » n'est pas utilisé.

Sorties (data/out/) : rattachement_407_croise.csv, pdv_a_localiser_par_merchandiser.csv,
pdv_secteurs.csv, anomalies.csv
"""
from __future__ import annotations

import importlib

import pandas as pd

from atom.commun import DATA_CACHE, DATA_OUT, chemin, cle_secteur, config, lien_maps, norm
from atom.couverture import Couverture
from atom.planif import couverture_pdv, distributeurs_merch, distributeurs_pdv, proprietaires
from atom.croisement import famille, routable, statut_final

alias = importlib.import_module("02_alias")

COLS_ANOMALIES = ["Type", "ID_PDV", "Nom_PDV", "Merchandiser", "Cle_secteur", "Detail"]


def main() -> None:
    cfg = config()
    admis = cfg["ROUTER_STATUTS"]
    m = pd.read_excel(chemin(cfg["SOURCES"]["rattachement_407"]["fichier"]), sheet_name="RATTACHEMENT_407_PDV",
                      dtype=str).fillna("")
    # Caches écrits par les étapes 01 à 05 du pipeline (fichiers locaux).
    sect = pd.read_pickle(DATA_CACHE / "secteurs.pkl").set_index("Cle")
    aff = pd.read_pickle(DATA_CACHE / "affectation.pkl").set_index("ID_PDV")
    pdv = pd.read_pickle(DATA_CACHE / "pdv.pkl").set_index("ID_PDV")
    ali = alias.table_alias()
    retires = alias.retires()
    t = pd.read_csv(chemin("data/ref/alias_merchandisers.csv"), dtype=str).fillna("")
    cv = Couverture(pd.read_pickle(DATA_CACHE / "points_secteurs.pkl"), aff.reset_index(),
                    set(t[t.A_un_routing == "oui"].Merchandiser),
                    pd.read_csv(chemin("data/ref/couverture_manuelle.csv"), dtype=str).fillna(""))

    md = distributeurs_merch()
    dist = distributeurs_pdv(pd.read_pickle(DATA_CACHE / "visites.pkl"))
    points = pd.read_pickle(DATA_CACHE / "points_secteurs.pkl")
    man = pd.read_csv(chemin("data/ref/couverture_manuelle.csv"), dtype=str).fillna("")
    prop = proprietaires(points, sect.reset_index(), man, aff.reset_index()).set_index("Cle")

    def merch(id_, cle=None, territoire=None):
        """(merchandiser attribué, créateur, règle) ; règle stricte du distributeur."""
        cree = ali.get(norm(pdv.at[id_, "Créé_par"]), pdv.at[id_, "Créé_par"])
        if cree not in retires:
            return cree, cree, "créateur du PDV"
        if cle:
            r = couverture_pdv(pd.DataFrame({"Cle": [cle], "Distributeur": [dist.get(id_, "")]}), points, prop,
                               md, man).iloc[0]
            m, regle = r.couvert_par, r.raison
        else:
            m, regle = cv.choisir(None, territoire or None)
        return m, cree, f"reprise ({cree} retiré) : {regle}"

    anomalies = []

    lignes = []
    for r in m.itertuples(index=False):
        t, z, s = r[m.columns.get_loc("TERRITOIRE FRIESLAND")], r[m.columns.get_loc("ZONE FRIESLAND")], \
            r[m.columns.get_loc("SECTEUR FRIESLAND")]
        id_ = r.ID_PDV
        cle_m = None
        if t and z and s:
            cle_m = cle_secteur(t, z, s)
            if cle_m not in sect.index:
                anomalies.append(dict(zip(COLS_ANOMALIES, ["secteur manuel inconnu", id_, r[2], "", cle_m,
                                                           "absent du découpage définitif"])))
                cle_m = None
        terr_m = t if t in set(sect.Territoire) else None
        cle_g = conf_g = terr_g = None
        if id_ in aff.index and aff.at[id_, "Methode"] == "GPS visite":
            cle_g = aff.at[id_, "Cle"] if isinstance(aff.at[id_, "Cle"], str) else None
            conf_g = aff.at[id_, "Confiance_gps_visite"]
            terr_g = aff.at[id_, "Territoire"] if cle_g else None
        statut, cle, note = statut_final(r[m.columns.get_loc("STATUT DU RATTACHEMENT")], cle_m, terr_m,
                                         cle_g, terr_g, conf_g)
        lignes.append({"Secteur GPS": cle_g or "", "Confiance GPS": conf_g or "", "Statut final": statut,
                       "Routable": "oui" if routable(statut, admis) else "non", "Cle retenue": cle,
                       "Note du croisement": note})
    x = pd.concat([m, pd.DataFrame(lignes)], axis=1)
    DATA_OUT.mkdir(parents=True, exist_ok=True)
    x.drop(columns=["Cle retenue"]).to_csv(DATA_OUT / "rattachement_407_croise.csv", index=False)

    # PDV hors routing : à relever par le merchandiser pendant ses tournées.
    al = x[x.Routable == "non"].copy()
    att = [merch(i, c, t_) for i, c, t_ in zip(al.ID_PDV, al["Cle retenue"], al["TERRITOIRE FRIESLAND"])]
    al["Merchandiser"] = [a[0] for a in att]
    al["Créé par"] = [a[1] for a in att]
    al["Attribution"] = [a[2] for a in att]
    al["Repère (Localisation ATOM)"] = [pdv.at[i, "Localisation"] for i in al.ID_PDV]
    al["Téléphone"] = [pdv.at[i, "Contact_Telephone"] for i in al.ID_PDV]
    al["Lien GPS de visite"] = [lien_maps(float(a), float(b)) if a and b else ""
                                for a, b in zip(al["GPS visite — piste latitude"], al["GPS visite — piste longitude"])]
    loc = al.rename(columns={"TERRITOIRE FRIESLAND": "Territoire proposé", "ZONE FRIESLAND": "Zone proposée",
                             "SECTEUR FRIESLAND": "Secteur proposé", "Quartier/adresse déclaré": "Adresse",
                             "Lien Google Maps de recherche": "Lien Google Maps"})
    loc = loc[["Merchandiser", "Créé par", "Attribution", "Territoire proposé", "Zone proposée", "Secteur proposé", "ID_PDV", "Nom du PDV",
               "Type", "Adresse", "Repère (Localisation ATOM)", "Téléphone", "Lien Google Maps",
               "Lien GPS de visite", "Statut final", "Note du croisement"]]
    loc = loc.sort_values(["Merchandiser", "Territoire proposé", "Zone proposée", "Secteur proposé", "Nom du PDV"])
    loc.to_csv(DATA_OUT / "pdv_a_localiser_par_merchandiser.csv", index=False)

    # pdv_secteurs.csv : PDV positionnés + 407 rattachés à la main.
    a = aff.reset_index()
    a["GPS_Lat"] = a.lat.round(6)
    a["GPS_Lng"] = a.lng.round(6)
    a["Statut_407"] = ""
    a["Routable"] = "oui"
    st = x.set_index("ID_PDV")
    for i in a.index[a.ID_PDV.isin(st.index)]:
        r = st.loc[a.at[i, "ID_PDV"]]
        a.loc[i, ["Statut_407", "Routable"]] = [r["Statut final"], r.Routable]
        if r.Routable == "non":
            a.at[i, "Alerte"] = (a.at[i, "Alerte"] + " ; " if a.at[i, "Alerte"] else "") + f"hors routing ({r['Statut final']})"
    a.loc[a.Cle.isna(), "Routable"] = "non"
    manuels = []
    for _, r in x[~x.ID_PDV.isin(a.ID_PDV)].iterrows():
        id_, cle, statut, rout = r.ID_PDV, r["Cle retenue"], r["Statut final"], r.Routable
        t, z, s = cle.split("|") if cle else ("", "", "")
        manuels.append({"ID_PDV": id_, "Nom_PDV": pdv.at[id_, "Nom_PDV"], "Type_PDV": pdv.at[id_, "Type_PDV"],
                        "GPS_Lat": None, "GPS_Lng": None, "Territoire": t, "Zone": z, "Secteur": s,
                        "Commercial": sect.at[cle, "Commercial"] if cle else "",
                        "Merchandiser": merch(id_, cle, r["TERRITOIRE FRIESLAND"])[0],
                        "Cree_par": merch(id_, cle, r["TERRITOIRE FRIESLAND"])[1],
                        "Attribution": merch(id_, cle, r["TERRITOIRE FRIESLAND"])[2],
                        "Methode": "rattachement manuel" if cle else "", "Confiance": "",
                        "Alerte": ("position à valider à la visite" if rout == "oui" else f"hors routing ({statut})"),
                        "Statut_407": statut, "Routable": rout, "Cle": cle or None})
    cols = ["ID_PDV", "Nom_PDV", "Type_PDV", "GPS_Lat", "GPS_Lng", "Territoire", "Zone", "Secteur", "Commercial",
            "Merchandiser", "Methode", "Confiance", "Alerte", "Statut_407", "Routable", "Cree_par", "Attribution",
            "Distributeur", "Cle", "Distance_ancrage_m"]
    ps = pd.concat([a, pd.DataFrame(manuels)], ignore_index=True)
    ps["Distributeur"] = ps.ID_PDV.map(dist).fillna("")
    for c in cols:
        if c not in ps.columns:
            ps[c] = None
    ps[cols].sort_values(["Territoire", "Zone", "Secteur", "Nom_PDV"]).to_csv(DATA_OUT / "pdv_secteurs.csv",
                                                                             index=False)
    ps[cols].to_pickle(DATA_CACHE / "pdv_secteurs.pkl")

    # Anomalies de toutes les étapes
    for _, r in x[x["Statut final"].isin(["conflit", "proposé par GPS seul"])].iterrows():
        anomalies.append(dict(zip(COLS_ANOMALIES, [f"407 : {r['Statut final']}", r.ID_PDV, r["Nom du PDV"],
                                                   merch(r.ID_PDV, r["Cle retenue"], r["TERRITOIRE FRIESLAND"])[0],
                                                   r["Cle retenue"], r["Note du croisement"]])))
    pd.DataFrame(anomalies, columns=COLS_ANOMALIES).to_csv(DATA_CACHE / "anomalies_06.csv", index=False)
    toutes = pd.concat([pd.read_csv(DATA_CACHE / f"anomalies_{n}.csv", dtype=str)
                        for n in ("01", "03", "04", "05", "06", "10") if (DATA_CACHE / f"anomalies_{n}.csv").exists()])
    secteurs_vides = set(sect.index) - set(ps.Cle.dropna())
    vides = pd.DataFrame([dict(zip(COLS_ANOMALIES, ["secteur sans PDV", "", "", "", c, ""]))
                          for c in sorted(secteurs_vides)])
    toutes = pd.concat([toutes, vides]).fillna("")
    toutes.sort_values(["Type", "Cle_secteur", "Merchandiser", "Nom_PDV"]).to_csv(DATA_OUT / "anomalies.csv",
                                                                                 index=False)

    print("  407 : familles :", x["STATUT DU RATTACHEMENT"].map(famille).value_counts().to_dict())
    print(x.groupby(["Statut final", "Routable"]).size().to_string())
    print(f"  à localiser (hors routing) : {len(loc)} PDV, par merchandiser :",
          loc.Merchandiser.value_counts().to_dict())
    print(f"  pdv_secteurs : {len(ps)} lignes, routables : {(ps.Routable == 'oui').sum()} ; "
          f"secteurs sans PDV : {len(secteurs_vides)} ; anomalies : {len(toutes)}")


if __name__ == "__main__":
    main()
