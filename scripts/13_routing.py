"""Étape 13 (2.4–2.5) : routing daté de novembre 2026 par merchandiser.

- Chaque jour (Jour × Occurrence) garde son point de visite actuel et ses secteurs Friesland,
  limités aux secteurs que le merchandiser couvre, et à une seule zone.
- Quota du jour par type (règle Atom). Les pushcarts sont « à trouver », jamais listés par nom.
- Capacité dépassée (décision du 29/10) : on part du PDV le plus prioritaire (jamais visité,
  puis dernière visite la plus ancienne), puis on ajoute les plus proches qui remplissent
  encore un quota ; la priorité ne départage que des PDV à distance comparable.
- Jour trop court : secteur voisin de la même zone (même merchandiser).
- Zone donnée par décision de Jean Luc sans jour de routing (Bingerville → Kouamé) :
  elle prend des jours dont le point de visite est répété, au prorata de ses PDV (signalé).
- Treichville (Gui) : le fichier Treichville remplace ses jours Treichville du routing général.
- Ordre de passage : plus proche voisin depuis le premier PDV du jour.
- 30 novembre : journée de rattrapage (visite libre dans l'app).

Sorties : data/out/routing_mensuel_v2.csv, data/out/routing_detail.csv, data/out/pdv_reportes.csv
"""
from __future__ import annotations

from datetime import date

import numpy as np
import openpyxl
import pandas as pd

from atom.commun import DATA_CACHE, DATA_OUT, DATA_REF, chemin, config, haversine_m, norm, tel8
from atom.planif import JOURS, canal, couverture_pdv, date_du, distributeurs_merch, quotas_du_jour

PAS_DISTANCE_M = 150  # deux PDV à moins de 150 m d'écart sont « à distance comparable »


def priorites(ps: pd.DataFrame, pdv: pd.DataFrame) -> pd.Series:
    """Rang de priorité (petit = prioritaire) : jamais visité, puis dernière visite la plus ancienne."""
    d = pd.to_datetime(pdv.set_index("ID_PDV").Date_Derniere_Visite, format="mixed", errors="coerce")
    dv = ps.ID_PDV.map(d)
    return dv.fillna(pd.Timestamp("1900-01-01")).rank(method="first").astype(int)


def longueur_km(pts: pd.DataFrame) -> float:
    """Longueur du trajet (plus proche voisin) en km."""
    o = ordre_visite(pts)
    if len(o) < 2:
        return 0.0
    p = pts.loc[o]
    return float(haversine_m(p.lat.to_numpy()[:-1], p.lng.to_numpy()[:-1], p.lat.to_numpy()[1:],
                             p.lng.to_numpy()[1:]).sum() / 1000)


def choisir_jour(pool: pd.DataFrame, quotas: dict[str, int], voisins: bool = True) -> list[int]:
    """Indices des PDV retenus pour un jour : départ au plus prioritaire, puis les plus proches.
    Avec voisins=False (comparaison seulement) : ordre de priorité pur."""
    besoin = {k: v for k, v in quotas.items() if k != "Pushcart"}
    total = sum(besoin.values())
    reste = pool.copy()
    choisis: list[int] = []
    while len(choisis) < total and len(reste):
        ouverts = {k for k, v in besoin.items() if v > 0}
        cand = reste[reste.canal.isin(ouverts)]
        if cand.empty:  # type manquant : remplacé par des boutiques
            cand = reste[reste.canal == "Superette & Boutique"]
            if cand.empty:
                break
        if not choisis or not voisins:
            i = cand.prio.idxmin()
        else:
            sel = pool.loc[choisis]
            d = np.min(haversine_m(cand.lat.to_numpy()[:, None], cand.lng.to_numpy()[:, None],
                                   sel.lat.to_numpy()[None, :], sel.lng.to_numpy()[None, :]), axis=1)
            cle = pd.DataFrame({"b": (d // PAS_DISTANCE_M).astype(int), "p": cand.prio.to_numpy()},
                               index=cand.index)
            i = cle.sort_values(["b", "p"]).index[0]
        c = pool.at[i, "canal"]
        if besoin.get(c, 0) > 0:
            besoin[c] -= 1
        else:
            besoin["Superette & Boutique"] = max(0, besoin["Superette & Boutique"] - 1)
        choisis.append(i)
        reste = reste.drop(i)
    return choisis


def ordre_visite(pts: pd.DataFrame) -> list[int]:
    """Plus proche voisin depuis le premier PDV."""
    if len(pts) <= 2:
        return list(pts.index)
    restant = list(pts.index[1:])
    ordre = [pts.index[0]]
    while restant:
        a = pts.loc[ordre[-1]]
        d = haversine_m(a.lat, a.lng, pts.loc[restant, "lat"].to_numpy(), pts.loc[restant, "lng"].to_numpy())
        ordre.append(restant.pop(int(np.argmin(d))))
    return ordre


def lire_treichville(cfg) -> list[list[dict]]:
    wb = openpyxl.load_workbook(chemin(cfg["SOURCES"]["routing_treichville_xlsx"]["fichier"]), read_only=True,
                                data_only=True)
    listes = []
    for ws in wb.worksheets:
        lignes, entete = [], None
        for r in ws.iter_rows(values_only=True):
            cells = ["" if c is None else str(c).strip() for c in r]
            if entete is None:
                if any(norm(c) == "nom du pdv" for c in cells):
                    entete = [norm(c) for c in cells]
                continue
            if not any(cells):
                continue
            d = dict(zip(entete, cells))
            if d.get("nom du pdv"):
                lignes.append({"nom": d["nom du pdv"], "localisation": d.get("localisation", ""),
                               "secteur": d.get("secteur", ""), "contact": d.get("contact", ""),
                               "type": d.get("type") or d.get("type de pdv", ""), "onglet": ws.title.strip()})
        listes.append(lignes)
    return listes


def main() -> None:
    cfg = config()
    debut = date.fromisoformat(str(cfg["DATE_DEBUT"]))
    feries = {date.fromisoformat(str(d)) for d in cfg.get("JOURS_FERIES") or []}
    # Caches écrits par les étapes précédentes du pipeline (fichiers locaux).
    ps = pd.read_pickle(DATA_CACHE / "pdv_secteurs.pkl")
    points = pd.read_pickle(DATA_CACHE / "points_secteurs.pkl")
    prop = pd.read_pickle(DATA_CACHE / "proprietaires.pkl").set_index("Cle")
    anc = pd.read_pickle(DATA_CACHE / "ancrages.pkl").set_index("Cle")
    pdv = pd.read_pickle(DATA_CACHE / "pdv.pkl")
    routing = pd.read_csv(chemin(cfg["SOURCES"]["routing_mensuel"]["fichier"]), dtype=str).fillna("")
    a_localiser = pd.read_csv(DATA_OUT / "pdv_a_localiser_par_merchandiser.csv", dtype=str).fillna("")

    # PDV éligibles, avec position (ancrage du secteur pour les PDV sans GPS : « position à valider »)
    e = ps[(ps.Routable == "oui") & ps.Cle.notna() & (ps.Cle.astype(str) != "")].copy()
    e["sans_gps"] = e.GPS_Lat.isna()
    e["lat"] = pd.to_numeric(e.GPS_Lat, errors="coerce").fillna(e.Cle.map(anc.lat)).astype(float)
    e["lng"] = pd.to_numeric(e.GPS_Lng, errors="coerce").fillna(e.Cle.map(anc.lng)).astype(float)
    sans_position = e[e.lat.isna()].copy()  # rattachés à un secteur sans ancrage : aucune position
    e = e[e.lat.notna()]
    e["canal"] = e.Type_PDV.map(canal)
    e["prio"] = priorites(e, pdv)
    man = pd.read_csv(DATA_REF / "couverture_manuelle.csv", dtype=str).fillna("")
    cv = couverture_pdv(e, points, prop, distributeurs_merch(), man)  # règle stricte du distributeur
    e["couvert_par"], e["raison"] = cv.couvert_par, cv.raison
    e["zone_cle"] = e.Cle.str.rsplit("|", n=1).str[0]
    e = e.reset_index(drop=True)
    planifie = pd.Series(False, index=e.index)

    jours, detail, alertes, comparaison = [], [], [], []
    infos = routing.drop_duplicates("Merchandiser").set_index("Merchandiser")
    for m, rp in points.groupby("Merchandiser"):
        mine = e[e.couvert_par == m]
        mes_secteurs = set(prop.index[prop.Merchandiser == m])
        creneaux = []
        for x in rp.itertuples():
            ss = [c for c in str(x.Secteurs).split(" ; ") if c in mes_secteurs]
            if not ss:  # point sur des secteurs couverts par un autre : secteurs de la même zone
                zones = {c.rsplit("|", 1)[0] for c in str(x.Secteurs).split(" ; ") if c}
                ss = sorted(c for c in mes_secteurs if c.rsplit("|", 1)[0] in zones)
            zone = pd.Series([c.rsplit("|", 1)[0] for c in ss]).mode()
            zone = zone.iloc[0] if len(zone) else ""
            hors = [c for c in ss if not c.startswith(zone + "|")]
            orig = [c for c in str(x.Secteurs).split(" ; ") if c in anc.index and pd.notna(anc.at[c, "lat"])]
            ref = (float(anc.loc[orig, "lat"].mean()), float(anc.loc[orig, "lng"].mean())) if orig else None
            creneaux.append({"Ref": ref, "Jour": x.Jour, "Occurrence": int(x.Occurrence), "Point": x._4,
                             "Secteurs": [c for c in ss if c.startswith(zone + "|")], "Zone": zone,
                             "Alerte": ("secteurs d'une autre zone retirés : " + ", ".join(hors)) if hors else "",
                             "Source": "routing actuel"})
        # Jours manquants (moins de 24 dans le routing actuel) : visite libre
        presents = {(c["Jour"], c["Occurrence"]) for c in creneaux}
        for j in JOURS:
            for o in range(1, cfg["SEMAINES_MOIS"] + 1):
                if (j, o) not in presents:
                    creneaux.append({"Ref": None, "Jour": j, "Occurrence": o, "Point": "", "Secteurs": [], "Zone": "",
                                     "Alerte": "pas de point de visite dans le routing actuel : visite libre",
                                     "Source": "visite libre"})
        # Zones données par décision, sans jour : prennent des jours au point répété
        sans_jour = {z for z in mine.zone_cle.unique()} - {c["Zone"] for c in creneaux}
        if sans_jour:
            n_tot = len(mine)
            vus, repetes = set(), []
            for c in sorted(creneaux, key=lambda c: (c["Occurrence"], JOURS.index(c["Jour"]))):
                k = norm(c["Point"])
                if k and k in vus:
                    repetes.append(c)
                vus.add(k)
            repetes.sort(key=lambda c: -sum(quotas_du_jour(cfg, c["Jour"]).values()))
            for z in sorted(sans_jour, key=lambda z: -(mine.zone_cle == z).sum()):
                n = int(round(24 * (mine.zone_cle == z).sum() / n_tot))
                for c in repetes[:max(1, n)]:
                    alertes.append(f"{m} : {c['Jour']} S{c['Occurrence']} ({c['Point']}) passe à {z}")
                    c.update(Point=f"{z.split('|')[1].title()} (ancien point : {c['Point']})", Zone=z,
                             Secteurs=sorted(mine[mine.zone_cle == z].Cle.unique()),
                             Alerte=f"jour réattribué à {z} (décision du 29/10)", Source="décision")
                repetes = repetes[max(1, n):]
        # Treichville : le fichier dédié remplace les jours Treichville du routing général
        treich = [c for c in creneaux if c["Zone"].startswith("TREICHVILLE")]
        listes_treich = lire_treichville(cfg) if treich else []
        file_treich = [r for lst in listes_treich for r in lst]

        for c in sorted(creneaux, key=lambda c: (c["Occurrence"], JOURS.index(c["Jour"]))):
            dt = date_du(c["Jour"], c["Occurrence"], debut)
            q = quotas_du_jour(cfg, c["Jour"])
            obj = sum(q.values())
            lignes_jour: list[dict] = []
            al = [c["Alerte"]] if c["Alerte"] else []
            if dt in feries:
                al.append("jour férié")
            if c in treich:
                pris, file_treich = file_treich[:obj - q["Pushcart"]], file_treich[obj - q["Pushcart"]:]
                for r in pris:
                    cands = pdv[(pdv.nom_norm == norm(r["nom"])) & (pdv.tel8 == tel8(r["contact"]))] \
                        if tel8(r["contact"]) else pdv.iloc[0:0]
                    id_ = cands.ID_PDV.iloc[0] if len(cands) == 1 else ""
                    lignes_jour.append({"ID_PDV": id_, "Nom_PDV": r["nom"], "Type_PDV": r["type"],
                                        "Secteur": r["secteur"], "Zone": "TREICHVILLE",
                                        "Remarque": "fichier Treichville (" + r["onglet"] + ")"
                                        + ("" if id_ else " ; absent de la liste ATOM")})
                c["Source"] = "fichier Treichville"
            elif c["Secteurs"] or c["Ref"]:
                pool = mine[mine.Cle.isin(c["Secteurs"]) & ~planifie.loc[mine.index]]
                pool = pool[pool.canal.isin(["Superette & Boutique", "Aboki & Kiosque", "Porridge"])]
                choisis = choisir_jour(pool, q)
                if len(pool) > len(choisis) and len(choisis) >= 5:  # comparaison des deux méthodes
                    seule = choisir_jour(pool, q, voisins=False)
                    comparaison.append({"Merchandiser": m, "Date": dt.isoformat(), "Point": c["Point"],
                                        "PDV disponibles": len(pool), "PDV du jour": len(choisis),
                                        "km priorité + voisins": round(longueur_km(pool.loc[choisis]), 1),
                                        "km priorité seule": round(longueur_km(pool.loc[seule]), 1)})
                # Jour trop court : secteur voisin de la même zone
                if len(choisis) < obj - q["Pushcart"]:
                    voisins = mine[(mine.zone_cle == c["Zone"]) & ~mine.Cle.isin(c["Secteurs"])
                                   & ~planifie.loc[mine.index] & ~mine.index.isin(choisis)]
                    voisins = voisins[voisins.canal.isin(["Superette & Boutique", "Aboki & Kiosque", "Porridge"])]
                    if len(voisins) and len(choisis):
                        cen = mine.loc[choisis, ["lat", "lng"]].mean()
                        voisins = voisins.assign(d=haversine_m(cen.lat, cen.lng, voisins.lat.to_numpy(),
                                                               voisins.lng.to_numpy())).sort_values("d")
                    reste_q = dict(q)
                    for i in choisis:
                        reste_q[mine.at[i, "canal"]] = reste_q.get(mine.at[i, "canal"], 0) - 1
                    reste_q = {k: max(0, v) for k, v in reste_q.items()}
                    plus = choisir_jour(voisins.head(60), reste_q) if len(voisins) else []
                    plus = plus[:max(0, obj - q["Pushcart"] - len(choisis))]
                    if plus:
                        al.append(f"{len(plus)} PDV d'un secteur voisin de la même zone")
                    choisis += plus
                besoin = obj - q["Pushcart"]
                if len(choisis) < besoin / 2:
                    # Jour presque vide : zone la plus proche du point où il reste des PDV de ce merchandiser
                    libres = mine[~planifie.loc[mine.index] & ~mine.index.isin(choisis)
                                  & mine.canal.isin(["Superette & Boutique", "Aboki & Kiosque", "Porridge"])]
                    cz = libres.groupby("zone_cle").agg(lat=("lat", "mean"), lng=("lng", "mean"), n=("ID_PDV", "size"))
                    cz = cz[cz.n >= besoin / 2]
                    ref = c["Ref"] or (mine.lat.mean(), mine.lng.mean())
                    if len(cz):
                        cz["d"] = haversine_m(ref[0], ref[1], cz.lat.to_numpy(), cz.lng.to_numpy())
                        zr = cz.d.idxmin()
                        if zr != c["Zone"]:
                            choisis = choisir_jour(libres[libres.zone_cle == zr], q)
                            al.append(f"zone du point déjà couverte ou épuisée : jour reporté sur {zr.replace('|', ' › ')} "
                                      f"({cz.at[zr, 'd'] / 1000:.1f} km)")
                            c["Zone"], c["Secteurs"] = zr, sorted(mine.loc[choisis].Cle.unique())
                planifie.loc[choisis] = True
                sel = mine.loc[choisis]
                for i in ordre_visite(sel):
                    r = sel.loc[i]
                    rem = []
                    if r.Cle not in c["Secteurs"]:
                        rem.append("secteur voisin")
                    if r.sans_gps:
                        rem.append("position à valider à la visite")
                    lignes_jour.append({"ID_PDV": r.ID_PDV, "Nom_PDV": r.Nom_PDV, "Type_PDV": r.Type_PDV,
                                        "Secteur": r.Secteur, "Zone": f"{r.Territoire} › {r.Zone}",
                                        "Remarque": " ; ".join(rem), "Cle": r.Cle})
            nb = len(lignes_jour)
            info = infos.loc[m] if m in infos.index else {}
            jours.append({"Zone": c["Zone"].replace("|", " › "), "Merchandiser": m,
                          "Distributeur": info.get("Distributeur", ""), "Sales rep": info.get("Sales rep", ""),
                          "Jour": c["Jour"], "Occurrence": c["Occurrence"], "Point de visite": c["Point"],
                          "SSF": info.get("SSF", ""), "Type SSF": info.get("Type SSF", ""),
                          "Date": dt.isoformat(), "Secteur Friesland": " ; ".join(s.split("|")[2] for s in c["Secteurs"]),
                          "Nb PDV": nb, "Pushcarts à trouver": q["Pushcart"],
                          "Charge (%)": round(100 * (nb + q["Pushcart"]) / obj),
                          "Source": c["Source"], "Alerte": " ; ".join(a for a in al if a)})
            for k, l in enumerate(lignes_jour, 1):
                detail.append({"Merchandiser": m, "Date": dt.isoformat(), "Semaine": c["Occurrence"],
                               "Jour": c["Jour"], "Ordre": k, **{x: l.get(x, "") for x in
                                                                ("ID_PDV", "Nom_PDV", "Type_PDV", "Secteur", "Zone",
                                                                 "Remarque")}})
        # PDV à localiser : relevés pendant les tournées (hors quota), sur un jour de leur zone ou
        # territoire proposé, sinon répartis sur tous les jours ; le 30/11 reste pour le rattrapage.
        loc = a_localiser[a_localiser.Merchandiser == m]
        jours_m = [j for j in jours if j["Merchandiser"] == m and j["Source"] != "visite libre"]
        extra = {j["Date"]: 0 for j in jours_m}
        tour = 0
        for _, r in loc.iterrows():
            zp = f"{r['Territoire proposé']} › {r['Zone proposée']}"
            cands = [j for j in jours_m if r["Zone proposée"] and j["Zone"] == zp] or \
                    [j for j in jours_m if r["Territoire proposé"] and j["Zone"].startswith(r["Territoire proposé"] + " ›")]
            if cands:
                j = min(cands, key=lambda j: (extra[j["Date"]], j["Date"]))
            elif jours_m:
                j = sorted(jours_m, key=lambda j: j["Date"])[tour % len(jours_m)]
                tour += 1
            else:
                continue
            extra[j["Date"]] += 1
            detail.append({"Merchandiser": m, "Date": j["Date"], "Semaine": j["Occurrence"], "Jour": j["Jour"],
                           "Ordre": 900 + extra[j["Date"]], "ID_PDV": r.ID_PDV, "Nom_PDV": r["Nom du PDV"],
                           "Type_PDV": r.Type, "Secteur": r["Secteur proposé"], "Zone": r["Zone proposée"],
                           "Remarque": f"à localiser ({r['Statut final']}) : relever la position si sur le trajet, "
                                       "hors quota"})
        for j in jours_m:
            j["À localiser (hors quota)"] = extra[j["Date"]]
        # 30 novembre : rattrapage (5e lundi, visite libre dans l'app)
        if cfg.get("JOUR_30_NOVEMBRE") == "rattrapage":
            info = infos.loc[m] if m in infos.index else {}
            jours.append({"Zone": "", "Merchandiser": m, "Distributeur": info.get("Distributeur", ""),
                          "Sales rep": info.get("Sales rep", ""), "Jour": "Lundi", "Occurrence": 5,
                          "Point de visite": "Rattrapage (visite libre dans l'app)", "SSF": "", "Type SSF": "",
                          "Date": "2026-11-30", "Secteur Friesland": "", "Nb PDV": 0, "Pushcarts à trouver": 0,
                          "Charge (%)": 0, "Source": "rattrapage",
                          "Alerte": "PDV non visités de novembre et PDV encore à localiser"})
        if file_treich:
            alertes.append(f"{m} : {len(file_treich)} PDV du fichier Treichville non planifiés (quota du jour)")

    rm = pd.DataFrame(jours)
    rm["À localiser (hors quota)"] = rm.get("À localiser (hors quota)", pd.Series(dtype=float)).fillna(0).astype(int)
    rd = pd.DataFrame(detail).sort_values(["Merchandiser", "Date", "Ordre"])
    rd["Ordre"] = rd.groupby(["Merchandiser", "Date"]).cumcount() + 1
    rep = e[~planifie & e.couvert_par.astype(str).ne("")]
    rep = rep[["couvert_par", "ID_PDV", "Nom_PDV", "Type_PDV", "Territoire", "Zone", "Secteur", "prio"]].rename(
        columns={"couvert_par": "Merchandiser", "prio": "Rang de priorité"})
    rep["Raison"] = "capacité du mois"
    sp = sans_position[["ID_PDV", "Nom_PDV", "Type_PDV", "Territoire", "Zone", "Secteur"]].assign(
        Merchandiser=sans_position.Merchandiser, Raison="secteur sans ancrage : pas de position")
    rep = pd.concat([rep, sp], ignore_index=True).sort_values(["Merchandiser", "Rang de priorité"])
    personne = e[e.couvert_par.astype(str).eq("")]
    DATA_OUT.mkdir(parents=True, exist_ok=True)
    rm.to_csv(DATA_OUT / "routing_mensuel_v2.csv", index=False)
    rd.to_csv(DATA_OUT / "routing_detail.csv", index=False)
    rep.to_csv(DATA_OUT / "pdv_reportes.csv", index=False)
    personne[["ID_PDV", "Nom_PDV", "Type_PDV", "Territoire", "Zone", "Secteur", "Distributeur", "Cree_par",
              "raison"]].rename(columns={"raison": "Raison"}).to_csv(
        DATA_OUT / "pdv_sans_merchandiser.csv", index=False)
    pd.Series(alertes, name="Alerte").to_csv(DATA_CACHE / "alertes_13.csv", index=False)
    cmp_ = pd.DataFrame(comparaison)
    cmp_.to_csv(DATA_OUT / "comparaison_methode.csv", index=False)
    if len(cmp_):
        print(f"  trajet moyen par jour : priorité + voisins {cmp_['km priorité + voisins'].mean():.1f} km, "
              f"priorité seule {cmp_['km priorité seule'].mean():.1f} km ({len(cmp_)} jours comparés)")

    # Contrôles
    hors_dim = rm[pd.to_datetime(rm.Date).dt.day_of_week == 6]
    nov = rd[(rd.Date != "2026-11-30") & ~rd.Remarque.str.startswith("à localiser")]
    deux_zones = nov[nov.Remarque != "secteur voisin"].groupby(["Merchandiser", "Date"]).Zone.nunique()
    print(f"  jours : {len(rm)} ; PDV planifiés du 2 au 28 : {len(nov)} (dont sans ID : {(nov.ID_PDV == '').sum()}) ; "
          f"à localiser (hors quota, sur les tournées) : {len(rd) - len(nov)} ; "
          f"reportés : {len(rep)} ; zones sans merchandiser : {len(personne)} PDV")
    print(f"  contrôles : dimanches {len(hors_dim)} ; jours sur deux zones {(deux_zones > 1).sum()} ; "
          f"jours au-dessus du quota {(rm['Charge (%)'] > 100).sum()}")
    print(rm.groupby("Merchandiser").agg(PDV=("Nb PDV", "sum"), jours=("Date", "size"),
                                         charge_moy=("Charge (%)", "mean")).round(0).to_string())
    for a in alertes:
        print("  -", a)


if __name__ == "__main__":
    main()
