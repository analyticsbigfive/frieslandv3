"""Étape 15 : RAPPORT.md — chiffres clés, méthode, hypothèses et questions ouvertes.

Tous les chiffres sont lus dans les fichiers de data/out/. Sortie : data/out/RAPPORT.md
"""
from __future__ import annotations

import pandas as pd

from atom.commun import DATA_OUT, DATA_REF, config


def n(x) -> str:
    return f"{int(x):,}".replace(",", " ")


def main() -> None:
    cfg = config()
    ps = pd.read_csv(DATA_OUT / "pdv_secteurs.csv", dtype=str).fillna("")
    x = pd.read_csv(DATA_OUT / "rattachement_407_croise.csv", dtype=str).fillna("")
    rec = pd.read_csv(DATA_OUT / "gps_recuperes.csv", dtype=str).fillna("")
    an = pd.read_csv(DATA_OUT / "anomalies.csv", dtype=str).fillna("")
    rm = pd.read_csv(DATA_OUT / "routing_mensuel_v2.csv", dtype=str).fillna("")
    rd = pd.read_csv(DATA_OUT / "routing_detail.csv", dtype=str).fillna("")
    rd30 = rd[rd.Remarque.str.startswith("à localiser")]
    rd = rd[~rd.Remarque.str.startswith("à localiser")]
    cmp_ = pd.read_csv(DATA_OUT / "comparaison_methode.csv")
    rep = pd.read_csv(DATA_OUT / "pdv_reportes.csv", dtype=str).fillna("")
    sm = pd.read_csv(DATA_OUT / "pdv_sans_merchandiser.csv", dtype=str).fillna("")
    cap = pd.read_csv(DATA_OUT / "capacite.csv")
    pps = pd.read_csv(DATA_OUT / "pdv_par_secteur.csv")
    man = pd.read_csv(DATA_REF / "couverture_manuelle.csv", dtype=str).fillna("")

    rang = ps[ps.Cle != ""]
    el = x[x.Routable == "oui"]
    jours = rm[rm.Source != "rattrapage"]
    L = ["# Rapport : PDV ATOM, découpage Friesland et routing de novembre 2026", "",
         "Préparé le 29/10/2026 pour Jean-Luc Houédanou (Big Five Solutions). Fichiers : `data/out/`.", "",
         "## 1. Chiffres clés", "",
         f"- **PDV ATOM** : {n(len(ps))} PDV distincts (9 693 lignes ; 14 répétées à l'identique, 11 ID en double).",
         f"- **Rangés dans un secteur Friesland** : {n(len(rang))} ; sans secteur : {n(len(ps) - len(rang))}.",
         f"- **Secteurs** : {(pps.PDV > 0).sum()} sur 306 ont au moins un PDV ; "
         f"{(pps.Ancrage != 'aucun').sum()} ont un ancrage (point de référence).",
         f"- **Confiance du rangement** : " + ", ".join(
             f"{k} {n(v)}" for k, v in rang.Confiance.replace("", "rattachement manuel").value_counts().items()) + ".",
         f"- **407 PDV sans GPS** : " + ", ".join(f"{k} {v}" for k, v in x["Statut final"].value_counts().items())
         + f" ; {len(el)} éligibles au routing ({el.ID_PDV.isin(rd.ID_PDV).sum()} planifiés en novembre, "
           f"{el.ID_PDV.isin(rep.ID_PDV).sum()} reportés, {el.ID_PDV.isin(sm.ID_PDV).sum()} sans "
           f"merchandiser) ; {(x.Routable == 'non').sum()} à localiser ou à valider.",
         f"- **GPS retrouvés par les visites** : {(rec.Resultat == 'GPS récupéré').sum()} ; "
         f"ambigus {rec.Resultat.str.startswith('ambigu').sum()} ; "
         f"visités sans aucun GPS {(rec.Resultat == 'visité, jamais avec GPS').sum()}.",
         f"- **Routing** : {len(jours)} journées datées du 2 au 28 novembre pour {rm.Merchandiser.nunique()} "
         f"merchandisers, {n(len(rd))} visites planifiées ; {n(len(rep))} PDV reportés, dont {n((rep.Raison == 'capacité du mois').sum())} par manque de place ; "
         f"{n(len(sm))} PDV éligibles sans merchandiser ; {n(len(rd30))} PDV à localiser répartis sur les tournées "
         f"(hors quota). Le 30 novembre est une journée de rattrapage.",
         f"- **Distributeur** : aucun PDV planifié chez un autre distributeur que celui de son merchandiser "
         f"(règle stricte du 29/10).", "",
         "## 2. Capacité par merchandiser", "",
         f"Quota : règle Atom actuelle (lundi–jeudi 20, vendredi 15, samedi 10 ; 2 pushcarts à trouver par jour "
         f"du lundi au jeudi). Capacité : {int(cap['Capacité / mois'].iloc[0])} PDV par mois.", "",
         "| Merchandiser | Distributeur | PDV à couvrir | Charge | Planifiés | Reportés | Rythme réel (médiane / jour) |",
         "|---|---|---:|---:|---:|---:|---:|"]
    for _, r in cap.iterrows():
        pl = rd[(rd.Merchandiser == r.Merchandiser) & ~rd.Remarque.str.startswith("à localiser")]
        L.append(f"| {r.Merchandiser} | {r.Distributeur} | {n(r['PDV à couvrir'])} | {r.Ratio:g} × | {n(len(pl))} | "
                 f"{n((rep.Merchandiser == r.Merchandiser).sum())} | {r.médiane:g} |")
    L += ["", "« PDV à couvrir » : PDV éligibles situés dans les secteurs que le merchandiser couvre. Les reportés passent "
          "en tête du mois suivant (`pdv_reportes.csv`, rang de priorité).", "",
          "## 3. Méthode", "",
          "1. **Sources contrôlées** : copies Drive identiques aux exports ; `ORDRE_INCHANGÉ` identique au découpage. "
          "Le routing mensuel (export public refusé, 401) est lu dans la copie Drive.",
          "2. **Géométrie** : limites OpenStreetMap (communes d'Abidjan ; sous-préfectures à l'intérieur, les "
          "départements étant inutilisables). Ancrage de chaque secteur : médiane des PDV ATOM qui portent son nom, "
          "sinon géocodage Nominatim vérifié (nom, commune, distance à la zone). Voronoï découpé par commune.",
          "3. **Rangement** : point dans le secteur. Les colonnes Zone / Commune / Quartier d'ATOM ne servent qu'au "
          "contrôle (confiance, alertes).",
          "4. **GPS des 407** : visites reliées par ID (onglet `Rapports_BR`), sinon nom + téléphone, sinon nom + "
          "merchandiser ; jamais par le téléphone seul. Les visites enregistrées depuis un même point pour plusieurs "
          "PDV éloignés ne servent pas à placer un PDV.",
          "5. **Distributeur (règle stricte)** : le distributeur d'un PDV est celui de ses visites. Un PDV n'est "
          "planifié qu'avec un merchandiser de ce distributeur ; s'il y en a deux (Niare, Sidecom), celui qui a le "
          "plus de jours sur le secteur. PDV au distributeur inconnu : merchandiser du secteur.",
          "6. **Routing** : chaque jour garde son point de visite actuel et les secteurs Friesland qui lui "
          "correspondent, dans une seule zone. On part du PDV le plus prioritaire (jamais visité, puis visite la plus "
          "ancienne), puis on prend les plus proches qui remplissent encore un quota. Jour trop court : secteur voisin "
          "de la même zone. Ordre de passage : plus proche voisin. "
          f"Trajet moyen par jour : {cmp_['km priorité + voisins'].mean():.1f} km, contre "
          f"{cmp_['km priorité seule'].mean():.1f} km avec la priorité seule ({len(cmp_)} jours comparés, "
          "`comparaison_methode.csv`).", "",
          "## 4. Décisions prises et hypothèses", "",
          "- Quota : règle Atom actuelle (décidé le 29/10). Capacité dépassée : priorité, en gardant des PDV voisins.",
          "- 30 novembre : journée de rattrapage (visite libre dans l'app).",
          "- PDV « PROPOSÉ » du rattachement manuel : routés comme `provisoire`, position à valider à la visite.",
          "- « KOUADIO ATTOFE GUY » = Kouadio Annicet. Diabaté et Akedan retirés : leurs PDV vont au merchandiser qui "
          "couvre le secteur.",
          *[f"- {r.Territoire}{' › ' + r.Zone if r.Zone else ''} confié à {r.Merchandiser} ({r.Decision})."
            for r in man.itertuples()],
          f"- Jours fériés : {cfg.get('JOURS_FERIES') or 'aucun'} (1er et 15 novembre tombent un dimanche ; "
          "lundi 2 novembre travaillé selon le ministère de l'Emploi).",
          "- Table territoire → communes (`data/ref/territoire_communes.csv`) : établie par nous, **à valider**.", "",
          "## 5. Questions ouvertes", "",
          "**Pour Jean-Luc / Friesland**",
          "- **PDV éligibles sans merchandiser** (`pdv_sans_merchandiser.csv`) : " + "; ".join(
              f"{k} ({v})" for k, v in sm.Raison.value_counts().items()) + ". Par territoire : " + ", ".join(
              f"{t} {v}" for t, v in sm.Territoire.value_counts().head(6).items())
          + ". Dynamys (Bingerville) et SDTP (Port-Bouët 2, Bassam, Bonoua) n'ont aucun merchandiser dans le routing.",
          "- **Jours modifiés par rapport au routing actuel** (`routing_mensuel_v2.csv`, colonne Alerte) : jours "
          "donnés à une zone sans jour (Bingerville, PDV d'un distributeur dans une zone voisine), jours dont la zone "
          "était épuisée. À valider.",
          "- Zones partagées entre deux merchandisers (Cocody 1, Abobo 1, Yopougon 1 › Wassakara…) : le secteur va à "
          "celui qui y a le plus de jours (`secteurs_merchandisers.csv`). À confirmer.",
          f"- Treichville : le fichier dédié (283 PDV, sans GPS) remplace les 8 jours Treichville de Gui, au quota du "
          f"jour ; le reste est reporté. Faut-il garder le rythme du fichier (35 à 53 PDV par jour) ?",
          "- 136 secteurs n'ont aucun PDV ATOM (intérieur, Anyama, périphéries de Yopougon) ; 110 secteurs n'ont pas "
          "d'ancrage. Une liste de lieux de référence par secteur améliorerait la carte.",
          "- Charger ce routing dans l'app (routing_mensuel et moteur des tournées) ou seulement l'envoyer en fichiers ?",
          "", "**Pour ATOM**",
          "- Justificatifs des 407 PDV sans GPS (voir la note de contrôle) ; relevé des PDV à localiser pendant les "
          "tournées.", "",
          "## 6. Tablettes Samsung Galaxy Tab A11", "",
          "- Faire vérifier le numéro de modèle de chaque tablette : **Paramètres → À propos de la tablette → Numéro "
          "de modèle**.",
          "- SM-X135 / SM-X133 : modèle cellulaire, avec puce GPS. SM-X130 : Wi-Fi seul, position par les réseaux "
          "Wi-Fi, moins précise hors des zones denses. Si des SM-X130 sont utilisées hors d'Abidjan, recommander des "
          "tablettes cellulaires. La Play Console montre « Samsung gta11 », sans suffixe « wifi » : probablement des "
          "modèles cellulaires. L'app 1.0.17 enregistrera le modèle à chaque visite.",
          "- Précision exigée (`gps_precision_min_m`) : 50 m, réglable depuis le dashboard (100 m possible).", "",
          "**Test manuel sur une vraie Galaxy Tab (1.0.17)**",
          "1. Couper la localisation (panneau rapide) puis démarrer une visite : la visite est bloquée et l'aide "
          "« La localisation de la tablette est coupée » s'affiche.",
          "2. Rallumer la localisation et appuyer sur « Réessayer » : la visite démarre.",
          "3. Refuser l'autorisation de position à l'app : blocage et aide « autorisation ».",
          "4. Visiter un PDV à plus de 100 m de sa position : la question « Êtes-vous bien devant… ? » apparaît ; "
          "« Oui » remplace la position du PDV (visible dans « Positions à vérifier » au-delà de 500 m).", "",
          "## 7. Anomalies", "", "| Type | Nombre |", "|---|---:|"]
    for k, v in an.Type.value_counts().items():
        L.append(f"| {k} | {v} |")
    (DATA_OUT / "RAPPORT.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"  RAPPORT.md : {len(L)} lignes")


if __name__ == "__main__":
    main()
