"""Fonctions partagées par les scripts du pipeline ATOM → découpage Friesland."""
from __future__ import annotations

import math
import re
import unicodedata
from pathlib import Path

import numpy as np
import yaml

RACINE = Path(__file__).resolve().parents[2]
DATA_IN = RACINE / "data" / "in"
DATA_REF = RACINE / "data" / "ref"
DATA_CACHE = RACINE / "data" / "cache"
DATA_OUT = RACINE / "data" / "out"


def config() -> dict:
    with open(RACINE / "config.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def chemin(rel: str) -> Path:
    p = Path(rel).expanduser()
    return p if p.is_absolute() else RACINE / p


# ---------------------------------------------------------------- texte

def norm(s) -> str:
    """Sans accents, sans casse, sans ponctuation, espaces simples."""
    if s is None or (isinstance(s, float) and math.isnan(s)):
        return ""
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace("’", "'")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def tel8(x) -> str | None:
    """Les 8 derniers chiffres d'un numéro (None s'il en a moins de 8)."""
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    s = str(x)
    if re.fullmatch(r"\d+\.0", s):  # nombre lu comme flottant
        s = s[:-2]
    chiffres = re.sub(r"\D", "", s)
    return chiffres[-8:] if len(chiffres) >= 8 else None


# ---------------------------------------------------------------- secteurs

def cle_secteur(territoire: str, zone: str, secteur: str) -> str:
    """Clé d'un secteur : Territoire + Zone + Secteur, jamais le nom seul."""
    for v in (territoire, zone, secteur):
        if not v or not str(v).strip():
            raise ValueError(f"clé de secteur incomplète : {territoire!r} / {zone!r} / {secteur!r}")
    return f"{str(territoire).strip()}|{str(zone).strip()}|{str(secteur).strip()}"


# ---------------------------------------------------------------- GPS

BORNES = {"lat_min": 4.9, "lat_max": 6.5, "lng_min": -6.5, "lng_max": -2.5}


def nombre(x) -> float | None:
    """Nombre décimal, virgule acceptée. Vide, texte ou NaN → None."""
    if x is None:
        return None
    if isinstance(x, (int, float)):
        return None if isinstance(x, float) and math.isnan(x) else float(x)
    s = str(x).strip().replace(" ", "").replace(",", ".")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def dans_ci(lat: float, lng: float, b: dict = BORNES) -> bool:
    return b["lat_min"] <= lat <= b["lat_max"] and b["lng_min"] <= lng <= b["lng_max"]


def gps(lat_brut, lng_brut, b: dict = BORNES) -> tuple[float | None, float | None, str]:
    """Position lue et contrôlée. Renvoie (lat, lng, etat).

    etat : 'ok', 'vide' (absent ou 0), 'inversé' (lat et lng permutées, corrigées),
    'hors CI' (position rejetée), 'illisible'.
    """
    lat, lng = nombre(lat_brut), nombre(lng_brut)
    if all(v is None or v == 0 for v in (lat, lng)):
        vide = all(str(v).strip() in ("", "nan", "None") or nombre(v) == 0 for v in (lat_brut, lng_brut))
        return None, None, "vide" if vide else "illisible"
    if lat is None or lng is None or lat == 0 or lng == 0:
        return None, None, "illisible"
    if dans_ci(lat, lng, b):
        return lat, lng, "ok"
    if dans_ci(lng, lat, b):
        return lng, lat, "inversé"
    return None, None, "hors CI"


_NOMBRE = re.compile(r"-?\d+(?:[.,]\d+)?")


def gps_texte(s, b: dict = BORNES) -> tuple[float | None, float | None, str]:
    """« 5.371857, -4.012246 » → (lat, lng, etat). Accepte la virgule décimale."""
    if s is None or (isinstance(s, float) and math.isnan(s)):
        return None, None, "vide"
    nums = _NOMBRE.findall(str(s))
    if len(nums) != 2:
        return None, None, "vide" if not str(s).strip() else "illisible"
    return gps(nums[0], nums[1], b)


R_TERRE = 6_371_008.8


def haversine_m(lat1, lng1, lat2, lng2):
    """Distance en mètres (scalaires ou tableaux numpy)."""
    lat1, lng1, lat2, lng2 = map(np.radians, (lat1, lng1, lat2, lng2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lng2 - lng1) / 2) ** 2
    return 2 * R_TERRE * np.arcsin(np.sqrt(a))


def mediane(points: list[tuple[float, float]]) -> tuple[float, float]:
    arr = np.asarray(points, dtype=float)
    return float(np.median(arr[:, 0])), float(np.median(arr[:, 1]))


def groupe_principal(points: list[tuple[float, float]], rayon_m: float) -> list[int]:
    """Indices du plus grand groupe de points à moins de `rayon_m` d'un même point.

    Le centre est le point qui a le plus de voisins ; à égalité, le premier.
    """
    if not points:
        return []
    arr = np.asarray(points, dtype=float)
    d = haversine_m(arr[:, None, 0], arr[:, None, 1], arr[None, :, 0], arr[None, :, 1])
    voisins = d <= rayon_m
    centre = int(np.argmax(voisins.sum(axis=1)))
    return [int(i) for i in np.flatnonzero(voisins[centre])]


def confiance_gps_visites(points: list[tuple[float, float]], rayon_m: float, part_moyenne: float) -> dict:
    """Choix d'une position à partir de GPS de visite.

    - toutes les visites à moins de `rayon_m` de leur médiane → haute ;
    - un groupe d'au moins `part_moyenne` des visites → moyenne (médiane du groupe) ;
    - sinon → ambigu (pas de position).
    """
    n = len(points)
    if n == 0:
        return {"confiance": None, "lat": None, "lng": None, "dispersion_m": None, "n": 0}
    lat, lng = mediane(points)
    arr = np.asarray(points, dtype=float)
    dist = haversine_m(lat, lng, arr[:, 0], arr[:, 1])
    dispersion = float(dist.max())
    if dispersion <= rayon_m:
        return {"confiance": "haute", "lat": lat, "lng": lng, "dispersion_m": round(dispersion), "n": n}
    idx = groupe_principal(points, rayon_m)
    if len(idx) >= part_moyenne * n and n >= 2:
        sous = [points[i] for i in idx]
        glat, glng = mediane(sous)
        return {"confiance": "moyenne", "lat": glat, "lng": glng, "dispersion_m": round(dispersion), "n": n,
                "n_groupe": len(idx)}
    return {"confiance": "ambigu", "lat": None, "lng": None, "dispersion_m": round(dispersion), "n": n,
            "n_groupe": len(idx)}


def lien_maps(lat, lng) -> str:
    if lat is None or lng is None:
        return ""
    return f"https://www.google.com/maps/search/?api=1&query={lat:.6f},{lng:.6f}"


_DISTRIBUTEURS = [("NDA", r"^nda"), ("Boussoura", r"bouss"), ("PRODISMA", r"prodis"), ("Sodicomci", r"sodic"),
                  ("Niare & Frères", r"niare"), ("Sidecom", r"sidecom"), ("Plaisir Bachus", r"plaisir"),
                  ("SDTP", r"sdtp"), ("Dynamys", r"d[iy]nam")]


def distributeur(x) -> str:
    """Nom de distributeur ramené à une seule orthographe (« niare et frère on » → Niare & Frères)."""
    t = norm(x)
    for nom, motif in _DISTRIBUTEURS:
        if re.search(motif, t):
            return nom
    return ""
