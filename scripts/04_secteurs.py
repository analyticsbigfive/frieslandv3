"""Étape 4 (1.2) : géométrie des 306 secteurs.

1. Limites OSM (Overpass, en cache) des unités administratives de data/ref/territoire_communes.csv.
2. Ancrage de chaque secteur :
   a. médiane GPS des PDV ATOM dont le Quartier ou la Localisation porte le nom du secteur,
      parmi les PDV situés (par leur GPS) dans les unités du territoire ;
   b. sinon Nominatim (1 requête / s, en cache), accepté seulement dans les unités du territoire ;
   c. sinon aucun ancrage (anomalie).
3. Voronoï des ancrages, unité par unité, découpé par la limite de l'unité.

Sorties : data/out/secteurs.geojson, data/cache/ancrages.pkl, data/cache/unites.pkl, data/cache/anomalies_04.csv
"""
from __future__ import annotations

import json
import re
import time

import geopandas as gpd
import numpy as np
import pandas as pd
import requests
from rapidfuzz import fuzz
from shapely.geometry import LineString, MultiPoint, Point, shape
from shapely.ops import polygonize, unary_union, voronoi_diagram

from atom.commun import DATA_CACHE, DATA_OUT, DATA_REF, config, haversine_m, mediane, norm

UA = {"User-Agent": "frieslandv3-atom-routing/0.1 (jhouedanou@gmail.com)"}
SERVEURS = ["https://overpass.kumi.systems/api/interpreter",
            "https://overpass-api.de/api/interpreter",
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
OSM = DATA_CACHE / "osm"
UTM = "EPSG:32630"
COLS_ANOMALIES = ["Type", "ID_PDV", "Nom_PDV", "Merchandiser", "Cle_secteur", "Detail"]
MOTS_VIDES = {"de", "du", "des", "la", "le", "les", "l", "d", "et", "a", "au", "aux", "en", "chez"}


# ---------------------------------------------------------------- OSM

def overpass(requete: str, cache) -> dict:
    if cache.exists():
        return json.loads(cache.read_text())
    for essai in range(2):
        for s in SERVEURS:
            try:
                r = requests.post(s, data={"data": requete}, headers=UA, timeout=300)
                if r.status_code == 200 and r.text.lstrip().startswith("{"):
                    cache.write_text(r.text)
                    return r.json()
                print(f"    {s.split('/')[2]} : HTTP {r.status_code}")
            except requests.RequestException as e:
                print(f"    {s.split('/')[2]} : {type(e).__name__}")
            time.sleep(5)
    raise SystemExit(f"ARRÊT : Overpass injoignable ({cache.name})")


def polygone_relation(rel: dict):
    ext, inte = [], []
    for m in rel.get("members", []):
        if m.get("type") != "way" or "geometry" not in m:
            continue
        ligne = LineString([(p["lon"], p["lat"]) for p in m["geometry"]])
        (inte if m.get("role") == "inner" else ext).append(ligne)
    poly = unary_union(list(polygonize(unary_union(ext))))
    if inte:
        trous = unary_union(list(polygonize(unary_union(inte))))
        poly = poly.difference(trous)
    return poly


def charger_unites() -> gpd.GeoDataFrame:
    table = pd.read_csv(DATA_REF / "territoire_communes.csv", dtype=str).fillna("")
    OSM.mkdir(parents=True, exist_ok=True)
    tags = overpass('[out:json][timeout:200];rel["boundary"="administrative"]["admin_level"~"^(6|7|8)$"]'
                    '(4.8,-6.2,6.8,-2.6);out tags;', OSM / "admin_tags_large.json")
    ids = {}
    for e in tags["elements"]:
        ids.setdefault((e["tags"].get("name"), e["tags"].get("admin_level")), e["id"])
    voulues = []
    for (nom, niv), _ in table.groupby(["Unite_OSM", "Niveau"]):
        rid = ids.get((nom, niv))
        if rid is None:
            print(f"  unité absente d'OSM : {nom} (niveau {niv})")
            continue
        voulues.append((nom, int(niv), rid))
    # Géométries par l'API lookup de Nominatim (Overpass trop lent pour « out geom »).
    cache = OSM / "unites_nominatim.json"
    geo = json.loads(cache.read_text()) if cache.exists() else {}
    manquantes = [str(rid) for _, _, rid in voulues if str(rid) not in geo]
    for i in range(0, len(manquantes), 40):
        lot = manquantes[i:i + 40]
        r = requests.get("https://nominatim.openstreetmap.org/lookup", headers=UA, timeout=120,
                         params={"osm_ids": ",".join("R" + x for x in lot), "format": "jsonv2",
                                 "polygon_geojson": 1})
        r.raise_for_status()
        for x in r.json():
            geo[str(x["osm_id"])] = x["geojson"]
        time.sleep(1.1)
    # Relations récentes (intérieur) absentes de Nominatim : polygons.openstreetmap.fr.
    for rid in [str(rid) for _, _, rid in voulues if str(rid) not in geo]:
        r = requests.get("https://polygons.openstreetmap.fr/get_geojson.py", headers=UA, timeout=120,
                         params={"id": rid, "params": 0})
        if r.status_code == 200 and r.text.lstrip().startswith("{"):
            geo[rid] = r.json()
        time.sleep(1)
    cache.write_text(json.dumps(geo))
    lignes = []
    for nom, niv, rid in voulues:
        g = geo.get(str(rid))
        poly = shape(g) if g else None
        if poly is not None and poly.geom_type == "GeometryCollection":
            poly = unary_union([x for x in poly.geoms if x.geom_type in ("Polygon", "MultiPolygon")])
        if poly is None or poly.is_empty or poly.geom_type not in ("Polygon", "MultiPolygon"):
            print(f"  limite absente ou invalide : {nom}")
            continue
        lignes.append({"Unite": nom, "Niveau": niv, "osm_id": rid, "geometry": poly.buffer(0)})
    u = gpd.GeoDataFrame(lignes, crs="EPSG:4326")
    print(f"  {len(u)} unités chargées sur {table.Unite_OSM.nunique()}")
    return u


# ---------------------------------------------------------------- noms

def jetons(s: str) -> list[str]:
    s = norm(s)
    s = re.sub(r"\b(\d+)\s*(eme|e|er|ere|ieme)\b", r"\1e", s)
    # N'Dotré, N Dotré, Ndotré → ndotre ; M'Pouto → mpouto
    s = re.sub(r"\b([nm]) (?=[a-z])", r"\1", s)
    return [t for t in s.split() if t not in MOTS_VIDES]


def nom_contient(secteur: list[str], texte: list[str]) -> bool:
    """Tous les mots du secteur se retrouvent dans le texte (tolérance d'une faute sur les mots longs)."""
    if not secteur or not texte:
        return False
    for t in secteur:
        if len(t) <= 3 or t.isdigit() or t[:-1].isdigit():
            if t not in texte:
                return False
        elif not any(fuzz.ratio(t, u) >= 85 for u in texte if abs(len(u) - len(t)) <= 2):
            return False
    return True


def correspondances(texte: str, secteurs: list[tuple[str, list[str]]]) -> list[str]:
    """Clés des secteurs nommés dans `texte` ; seul le nom le plus précis est gardé, à égalité aucun."""
    tx = jetons(texte)
    ok = [(c, len(j)) for c, j in secteurs if nom_contient(j, tx)]
    if not ok:
        return []
    m = max(n for _, n in ok)
    meilleurs = [c for c, n in ok if n == m]
    return meilleurs


# ---------------------------------------------------------------- ancrages

def nominatim(q: str, cache: dict, delai: float) -> list[dict]:
    if q in cache:
        return cache[q]
    time.sleep(delai)
    r = requests.get("https://nominatim.openstreetmap.org/search", headers=UA, timeout=60,
                     params={"q": q, "format": "jsonv2", "limit": 5, "countrycodes": "ci"})
    res = r.json() if r.status_code == 200 else []
    cache[q] = [{"lat": float(x["lat"]), "lon": float(x["lon"]), "nom": x.get("display_name", ""),
                 "type": x.get("type", "")} for x in res]
    return cache[q]


def nom_unite(u: str) -> str:
    return re.sub(r"^(Sous Préfecture de|Département de)\s+", "", u)


def main() -> None:
    cfg = config()
    anomalies = []
    # Caches écrits par les étapes 01 et 03 du pipeline (fichiers locaux, pas une source externe).
    s = pd.read_pickle(DATA_CACHE / "secteurs.pkl")
    p = pd.read_pickle(DATA_CACHE / "pdv.pkl")
    table = pd.read_csv(DATA_REF / "territoire_communes.csv", dtype=str).fillna("")
    manque = set(s.Territoire) - set(table.Territoire)
    if manque:
        raise SystemExit(f"ARRÊT : territoires sans unité dans territoire_communes.csv : {sorted(manque)}")

    unites = charger_unites()
    unites.to_pickle(DATA_CACHE / "unites.pkl")
    terr_unites = table.groupby("Territoire").Unite_OSM.apply(list).to_dict()
    union_terr = {t: unary_union(unites[unites.Unite.isin(us)].geometry.tolist()) for t, us in terr_unites.items()}

    # Unité la plus précise de chaque PDV (parmi les unités du tableau).
    pg = gpd.GeoDataFrame(p[p.a_gps].copy(), geometry=gpd.points_from_xy(p[p.a_gps].lng, p[p.a_gps].lat),
                          crs="EPSG:4326")
    j = gpd.sjoin(pg[["ID_PDV", "geometry"]], unites[["Unite", "Niveau", "geometry"]], predicate="within")
    j = j.sort_values("Niveau", ascending=False).drop_duplicates("ID_PDV")
    pg = pg.merge(j[["ID_PDV", "Unite"]], on="ID_PDV", how="left")
    unite_terr = table.groupby("Unite_OSM").Territoire.apply(set).to_dict()

    # a. ancrage par les noms ATOM
    secteurs_par_terr = {t: [(c, jetons(n)) for c, n in zip(g.Cle, g.Secteur)] for t, g in s.groupby("Territoire")}
    cand: dict[str, list[tuple[float, float]]] = {c: [] for c in s.Cle}
    for r in pg[pg.Unite.notna()].itertuples():
        candidats = [x for t in unite_terr.get(r.Unite, ()) for x in secteurs_par_terr.get(t, [])]
        trouves = set()
        for texte in (r.Quartier, r.Localisation):
            m = correspondances(texte, candidats)
            if len(m) == 1:
                trouves.add(m[0])
        if len(trouves) == 1:
            cand[trouves.pop()].append((r.lat, r.lng))
    pg.to_pickle(DATA_CACHE / "pdv_unites.pkl")

    lignes = []
    for r in s.itertuples():
        pts = cand[r.Cle]
        info = {"Cle": r.Cle, "Territoire": r.Territoire, "Zone": r.Zone, "Secteur": r.Secteur,
                "Commercial": r.Commercial, "Methode_ancrage": "aucun", "Nb_pdv_ancrage": len(pts),
                "lat": None, "lng": None, "Detail_ancrage": ""}
        if len(pts) >= cfg["ANCRAGE_MIN_PDV"]:
            lat, lng = mediane(pts)
            arr = np.asarray(pts)
            for _ in range(3):  # valeurs aberrantes retirées
                d = haversine_m(lat, lng, arr[:, 0], arr[:, 1])
                garde = arr[d <= cfg["ANCRAGE_ABERRANT_M"]]
                if len(garde) < cfg["ANCRAGE_MIN_PDV"]:
                    break
                arr = garde
                lat, lng = mediane(arr.tolist())
            d = haversine_m(lat, lng, arr[:, 0], arr[:, 1])
            if len(arr) >= cfg["ANCRAGE_MIN_PDV"] and union_terr[r.Territoire].contains(Point(lng, lat)):
                info.update(Methode_ancrage="médiane PDV ATOM", Nb_pdv_ancrage=len(arr), lat=lat, lng=lng,
                            Detail_ancrage=f"{len(arr)} PDV (sur {len(pts)}), distance médiane {np.median(d):.0f} m")
            else:
                info["Detail_ancrage"] = f"{len(pts)} PDV au nom du secteur, trop dispersés ou hors territoire"
        lignes.append(info)
    a = pd.DataFrame(lignes)

    # b. Nominatim pour les secteurs restants
    cache_nom = DATA_CACHE / "nominatim.json"
    cnom = json.loads(cache_nom.read_text()) if cache_nom.exists() else {}
    try:
        atom = a[a.Methode_ancrage == "médiane PDV ATOM"]
        for i, r in a[a.Methode_ancrage == "aucun"].iterrows():
            # Repère de la zone : médiane des ancrages ATOM de la même zone (s'il y en a).
            z = atom[(atom.Territoire == r.Territoire) & (atom.Zone == r.Zone)]
            repere = mediane(list(zip(z.lat, z.lng))) if len(z) else None
            requetes = []
            if norm(r.Zone) not in (norm(r.Territoire), norm(r.Secteur)):
                requetes += [f"{r.Secteur.title()}, {r.Zone.title()}, {nom_unite(u)}, Côte d'Ivoire"
                             for u in terr_unites[r.Territoire][:1]]
            requetes += [f"{r.Secteur.title()}, {nom_unite(u)}, Côte d'Ivoire" for u in terr_unites[r.Territoire]]
            for q in requetes:
                res = nominatim(q, cnom, cfg["NOMINATIM_DELAI_S"])
                if repere:
                    res = [x for x in res if haversine_m(repere[0], repere[1], x["lat"], x["lon"]) <= 4000]
                # Le lieu trouvé doit porter le nom du secteur (sinon Nominatim renvoie la commune entière).
                ok = [x for x in res if union_terr[r.Territoire].contains(Point(x["lon"], x["lat"]))
                      and nom_contient(jetons(r.Secteur), jetons(x["nom"].split(",")[0]))]
                if ok:
                    a.loc[i, ["Methode_ancrage", "lat", "lng", "Detail_ancrage"]] = [
                        "géocodage Nominatim", ok[0]["lat"], ok[0]["lon"], f"{q} → {ok[0]['nom'][:90]}"]
                    break
    finally:
        cache_nom.write_text(json.dumps(cnom, ensure_ascii=False, indent=0))

    # Unité de l'ancrage ; deux ancrages au même point : le moins fiable perd le sien.
    rang = {"médiane PDV ATOM": 0, "géocodage Nominatim": 1}
    a["Unite"] = None
    for i, r in a[a.lat.notna()].iterrows():
        pt = Point(r.lng, r.lat)
        us = unites[unites.Unite.isin(terr_unites[r.Territoire]) & unites.contains(pt)].sort_values("Niveau")
        a.loc[i, "Unite"] = us.Unite.iloc[-1] if len(us) else None
    a = a.sort_values(["Methode_ancrage", "Nb_pdv_ancrage"], key=lambda c: c.map(rang).fillna(9)
                      if c.name == "Methode_ancrage" else -c)
    vus: list[tuple[float, float, str]] = []
    for i, r in a[a.lat.notna()].iterrows():
        proche = [c for la, ln, c in vus if haversine_m(la, ln, r.lat, r.lng) < 50]
        if proche:
            anomalies.append(dict(zip(COLS_ANOMALIES, ["ancrage en double", "", "", "", r.Cle,
                                  f"même point que {proche[0]} : ancrage retiré ({r.Methode_ancrage})"])))
            a.loc[i, ["Methode_ancrage", "lat", "lng", "Unite"]] = ["aucun", None, None, None]
            a.loc[i, "Detail_ancrage"] = f"même point que {proche[0]}"
        else:
            vus.append((r.lat, r.lng, r.Cle))
    a = a.sort_index()
    for r in a[a.Methode_ancrage == "aucun"].itertuples():
        anomalies.append(dict(zip(COLS_ANOMALIES, ["secteur sans ancrage", "", "", "", r.Cle,
                                                   r.Detail_ancrage or "nom introuvable (PDV ATOM et Nominatim)"])))

    # c. Voronoï unité par unité
    a["geometry"] = None
    au = a[a.lat.notna()].copy()
    for unite, grp in au.groupby("Unite"):
        poly = unites[unites.Unite == unite].to_crs(UTM).geometry.iloc[0]
        pts = gpd.GeoSeries(gpd.points_from_xy(grp.lng, grp.lat), crs="EPSG:4326").to_crs(UTM)
        if len(grp) == 1:
            cellules = [poly]
        else:
            vor = voronoi_diagram(MultiPoint(list(pts)), envelope=poly.envelope.buffer(5000))
            cellules = []
            for pt in pts:
                c = next(g for g in vor.geoms if g.contains(pt))
                cellules.append(c.intersection(poly))
        geo = gpd.GeoSeries(cellules, crs=UTM).to_crs("EPSG:4326")
        for idx, g in zip(grp.index, geo):
            a.at[idx, "geometry"] = g
    a.drop(columns="geometry").to_pickle(DATA_CACHE / "ancrages.pkl")
    gdf = gpd.GeoDataFrame(a[a.geometry.notna()].copy(), geometry="geometry", crs="EPSG:4326")
    gdf["Ancrage_lat"] = gdf.lat.round(6)
    gdf["Ancrage_lng"] = gdf.lng.round(6)
    DATA_OUT.mkdir(parents=True, exist_ok=True)
    gdf[["Cle", "Territoire", "Zone", "Secteur", "Commercial", "Methode_ancrage", "Nb_pdv_ancrage",
         "Detail_ancrage", "Unite", "Ancrage_lat", "Ancrage_lng", "geometry"]].to_file(
        DATA_OUT / "secteurs.geojson", driver="GeoJSON")
    pd.DataFrame(anomalies, columns=COLS_ANOMALIES).to_csv(DATA_CACHE / "anomalies_04.csv", index=False)
    print("  ancrages :", a.Methode_ancrage.value_counts().to_dict())
    print("  secteurs sans ancrage par territoire :",
          a[a.Methode_ancrage == "aucun"].Territoire.value_counts().to_dict())


if __name__ == "__main__":
    main()
