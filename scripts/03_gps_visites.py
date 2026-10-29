"""Étape 3 (1.1 bis) : retrouver le GPS des PDV qui n'en ont pas, grâce aux visites.

Visites : historique « Routing détaillé » (sans ID_PDV) + onglet Rapports_BR du classeur
ATOM (avec ID_PDV). Les deux se recoupent : une visite vue dans les deux n'est comptée
qu'une fois (même merchandiser, même nom, même jour, même position).

Correspondance visite → PDV, de la plus sûre à la moins sûre :
  0. ID_PDV (Rapports_BR) ;
  1. même nom + même téléphone (8 derniers chiffres) ;
  2. même nom + même merchandiser (via les alias).
Une clé qui désigne plusieurs PDV (homonymes) ne désigne personne. Le téléphone seul
n'est qu'une piste : jamais une position.

Sorties : data/out/gps_recuperes.csv, data/cache/visites.pkl, data/cache/anomalies_03.csv
"""
from __future__ import annotations

import importlib
from collections import defaultdict

import numpy as np
import pandas as pd

from atom.commun import DATA_CACHE, DATA_OUT, chemin, confiance_gps_visites, config, distributeur, gps_texte, \
    haversine_m, mediane, norm, tel8

alias = importlib.import_module("02_alias")
COLS_ANOMALIES = ["Type", "ID_PDV", "Nom_PDV", "Merchandiser", "Cle_secteur", "Detail"]


def charger_visites(cfg, ali: dict) -> pd.DataFrame:
    S = cfg["SOURCES"]
    b = cfg["BORNES_CI"]
    h = pd.read_csv(chemin(S["historique_visites"]["fichier"]), dtype=str, keep_default_na=False)
    pos = [gps_texte(x, b) for x in h["GPS visite"]]
    v1 = pd.DataFrame({
        "source": "historique",
        "id_pdv": "",
        "nom": h.PDV, "merch_brut": h.Merchandiseur, "contact": h["Contact PDV"],
        "jour": h.Date.str[:10],
        "lat": [p[0] for p in pos], "lng": [p[1] for p in pos], "etat_gps": [p[2] for p in pos],
        "precision_m": np.nan, "distrib": h["Nom du distributeur"].map(distributeur),
    })
    br = pd.read_excel(chemin(S["atom_xlsx"]["fichier"]), sheet_name="Rapports_BR", dtype=str).fillna("")
    pos = [gps_texte(x, b) for x in br["GPS Visite (lat,lng)"]]
    v2 = pd.DataFrame({
        "source": "Rapports_BR",
        "id_pdv": br.ID_PDV.str.strip(),
        "nom": br["Nom PDV"], "merch_brut": br.Merchandiseur, "contact": br["Contact PDV"],
        "jour": br.Date.str[:10],
        "lat": [p[0] for p in pos], "lng": [p[1] for p in pos], "etat_gps": [p[2] for p in pos],
        "precision_m": pd.to_numeric(br["Précision GPS (m)"], errors="coerce"),
        "distrib": br.Distributeur.map(distributeur),
    })
    v = pd.concat([v1, v2], ignore_index=True)
    v["nom_norm"] = v.nom.map(norm)
    v["tel8"] = v.contact.map(tel8)
    v["merch"] = v.merch_brut.map(lambda n: ali.get(norm(n), n.strip()))
    v["lat5"] = v.lat.round(5)
    v["lng5"] = v.lng.round(5)
    # Une ligne de l'historique déjà présente dans Rapports_BR (même merchandiser, nom, jour et position)
    # est retirée ; on compte les occurrences pour ne pas fusionner deux visites distinctes
    # (homonymes visités le même jour, sans GPS). Toutes les lignes Rapports_BR sont gardées.
    cle = ["merch", "nom_norm", "jour", "lat5", "lng5"]
    k = pd.Series(["|".join("" if pd.isna(x) else str(x) for x in row) for row in v[cle].itertuples(index=False)],
                  index=v.index)
    v["occ"] = v.groupby([k, v.source]).cumcount()
    br = set(zip(k[v.source == "Rapports_BR"], v.occ[v.source == "Rapports_BR"]))
    doublon = (v.source == "historique") & pd.Series([(a, b) in br for a, b in zip(k, v.occ)], index=v.index)
    avant = len(v)
    v = v[~doublon].drop(columns="occ").reset_index(drop=True)
    print(f"  visites : {avant} lignes, {avant - len(v)} doublons retirés, {len(v)} gardées "
          f"({v.source.value_counts().to_dict()}) ; avec GPS : {v.lat.notna().sum()}")
    return v


def attribuer(v: pd.DataFrame, p: pd.DataFrame) -> pd.DataFrame:
    """Ajoute à chaque visite : id attribué, niveau (0/1/2), candidats homonymes, piste téléphone."""
    ids = set(p.ID_PDV)
    par_nom_tel = defaultdict(list)
    par_nom_merch = defaultdict(list)
    par_tel = defaultdict(list)
    for r in p.itertuples():
        if r.nom_norm and r.tel8:
            par_nom_tel[(r.nom_norm, r.tel8)].append(r.ID_PDV)
        if r.nom_norm:
            par_nom_merch[(r.nom_norm, r.merch)].append(r.ID_PDV)
        if r.tel8:
            par_tel[r.tel8].append(r.ID_PDV)
    att, niv, homo, piste = [], [], [], []
    for r in v.itertuples():
        a = n = None
        hom: list[str] = []
        if r.id_pdv and r.id_pdv in ids:
            a, n = r.id_pdv, 0
        else:
            c1 = par_nom_tel.get((r.nom_norm, r.tel8), []) if r.nom_norm and r.tel8 else []
            c2 = par_nom_merch.get((r.nom_norm, r.merch), []) if r.nom_norm else []
            if len(c1) == 1:
                a, n = c1[0], 1
            elif len(c1) > 1:
                hom = c1
            elif len(c2) == 1:
                a, n = c2[0], 2
            elif len(c2) > 1:
                hom = c2
        att.append(a)
        niv.append(n)
        homo.append(hom)
        # Piste : autres PDV au même numéro (le téléphone seul ne vaut jamais position).
        piste.append([i for i in par_tel.get(r.tel8, []) if i != a and i not in hom] if r.tel8 else [])
    v = v.copy()
    v["id_attribue"] = att
    v["niveau"] = niv
    v["homonymes"] = homo
    v["piste_tel"] = piste
    return v


def saisies_a_distance(v: pd.DataFrame, p: pd.DataFrame, ecart_m: float) -> pd.Series:
    """Visites enregistrées depuis un point qui n'est pas le PDV.

    Un point (même merchandiser, même jour, ~10 m) est « point de saisie à distance » s'il a
    servi à enregistrer au moins 2 PDV dont la position connue est à plus de `ecart_m`.
    Toutes les visites saisies depuis ce point sont marquées : leur GPS ne dit rien du PDV.
    """
    pg = p[p.a_gps].set_index("ID_PDV")
    v = v.copy()
    v["cel"] = list(zip(v.merch, v.jour, v.lat.round(4), v.lng.round(4)))
    connus = v[v.lat.notna() & v.id_attribue.isin(pg.index)]
    d = haversine_m(pg.loc[connus.id_attribue, "lat"].to_numpy(), pg.loc[connus.id_attribue, "lng"].to_numpy(),
                    connus.lat.to_numpy(), connus.lng.to_numpy())
    loin = connus[d > ecart_m]
    nb = loin.groupby("cel").id_attribue.nunique()
    cellules = set(nb[nb >= 2].index)
    return v.cel.isin(cellules) & v.lat.notna()


def main() -> None:
    cfg = config()
    ali = alias.table_alias()
    # Cache écrit par 01_load.py (fichier local du pipeline, pas une source externe).
    p = pd.read_pickle(DATA_CACHE / "pdv.pkl")
    p["merch"] = p["Créé_par"].map(lambda n: ali.get(norm(n), n))
    v = attribuer(charger_visites(cfg, ali), p)
    v["saisie_distance"] = saisies_a_distance(v, p, cfg["GPS_ECART_CONTROLE_M"])
    print(f"  visites saisies depuis un point de saisie à distance : {int(v.saisie_distance.sum())} "
          f"({v[v.saisie_distance].merch.value_counts().head(5).to_dict()})")
    v.to_pickle(DATA_CACHE / "visites.pkl")
    print("  visites attribuées par niveau :",
          v.niveau.value_counts(dropna=False).rename({0: "ID", 1: "nom+tél", 2: "nom+merch"}).to_dict(),
          "; homonymes :", int((v.homonymes.str.len() > 0).sum()))

    rayon, part = cfg["GPS_VISITE_RAYON_M"], cfg["GPS_VISITE_PART_MOYENNE"]
    anomalies, lignes = [], []
    homo_par_id = defaultdict(list)
    piste_par_id = defaultdict(list)
    for r in v.itertuples():
        for i in r.homonymes:
            homo_par_id[i].append(r.Index)
        for i in r.piste_tel:
            piste_par_id[i].append(r.Index)
    att = v[v.id_attribue.notna()].groupby("id_attribue")

    for r in p[~p.a_gps].itertuples():
        mes = att.get_group(r.ID_PDV) if r.ID_PDV in att.groups else v.iloc[0:0]
        niveaux = sorted(set(mes.niveau.dropna().astype(int)))
        corr = " + ".join({0: "ID", 1: "nom+tél", 2: "nom+merch"}[n] for n in niveaux)
        n_dist = int(mes.saisie_distance.sum())
        avec = mes[mes.lat.notna() & ~mes.saisie_distance]
        pts = list(zip(avec.lat, avec.lng))
        base = {"ID_PDV": r.ID_PDV, "Nom_PDV": r.Nom_PDV, "Merchandiser": r.merch,
                "Nb visites": len(mes), "Nb visites GPS": len(pts), "Correspondance": corr,
                "GPS_Lat": None, "GPS_Lng": None, "Methode": "", "Confiance": "", "Dispersion (m)": None,
                "Precision mediane (m)": None, "Visites saisies a distance": n_dist}
        if pts:
            c = confiance_gps_visites(pts, rayon, part)
            base["Dispersion (m)"] = c["dispersion_m"]
            pr = avec.precision_m.dropna()
            base["Precision mediane (m)"] = float(pr.median()) if len(pr) else None
            if c["confiance"] in ("haute", "moyenne"):
                base.update(GPS_Lat=round(c["lat"], 6), GPS_Lng=round(c["lng"], 6), Methode="GPS visite",
                            Confiance=c["confiance"], Resultat="GPS récupéré")
            else:
                base.update(Confiance="ambigu", Resultat="ambigu (visites éparpillées)")
                anomalies.append(dict(zip(COLS_ANOMALIES, [
                    "GPS de visite ambigu", r.ID_PDV, r.Nom_PDV, r.merch, "",
                    f"{len(pts)} GPS de visite dispersés sur {c['dispersion_m']} m ; candidats : "
                    + " | ".join(f"{a:.6f},{b:.6f}" for a, b in pts[:8])])))
        elif n_dist:
            base["Resultat"] = "visité, GPS saisi à distance seulement"
        elif len(mes):
            base["Resultat"] = "visité, jamais avec GPS"
        elif r.ID_PDV in homo_par_id:
            hv = v.loc[homo_par_id[r.ID_PDV]]
            hv = hv[hv.lat.notna()]
            base.update(Confiance="ambigu", Resultat="ambigu (homonymes)", **{"Nb visites": len(homo_par_id[r.ID_PDV])})
            autres = sorted({i for lst in v.loc[homo_par_id[r.ID_PDV]].homonymes for i in lst} - {r.ID_PDV})
            anomalies.append(dict(zip(COLS_ANOMALIES, [
                "GPS de visite ambigu", r.ID_PDV, r.Nom_PDV, r.merch, "",
                f"visites partagées avec {len(autres)} PDV homonyme(s) {', '.join(a[:8] for a in autres[:5])} ; "
                f"positions candidates : " + " | ".join(f"{a:.6f},{b:.6f}" for a, b in zip(hv.lat[:8], hv.lng[:8]))])))
        elif r.ID_PDV in piste_par_id:
            pv = v.loc[piste_par_id[r.ID_PDV]]
            base.update(Resultat="piste par téléphone seul", **{"Nb visites": len(pv)})
            anomalies.append(dict(zip(COLS_ANOMALIES, [
                "piste téléphone seul", r.ID_PDV, r.Nom_PDV, r.merch, "",
                f"{len(pv)} visite(s) au même numéro sous un autre nom ({', '.join(sorted(set(pv.nom))[:4])}) : "
                "le téléphone seul ne suffit pas"])))
        else:
            base["Resultat"] = "aucune visite"
        if r.ID_PDV in piste_par_id:
            pv = v.loc[piste_par_id[r.ID_PDV]]
            pv = pv[pv.lat.notna()]
            base["Piste telephone"] = (f"{len(pv)} visite(s) GPS au même numéro sous un autre nom "
                                       f"({', '.join(sorted(set(pv.nom))[:3])})") if len(pv) else ""
        lignes.append(base)
    out = pd.DataFrame(lignes)
    out["Methode"] = out.Methode.fillna("")

    # Contrôle bonus : PDV avec GPS comparé à la médiane de ses GPS de visite.
    n_ecart = 0
    pg = p[p.a_gps].set_index("ID_PDV")
    for i, g in att:
        if i not in pg.index:
            continue
        g = g[g.lat.notna() & ~g.saisie_distance]
        if g.empty:
            continue
        mlat, mlng = mediane(list(zip(g.lat, g.lng)))
        d = float(haversine_m(pg.at[i, "lat"], pg.at[i, "lng"], mlat, mlng))
        if d > cfg["GPS_ECART_CONTROLE_M"]:
            n_ecart += 1
            anomalies.append(dict(zip(COLS_ANOMALIES, [
                "GPS du PDV éloigné des visites", i, pg.at[i, "Nom_PDV"], pg.at[i, "merch"], "",
                f"{d:.0f} m entre le GPS du PDV et la médiane de {len(g)} GPS de visite "
                f"({mlat:.6f},{mlng:.6f}) ; rien n'est corrigé"])))

    DATA_OUT.mkdir(parents=True, exist_ok=True)
    cols = ["ID_PDV", "Nom_PDV", "Nb visites", "GPS_Lat", "GPS_Lng", "Methode", "Confiance", "Dispersion (m)",
            "Resultat", "Correspondance", "Nb visites GPS", "Visites saisies a distance", "Precision mediane (m)",
            "Piste telephone", "Merchandiser"]
    out[cols].to_csv(DATA_OUT / "gps_recuperes.csv", index=False)
    pd.DataFrame(anomalies, columns=COLS_ANOMALIES).to_csv(DATA_CACHE / "anomalies_03.csv", index=False)

    print("  407 PDV sans GPS :")
    print(out.groupby(["Resultat", "Confiance"], dropna=False).size().to_string())
    rec = out[out.Resultat == "GPS récupéré"]
    print("  dont récupérés par correspondance :", rec.Correspondance.value_counts().to_dict())
    print(f"  contrôle bonus : {n_ecart} PDV avec GPS à plus de {cfg['GPS_ECART_CONTROLE_M']} m de leurs visites "
          "(hors visites saisies à distance)")


if __name__ == "__main__":
    main()
