"""Étape 20 (phase 4) : email à l'agence ATOM, prêt à copier. Rien n'est envoyé.

Tous les chiffres viennent des fichiers de sortie. Ce qui manque est indiqué en tête.
Sortie : data/out/EMAIL_ATOM.md (+ data/out/aide_gps_galaxy_tab.md)
"""
from __future__ import annotations

import re
import shutil

import pandas as pd

from atom.commun import DATA_OUT, DATA_REF

# Chiffres de la note de contrôle jointe (source n°7), repris tels quels.
NOTE = {"sans_gps": 407, "proposes": 185, "territoire_seul": 19, "impossibles": 203, "discordances": 77}


def nb(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def main() -> None:
    manque = []
    x = pd.read_csv(DATA_OUT / "rattachement_407_croise.csv", dtype=str).fillna("")
    rd_path = DATA_OUT / "routing_detail.csv"
    rd = pd.read_csv(rd_path, dtype=str).fillna("") if rd_path.exists() else pd.DataFrame(columns=["ID_PDV", "Remarque"])
    planif = set(rd[~rd.Remarque.str.startswith("à localiser")].ID_PDV)
    eligibles = x[x.Routable == "oui"]
    planifies = int(eligibles.ID_PDV.isin(planif).sum())
    sm_path = DATA_OUT / "pdv_sans_merchandiser.csv"
    sans_m = set(pd.read_csv(sm_path, dtype=str).ID_PDV) if sm_path.exists() else set()
    sans_merch = int(eligibles.ID_PDV.isin(sans_m).sum())
    reportes = len(eligibles) - planifies - sans_merch
    a_localiser = int((x["Statut final"] == "à localiser").sum())
    a_valider = int(x["Statut final"].isin(["conflit", "proposé par GPS seul"]).sum())
    pj = ["note de contrôle (`note_agence_anomalies.docx`)",
          "onglet `ALERTES_AGENCE` du rattachement des 407 PDV (`alertes_agence.csv`)",
          "`pdv_a_localiser_par_merchandiser.csv`"]
    for f in ("routing_mensuel_v2.csv", "routing_detail.csv", "carte_merchandisers.html"):
        if (DATA_OUT / f).exists():
            pj.append(f"`{f}`")
        else:
            manque.append(f"`{f}` (phase 2 pas terminée)")
    shutil.copyfile(DATA_REF / "aide_gps_galaxy_tab.md", DATA_OUT / "aide_gps_galaxy_tab.md")
    pj.append("étapes pour activer la localisation sur la Galaxy Tab A11 (`aide_gps_galaxy_tab.md`)")

    corps = f"""Bonjour,

**1. Découpage.** Le découpage sectoriel de FrieslandCampina (territoire, zone, secteur, commercial) est désormais la seule référence ; les anciennes zones ATOM ne s'appliquent plus.

**2. Routing.** Il commence le lundi 2 novembre 2026. Chaque merchandiser du routing a son planning daté, avec ses PDV, toujours chez son distributeur. Pour novembre, ce planning joint fait foi.

**3. GPS obligatoire.** Avec la prochaine mise à jour de l'application (date communiquée à part), aucune visite ne sera possible sans localisation. Un merchandiser éloigné de la position enregistrée pourra visiter après confirmation ; sa position deviendra celle du PDV.

**4. PDV sans GPS.** La note de contrôle jointe porte sur {NOTE['sans_gps']} PDV sans GPS : {NOTE['proposes']} rattachements proposés, {NOTE['territoire_seul']} territoires sans secteur, {NOTE['impossibles']} rattachements impossibles et {NOTE['discordances']} discordances de territoire. Ces écarts ne prouvent pas que des relevés soient fictifs. Après croisement avec les visites, {len(eligibles)} sont rattachables : {planifies} sont planifiés en novembre, {reportes} reportés, {sans_merch} en zone sans merchandiser. {a_localiser} sont à localiser pendant les tournées (liste jointe) ; {a_valider} attendent notre validation.

**5. Merci de :**
- confirmer la réception et transmettre son planning à chaque merchandiser avant le 2 novembre ;
- envoyer le numéro de modèle de chaque tablette (Paramètres → À propos de la tablette → Numéro de modèle) ;
- vérifier que la localisation est activée sur toutes les tablettes (étapes jointes) ;
- envoyer les justificatifs de la note et le nom du responsable du plan de correction, d'ici le samedi 14 novembre.

Cordialement,

Jean-Luc Houédanou
Big Five Solutions"""
    mots = len(re.findall(r"[\wÀ-ÿ’'-]+", re.sub(r"\*\*", "", corps)))
    entete = []
    if manque:
        entete = ["> **À compléter avant envoi** : " + " ; ".join(manque) + ".", ""]
    entete += ["> Date de retour proposée : samedi 14 novembre (fin de la semaine 2), à valider.",
               f"> {mots} mots hors pièces jointes. Rien n'a été envoyé.", ""]
    md = "\n".join(entete + [
        "**Objet :** Nouveau découpage FrieslandCampina et routing du lundi 2 novembre 2026", "", corps, "",
        "---", "", "**Pièces jointes**", ""] + [f"- {p}" for p in pj]) + "\n"
    (DATA_OUT / "EMAIL_ATOM.md").write_text(md, encoding="utf-8")
    print(f"  EMAIL_ATOM.md : {mots} mots ; éligibles {len(eligibles)} (planifiés {planifies}, reportés {reportes}) ; "
          f"à localiser {a_localiser} ; à valider {a_valider} ; manque : {manque or 'rien'}")


if __name__ == "__main__":
    main()
