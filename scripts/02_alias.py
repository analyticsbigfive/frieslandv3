"""Étape 2 : table d'alias des merchandisers (à faire valider par Jean Luc).

Le nom de référence est celui du routing mensuel. Un merchandiser sans routing garde
son nom ATOM (`Créé_par`). Sortie : data/ref/alias_merchandisers.csv
Si le fichier existe déjà, les colonnes `Merchandiser` et `Statut` saisies à la main
sont conservées (ligne par ligne, sur Nom_source).
"""
from __future__ import annotations

import pandas as pd
from rapidfuzz import fuzz

from atom.commun import DATA_REF, chemin, config, norm

# Correspondances données dans le brief (29/10) : routing ← ATOM.
ALIAS_BRIEF = {
    "deho wilfried": "Deheo Wilfried",
    "kouadio attofe anicet": "Kouadio Annicet",
    "seregone chadrac": "Seregone Chadrack",
    "bernadin guihi": "Guihi Bernadin",
    "stephane gui": "Gui Stéphane",
    "zogbolou kevin": "Zogbolou Kevin Stéphane",
}
# Rattachement possible mais non confirmé.
ALIAS_A_VALIDER = {
    "kouadio attofe guy": ("Kouadio Annicet", "même compte que Kouadio Attofé Anicet dans alias_import ; "
                                              "le brief met un « ? »"),
}


def noms_sources(cfg) -> pd.DataFrame:
    S = cfg["SOURCES"]
    lignes = []
    r = pd.read_csv(chemin(S["routing_mensuel"]["fichier"]), dtype=str).fillna("")
    for n, c in r.Merchandiser.str.strip().value_counts().items():
        lignes.append(("routing", n, c))
    p = pd.read_pickle(chemin("data/cache/pdv.pkl"))
    for n, c in p["Créé_par"].value_counts().items():
        lignes.append(("PDV Créé_par", n, c))
    h = pd.read_csv(chemin(S["historique_visites"]["fichier"]), dtype=str).fillna("")
    for n, c in h.Merchandiseur.str.strip().value_counts().items():
        lignes.append(("historique", n, c))
    br = pd.read_excel(chemin(S["atom_xlsx"]["fichier"]), sheet_name="Rapports_BR", dtype=str).fillna("")
    for n, c in br.Merchandiseur.str.strip().value_counts().items():
        lignes.append(("Rapports_BR", n, c))
    m = pd.read_excel(chemin(S["atom_xlsx"]["fichier"]), sheet_name="Merchandiseurs", dtype=str).fillna("")
    for n in m["Nom merchandiser"].str.strip():
        lignes.append(("onglet Merchandiseurs", n, 1))
    return pd.DataFrame(lignes, columns=["Source", "Nom_source", "Nb"])


def rattacher(nom: str, routing: list[str]) -> tuple[str, str, str]:
    """(merchandiser, statut, commentaire)"""
    n = norm(nom)
    for r in routing:
        if norm(r) == n or set(norm(r).split()) == set(n.split()):
            return r, "auto", "même nom"
    if n in ALIAS_BRIEF:
        return ALIAS_BRIEF[n], "brief", "correspondance donnée dans le brief du 29/10"
    if n in ALIAS_A_VALIDER:
        m, c = ALIAS_A_VALIDER[n]
        return m, "à valider", c
    meilleur = max(routing, key=lambda r: fuzz.token_sort_ratio(norm(r), n))
    score = fuzz.token_sort_ratio(norm(meilleur), n)
    if score >= 85:
        return meilleur, "à valider", f"orthographe proche ({score:.0f})"
    return nom, "sans routing", "aucun routing mensuel à ce nom"


def main() -> None:
    cfg = config()
    src = noms_sources(cfg)
    routing = src[src.Source == "routing"].Nom_source.tolist()
    t = (src.groupby("Nom_source")
         .apply(lambda g: "; ".join(f"{s} ({n})" for s, n in zip(g.Source, g.Nb)), include_groups=False)
         .rename("Vu_dans").reset_index())
    res = [rattacher(n, routing) for n in t.Nom_source]
    t["Merchandiser"] = [x[0] for x in res]
    t["Statut"] = [x[1] for x in res]
    t["Commentaire"] = [x[2] for x in res]
    t["A_un_routing"] = t.Merchandiser.isin(routing).map({True: "oui", False: "non"})

    dest = DATA_REF / "alias_merchandisers.csv"
    if dest.exists():  # garder les corrections manuelles
        ancien = pd.read_csv(dest, dtype=str).fillna("").set_index("Nom_source")
        cols = ["Merchandiser", "Statut", "A_un_routing", "Commentaire"]
        for i, r in t.iterrows():
            if r.Nom_source in ancien.index and ancien.loc[r.Nom_source, "Statut"] in ("validé", "corrigé", "retiré"):
                t.loc[i, cols] = ancien.loc[r.Nom_source, cols].values
    t = t.sort_values(["Merchandiser", "Nom_source"])
    DATA_REF.mkdir(parents=True, exist_ok=True)
    t[["Nom_source", "Merchandiser", "Statut", "A_un_routing", "Vu_dans", "Commentaire"]].to_csv(dest, index=False)
    print(t[["Nom_source", "Merchandiser", "Statut"]].to_string(index=False))


def retires() -> set[str]:
    """Merchandisers retirés (29/10) : leurs PDV vont à celui qui couvre leur secteur."""
    t = pd.read_csv(DATA_REF / "alias_merchandisers.csv", dtype=str).fillna("")
    return set(t[t.Statut == "retiré"].Merchandiser)


def table_alias() -> dict[str, str]:
    """norm(nom source) → merchandiser (nom du routing, ou nom ATOM sans routing)."""
    t = pd.read_csv(DATA_REF / "alias_merchandisers.csv", dtype=str).fillna("")
    return {norm(a): b for a, b in zip(t.Nom_source, t.Merchandiser)}


if __name__ == "__main__":
    main()
