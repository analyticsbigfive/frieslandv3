"""Étape 21 : pièces jointes de l'email à ATOM, sans les colonnes internes.

Sortie : data/out/envoi_atom/ (et une copie dans ~/Downloads/Envoi ATOM 2026-10-30/)
"""
from __future__ import annotations

import shutil
from pathlib import Path

import pandas as pd

from atom.commun import DATA_OUT, chemin, config

DEST = DATA_OUT / "envoi_atom"
COPIE = Path("~/Downloads/Envoi ATOM 2026-10-30").expanduser()


def main() -> None:
    cfg = config()
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir(parents=True)

    rm = pd.read_csv(DATA_OUT / "routing_mensuel_v2.csv", dtype=str).fillna("")
    rm = rm.rename(columns={"Occurrence": "Semaine"})
    rm[["Date", "Jour", "Semaine", "Merchandiser", "Distributeur", "Sales rep", "SSF", "Type SSF", "Zone",
        "Point de visite", "Secteur Friesland", "Nb PDV", "Pushcarts à trouver", "À localiser (hors quota)",
        "Charge (%)"]].to_csv(DEST / "routing_mensuel_v2.csv", index=False)

    rd = pd.read_csv(DATA_OUT / "routing_detail.csv", dtype=str).fillna("")
    rd.to_csv(DEST / "routing_detail.csv", index=False)

    loc = pd.read_csv(DATA_OUT / "pdv_a_localiser_par_merchandiser.csv", dtype=str).fillna("")
    loc = loc.drop(columns=["Créé par", "Attribution", "Note du croisement"], errors="ignore")
    loc.to_csv(DEST / "pdv_a_localiser_par_merchandiser.csv", index=False)

    al = pd.read_excel(chemin(cfg["SOURCES"]["rattachement_407"]["fichier"]), sheet_name="ALERTES_AGENCE", dtype=str)
    al.fillna("").to_csv(DEST / "alertes_agence.csv", index=False)

    shutil.copyfile(chemin(cfg["SOURCES"]["note_agence"]["fichier"]), DEST / "note_agence_anomalies.docx")
    for f in ("carte_merchandisers.html", "aide_gps_galaxy_tab.md", "EMAIL_ATOM.md"):
        shutil.copyfile(DATA_OUT / f, DEST / f)

    if COPIE.exists():
        shutil.rmtree(COPIE)
    shutil.copytree(DEST, COPIE)
    print(f"  {len(list(DEST.iterdir()))} fichiers dans {DEST} et {COPIE}")
    for f in sorted(DEST.iterdir()):
        print(f"   - {f.name} ({f.stat().st_size // 1024} Ko)")


if __name__ == "__main__":
    main()
