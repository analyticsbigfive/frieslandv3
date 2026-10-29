"""Étape 10 (2.1) : relier chaque point de visite du routing actuel aux secteurs Friesland.

- Par le nom : les mots du secteur se retrouvent dans le point de visite, ou orthographe proche
  (« Lubafrik » → LUBAFRIQUE, « Bramakoté » → BROMAKOTÉ, « Cité Rane » → CITÉ RAN).
- Par la position du point (docs/suivi/2026-10-17-points-gps-osm.csv) : secteur qui la contient.
La colonne Zone du routing n'est pas utilisée (libellés faux : Zogbolou noté « Yopougon 1 & 2 »).

Aussi utilisé en phase 1 (05) pour savoir quel merchandiser couvre chaque secteur.

Sorties : data/out/points_de_visite_secteurs.csv, data/cache/points_secteurs.pkl, data/cache/anomalies_10.csv
"""
from __future__ import annotations

import importlib
import re

import geopandas as gpd
import pandas as pd
from rapidfuzz import fuzz
from shapely.geometry import Point

from atom.commun import DATA_CACHE, DATA_OUT, RACINE, chemin, config, gps_texte, norm

alias = importlib.import_module("02_alias")
sect = importlib.import_module("04_secteurs")
COLS_ANOMALIES = sect.COLS_ANOMALIES
JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]


def morceaux(point: str) -> list[str]:
    """« Koweït 2 et Agbayaté 1 » → ['Koweït 2', 'Agbayaté 1'] ; « Batim (1-2-3) » → ['Batim']."""
    p = re.sub(r"\((?:[\d\s\-,et]+|à confirmer)\)", " ", point, flags=re.I)
    return [x.strip() for x in re.split(r"\s+et\s+|&|,|/", p) if x.strip()]


def candidats_nom(point: str, secteurs: pd.DataFrame) -> set[str]:
    """Secteurs nommés dans le point de visite ; si le point porte le nom d'une zone, tous ses secteurs."""
    trouves = set()
    for m in morceaux(point):
        tm = sect.jetons(m)
        zones = {z for z in secteurs.Zone.unique() if sect.jetons(z) == tm}
        if zones:
            trouves |= set(secteurs[secteurs.Zone.isin(zones)].Cle)
            continue
        tm = sect.jetons(m)
        sans_num = [t for t in tm if not t.isdigit()]
        for c, js in zip(secteurs.Cle, secteurs.jetons):
            js_sans = [t for t in js if not t.isdigit()]
            if (sect.nom_contient(js, tm) or (sans_num and sect.nom_contient(sans_num, js))
                    or (js_sans and sans_num and fuzz.ratio(" ".join(js_sans), " ".join(sans_num)) >= 86)):
                trouves.add(c)
    return trouves


def calculer() -> pd.DataFrame:
    """Points de visite → secteurs ; écrit les sorties et renvoie le tableau."""
    cfg = config()
    ali = alias.table_alias()
    r = pd.read_csv(chemin(cfg["SOURCES"]["routing_mensuel"]["fichier"]), dtype=str).fillna("")
    r["Merchandiser"] = r.Merchandiser.str.strip().map(lambda n: ali.get(norm(n), n))
    r["Occurrence"] = r.Occurrence.map(lambda x: str(int(float(x))) if x else "")
    s = pd.read_pickle(DATA_CACHE / "secteurs.pkl")  # cache local du pipeline
    s["jetons"] = s.Secteur.map(sect.jetons)
    poly = gpd.read_file(DATA_OUT / "secteurs.geojson")

    # Position des points de visite (relevé du 17/10)
    g = pd.read_csv(RACINE / "docs" / "suivi" / "2026-10-17-points-gps-osm.csv", sep=";", dtype=str).fillna("")
    routing_noms = sorted(r.Merchandiser.unique())
    def merch_routing(n):
        return max(routing_noms, key=lambda x: fuzz.token_sort_ratio(norm(x), norm(n)))
    g["Merchandiser"] = g.Merchandiser.map(merch_routing)
    g["Occurrence"] = g.Semaine.str.replace("S", "", regex=False)
    par_nom = {(m, norm(p)): (gps_texte(x)[:2], st) for m, p, x, st in
               zip(g.Merchandiser, g["Point de visite"], g["Point GPS utilisé"], g.Statut)}
    par_jour = {(m, j, o): (norm(p), gps_texte(x)[:2], st) for m, j, o, p, x, st in
                zip(g.Merchandiser, g.Jour, g.Occurrence, g["Point de visite"], g["Point GPS utilisé"], g.Statut)}

    # Un nom de point présent une seule fois dans le relevé suffit (le relevé du 17/10 a les points
    # de Seregone et de Yao inversés par rapport au routing actuel).
    compte = g["Point de visite"].map(norm).value_counts()
    par_nom_seul = {norm(p): (gps_texte(x)[:2], st) for p, x, st in
                    zip(g["Point de visite"], g["Point GPS utilisé"], g.Statut) if compte[norm(p)] == 1}

    def position(x):
        """Position du point : même merchandiser et même nom ; sinon nom unique dans le relevé ;
        sinon même jour et semaine si le nom est proche."""
        if (x.Merchandiser, norm(x._7)) in par_nom:
            return par_nom[(x.Merchandiser, norm(x._7))]
        if norm(x._7) in par_nom_seul:
            return par_nom_seul[norm(x._7)]
        n, p, st = par_jour.get((x.Merchandiser, x.Jour, x.Occurrence), ("", (None, None), ""))
        if n and fuzz.token_set_ratio(n, norm(x._7)) >= 80:
            return p, st
        return (None, None), ""

    def secteur_de(lat, lng):
        if lat is None:
            return None
        dedans = poly[poly.contains(Point(lng, lat))]
        return dedans.Cle.iloc[0] if len(dedans) else None

    # Territoires « de base » de chaque merchandiser : ceux de ses points situés par GPS.
    base = {}
    for x in r.itertuples():
        (lat, lng), _ = position(x)
        c = secteur_de(lat, lng)
        if c:
            base.setdefault(x.Merchandiser, set()).add(c.split("|")[0])

    anomalies, lignes = [], []
    for x in r.itertuples():
        (lat, lng), statut_gps = position(x)
        cle_gps = secteur_de(lat, lng)
        noms = candidats_nom(x._7, s)
        if x.Merchandiser in base:  # le nom seul ne sort pas des territoires du merchandiser
            noms = {c for c in noms if c.split("|")[0] in base[x.Merchandiser]}
        zone_gps = cle_gps.rsplit("|", 1)[0] if cle_gps else None
        terr_gps = cle_gps.split("|")[0] if cle_gps else None
        methode, retenus = "", set()
        if noms and terr_gps:
            meme_zone = {c for c in noms if c.rsplit("|", 1)[0] == zone_gps}
            meme_terr = {c for c in noms if c.split("|")[0] == terr_gps}
            retenus = meme_zone or meme_terr
            methode = "nom + position" if retenus else ""
        if not retenus and noms and len({c.split("|")[0] for c in noms}) == 1:
            retenus, methode = noms, "nom"
        if not retenus and cle_gps:
            retenus, methode = {cle_gps}, "position du point"
        alerte = ""
        if not retenus:
            alerte = ("noms possibles dans plusieurs territoires : " + ", ".join(sorted(noms))) if noms \
                else "point de visite non reconnu"
            anomalies.append(dict(zip(COLS_ANOMALIES, ["point de visite non reconnu", "", x._7, x.Merchandiser, "",
                                                       f"{x.Jour} S{x.Occurrence} : {alerte}"])))
        elif statut_gps.startswith("À confirmer") and methode == "position du point":
            alerte = f"position du point {statut_gps.lower()}"
        lignes.append({"Merchandiser": x.Merchandiser, "Jour": x.Jour, "Occurrence": x.Occurrence,
                       "Point de visite": x._7, "Distributeur": x.Distributeur, "Sales rep": x._4,
                       "SSF": x.SSF, "Type SSF": x._9, "Zone (routing)": x.Zone,
                       "Secteurs": " ; ".join(sorted(retenus)), "Zones Friesland": " ; ".join(
                           sorted({c.rsplit("|", 1)[0] for c in retenus})), "Methode": methode,
                       "Secteur de la position": cle_gps or "", "Alerte": alerte})
    out = pd.DataFrame(lignes)
    out["ordre_jour"] = out.Jour.map(JOURS.index)
    out = out.sort_values(["Merchandiser", "ordre_jour", "Occurrence"]).drop(columns="ordre_jour")
    out.to_csv(DATA_OUT / "points_de_visite_secteurs.csv", index=False)
    out.to_pickle(DATA_CACHE / "points_secteurs.pkl")
    pd.DataFrame(anomalies, columns=COLS_ANOMALIES).to_csv(DATA_CACHE / "anomalies_10.csv", index=False)
    return out


def main() -> None:
    out = calculer()
    print("  points de visite :", len(out), "; méthode :", out.Methode.replace("", "—").value_counts().to_dict())
    zones = out.assign(z=out["Zones Friesland"].str.split(" ; ")).explode("z")
    zones = zones[zones.z.astype(bool)]
    print(zones.groupby("Merchandiser").z.apply(lambda v: sorted(set(v))).to_string())


if __name__ == "__main__":
    main()
