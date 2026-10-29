"""Briques du routing de novembre : qui couvre chaque secteur, calendrier, types et quotas."""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import date, timedelta

import pandas as pd

JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
CLES_JOUR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"]


# ---------------------------------------------------------------- calendrier

def date_du(jour: str, occurrence: int, debut: date) -> date:
    """Lundi S1 = DATE_DEBUT ; semaine n = lundi + 7 (n-1) jours ; du lundi au samedi."""
    return debut + timedelta(days=7 * (int(occurrence) - 1) + JOURS.index(jour))


# ---------------------------------------------------------------- types

def canal(type_pdv: str) -> str | None:
    """Même règle que canal_atom() dans l'app (Table Top → Aboki & Kiosque)."""
    t = (type_pdv or "").upper()
    if "PORRIDGE" in t:
        return "Porridge"
    if "PUSHCAR" in t:
        return "Pushcart"
    if re.search(r"ABOKI|KIOS|TABLE TOP|TABLIER", t):
        return "Aboki & Kiosque"
    if re.search(r"SUPERETTE|MINIMARKET|BOUTIQUE", t):
        return "Superette & Boutique"
    return None


def quotas_du_jour(cfg: dict, jour: str) -> dict[str, int]:
    """Quotas par canal ; Superette et Boutique fusionnés (type ATOM « Superette & Boutique »)."""
    q = cfg["QUOTAS_JOUR"][CLES_JOUR[JOURS.index(jour)]]
    return {"Superette & Boutique": q["Superette"] + q["Boutique"], "Aboki & Kiosque": q["Aboki & Kiosque"],
            "Porridge": q["Porridge"], "Pushcart": q["Pushcart"]}


# ---------------------------------------------------------------- propriété des secteurs

def proprietaires(points: pd.DataFrame, secteurs: pd.DataFrame, manuelle: pd.DataFrame,
                  createurs: pd.DataFrame) -> pd.DataFrame:
    """Une ligne par secteur : merchandiser qui le couvre, règle, alerte.

    0. décision de Jean Luc (territoire ou zone) ;
    1. merchandiser qui a le plus de jours de routing sur le secteur ;
    2. sinon celui qui a le plus de jours sur la zone ;
    3. sinon personne (zone couverte par personne).
    À égalité de jours, le créateur du plus de PDV du secteur l'emporte, et c'est signalé.
    """
    jours_s, jours_z = defaultdict(Counter), defaultdict(Counter)
    for m, ss in zip(points.Merchandiser, points.Secteurs):
        for c in filter(None, str(ss).split(" ; ")):
            jours_s[c][m] += 1
            jours_z[c.rsplit("|", 1)[0]][m] += 1
    crea = defaultdict(Counter)
    for m, c in zip(createurs.Merchandiser, createurs.Cle):
        if isinstance(c, str) and c:
            crea[c][m] += 1
    man = {(t, z or ""): m for t, z, m in zip(manuelle.Territoire, manuelle.Zone, manuelle.Merchandiser)}
    lignes = []
    for c, t, z in zip(secteurs.Cle, secteurs.Territoire, secteurs.Zone):
        zk = f"{t}|{z}"
        m, regle, alerte = "", "", ""
        if (t, z) in man or (t, "") in man:
            m, regle = man.get((t, z), man.get((t, ""))), "décision de Jean Luc"
        else:
            for cnt, nom in ((jours_s[c], "jours de routing sur le secteur"),
                             (jours_z[zk], "jours de routing sur la zone")):
                if cnt:
                    top = max(cnt.values())
                    ex = sorted((x for x, n in cnt.items() if n == top), key=lambda x: (-crea[c][x], x))
                    m, regle = ex[0], nom
                    if len(ex) > 1:
                        alerte = "égalité entre " + " et ".join(ex)
                    break
            else:
                regle = "zone couverte par personne"
        autres = sorted(set(jours_z[zk]) - {m})
        if autres and not alerte:
            alerte = "zone partagée avec " + ", ".join(autres)
        lignes.append({"Cle": c, "Territoire": t, "Zone": z, "Merchandiser": m, "Regle": regle, "Alerte": alerte})
    return pd.DataFrame(lignes)


# ---------------------------------------------------------------- distributeur (règle stricte, 29/10)

def distributeurs_pdv(visites: pd.DataFrame) -> pd.Series:
    """Distributeur de chaque PDV : le plus fréquent dans ses visites (ID_PDV → nom)."""
    v = visites[visites.id_attribue.notna() & (visites.distrib != "")]
    return v.groupby("id_attribue").distrib.agg(lambda s: s.value_counts().index[0])


def couverture_pdv(pdv: pd.DataFrame, points: pd.DataFrame, prop: pd.DataFrame, distrib_merch: dict[str, str],
                   manuelle: pd.DataFrame) -> pd.DataFrame:
    """Qui visite chaque PDV, avec la règle stricte du distributeur (décision du 29/10).

    - PDV au distributeur connu : seulement un merchandiser de ce distributeur. S'il y en a
      plusieurs, celui qui a le plus de jours sur le secteur, puis la zone, puis le territoire.
      Aucun merchandiser de ce distributeur, ou aucun n'a de jour dans ce territoire : personne.
    - PDV au distributeur inconnu : merchandiser du secteur (proprietaires()).
    Une décision de Jean Luc (couverture_manuelle) ne vaut que pour un merchandiser du même
    distributeur, ou pour un PDV au distributeur inconnu.
    Renvoie deux colonnes : couvert_par, raison.
    """
    jours = {"s": defaultdict(Counter), "z": defaultdict(Counter), "t": defaultdict(Counter)}
    for m, ss in zip(points.Merchandiser, points.Secteurs):
        for c in filter(None, str(ss).split(" ; ")):
            t, z, _ = c.split("|")
            jours["s"][c][m] += 1
            jours["z"][f"{t}|{z}"][m] += 1
            jours["t"][t][m] += 1
    man = {(t, z or ""): m for t, z, m in zip(manuelle.Territoire, manuelle.Zone, manuelle.Merchandiser)}
    par_distrib = defaultdict(set)
    for m, d in distrib_merch.items():
        par_distrib[d].add(m)
    out = []
    for cle, d in zip(pdv.Cle, pdv.Distributeur):
        if not isinstance(cle, str) or not cle:
            out.append(("", "sans secteur"))
            continue
        t, z, _ = cle.split("|")
        if not d:
            m = prop.Merchandiser.get(cle, "")
            out.append((m, "distributeur inconnu : merchandiser du secteur" if m else "zone couverte par personne"))
            continue
        cands = par_distrib.get(d, set())
        if not cands:
            out.append(("", f"aucun merchandiser du distributeur {d} dans le routing"))
            continue
        m_man = man.get((t, z), man.get((t, "")))
        if m_man in cands:
            out.append((m_man, "décision de Jean Luc"))
            continue
        for niveau, k in (("s", cle), ("z", f"{t}|{z}"), ("t", t)):
            cnt = {m: n for m, n in jours[niveau][k].items() if m in cands}
            if cnt:
                top = max(cnt.values())
                m = sorted(x for x, n in cnt.items() if n == top)[0]
                out.append((m, {"s": "distributeur + jours sur le secteur", "z": "distributeur + jours sur la zone",
                                "t": "distributeur + jours sur le territoire"}[niveau]))
                break
        else:
            out.append(("", f"le merchandiser de {d} n'a aucun jour dans ce territoire"))
    return pd.DataFrame(out, columns=["couvert_par", "raison"], index=pdv.index)


def distributeurs_merch() -> dict[str, str]:
    """Distributeur de chaque merchandiser, d'après le routing mensuel actuel."""
    import importlib
    from atom.commun import chemin, config, distributeur, norm
    ali = importlib.import_module("02_alias").table_alias()
    r = pd.read_csv(chemin(config()["SOURCES"]["routing_mensuel"]["fichier"]), dtype=str).fillna("")
    r["m"] = r.Merchandiser.str.strip().map(lambda n: ali.get(norm(n), n))
    return {m: distributeur(d.iloc[0]) for m, d in r.groupby("m").Distributeur}
