"""Étape 11 (2.3) : quota, rythme réel et capacité de chaque merchandiser.

Quota retenu le 29/10 : règle Atom actuelle (config.yaml, QUOTAS_JOUR), 420 PDV par mois.
Sorties : data/out/capacite.csv, data/out/secteurs_merchandisers.csv, data/cache/proprietaires.pkl
"""
from __future__ import annotations

import importlib

import pandas as pd

from atom.commun import DATA_CACHE, DATA_OUT, DATA_REF, chemin, config, norm
from atom.planif import CLES_JOUR, couverture_pdv, distributeurs_merch, proprietaires

alias = importlib.import_module("02_alias")


def main() -> None:
    cfg = config()
    ali = alias.table_alias()
    # Caches écrits par les étapes précédentes du pipeline (fichiers locaux).
    points = pd.read_pickle(DATA_CACHE / "points_secteurs.pkl")
    sect = pd.read_pickle(DATA_CACHE / "secteurs.pkl")
    ps = pd.read_pickle(DATA_CACHE / "pdv_secteurs.pkl")
    man = pd.read_csv(DATA_REF / "couverture_manuelle.csv", dtype=str).fillna("")
    prop = proprietaires(points, sect, man, ps)
    prop.to_pickle(DATA_CACHE / "proprietaires.pkl")

    elig = ps[(ps.Routable == "oui") & ps.Cle.notna() & (ps.Cle.astype(str) != "")]
    nb = elig.groupby("Cle").size()
    prop["PDV éligibles"] = prop.Cle.map(nb).fillna(0).astype(int)
    prop.to_csv(DATA_OUT / "secteurs_merchandisers.csv", index=False)

    q = cfg["QUOTAS_JOUR"]
    par_semaine = sum(sum(q[j].values()) for j in CLES_JOUR)
    capacite = par_semaine * cfg["SEMAINES_MOIS"]

    # Rythme réel : visites par merchandiser et par jour travaillé (historique 06–09/2026).
    h = pd.read_csv(chemin(cfg["SOURCES"]["historique_visites"]["fichier"]), dtype=str).fillna("")
    h["Merchandiser"] = h.Merchandiseur.str.strip().map(lambda n: ali.get(norm(n), n))
    jour = h.groupby(["Merchandiser", "Date"]).size()
    rythme = jour.groupby("Merchandiser").describe(percentiles=[.25, .5, .75])

    # Règle stricte du distributeur (29/10)
    md = distributeurs_merch()
    cv = couverture_pdv(elig, points, prop.set_index("Cle"), md, man)
    elig = elig.assign(Couvert_par=cv.couvert_par, Raison=cv.raison)
    elig[["ID_PDV", "Nom_PDV", "Territoire", "Zone", "Secteur", "Distributeur", "Couvert_par", "Raison"]].to_csv(
        DATA_OUT / "pdv_couverture.csv", index=False)
    routing = sorted(points.Merchandiser.unique())
    lignes = []
    for m in routing:
        a = elig[elig.Couvert_par == m]
        r = rythme.loc[m] if m in rythme.index else None
        lignes.append({
            "Merchandiser": m, "Distributeur": md.get(m, ""), "PDV à couvrir": len(a), "dont créés par lui": int((a.Cree_par == m).sum()),
            "PDV créés (tous territoires)": int((ps.Cree_par == m).sum()),
            "Capacité / mois": capacite, "Ratio": round(len(a) / capacite, 2),
            "Jours travaillés (historique)": int(r["count"]) if r is not None else 0,
            "Visites / jour : Q1": r["25%"] if r is not None else None,
            "médiane": r["50%"] if r is not None else None, "Q3": r["75%"] if r is not None else None})
    cap = pd.DataFrame(lignes).sort_values("Ratio", ascending=False)
    cap.to_csv(DATA_OUT / "capacite.csv", index=False)
    toutes = jour.describe(percentiles=[.25, .5, .75])
    print(f"  capacité : {par_semaine} PDV / semaine, {capacite} / mois")
    print(f"  rythme réel, toutes journées : Q1 {toutes['25%']:.0f}, médiane {toutes['50%']:.0f}, Q3 {toutes['75%']:.0f}")
    print(cap.to_string(index=False))
    sans = elig[elig.Couvert_par == ""]
    print(f"  PDV éligibles sans merchandiser : {len(sans)}")
    print(sans.groupby(["Raison"]).size().sort_values(ascending=False).to_string())
    print("  par territoire :", sans.Territoire.value_counts().to_dict())
    part = prop[prop.Alerte != ""].groupby(["Territoire", "Zone"]).Alerte.first()
    print("  zones partagées ou à égalité :", part.to_dict())


if __name__ == "__main__":
    main()
