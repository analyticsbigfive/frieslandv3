"""Étape 0 : récupérer les sources dans data/in/ et les contrôler.

- Sheets publics : export CSV / xlsx (gardés en cache ; --force pour retélécharger).
- Routing mensuel : l'export public renvoie 401, on lit la copie Drive locale.
- Fichiers joints (rattachement des 407, note à l'agence) : copiés tels quels, jamais modifiés.
- Copies Drive locales : comparées aux exports, ligne à ligne. Un écart arrête tout.
"""
from __future__ import annotations

import csv
import io
import shutil
import sys

import openpyxl
import requests

from atom.commun import chemin, config


def arret(msg: str) -> None:
    print(f"ARRÊT : {msg}")
    sys.exit(1)


def telecharger(nom: str, src: dict, force: bool) -> None:
    dest = chemin(src["fichier"])
    if dest.exists() and not force:
        print(f"  {nom} : en cache ({dest.stat().st_size} o)")
        return
    r = requests.get(src["url"], timeout=120, allow_redirects=True)
    type_ = r.headers.get("content-type", "")
    attendu = "text/csv" if dest.suffix == ".csv" else "spreadsheetml"
    if r.status_code != 200 or attendu not in type_:
        arret(f"téléchargement de « {nom} » refusé (HTTP {r.status_code}, {type_.split(';')[0]}). "
              "Page de connexion au lieu des données ?")
    dest.write_bytes(r.content)
    print(f"  {nom} : téléchargé ({len(r.content)} o)")


def lignes_xlsx(p, onglet: str) -> list[tuple]:
    wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
    if onglet not in wb.sheetnames:
        arret(f"onglet « {onglet} » absent de {p}")
    rows = []
    for r in wb[onglet].iter_rows(values_only=True):
        r = tuple("" if c is None else str(c).strip() for c in r)
        if any(r):
            rows.append(r)
    return rows


def lignes_csv(p) -> list[tuple]:
    with open(p, encoding="utf-8-sig", newline="") as f:
        return [tuple(c.strip() for c in r) for r in csv.reader(f) if any(c.strip() for c in r)]


def canon(r: tuple) -> tuple:
    """Ligne comparable : nombres « 13.0 » = « 13 », cellules vides finales retirées."""
    out = []
    for c in r:
        if c.endswith(".0") and c[:-2].lstrip("-").isdigit():
            c = c[:-2]
        out.append(c)
    while out and out[-1] == "":
        out.pop()
    return tuple(out)


def controler_entetes(nom: str, entete: tuple, attendues: list[str]) -> None:
    manquantes = [c for c in attendues if c not in entete]
    if manquantes:
        arret(f"« {nom} » : colonnes absentes {manquantes}")


def main() -> None:
    force = "--force" in sys.argv
    cfg = config()
    S = cfg["SOURCES"]
    for d in ("data/in", "data/ref", "data/cache", "data/out"):
        chemin(d).mkdir(parents=True, exist_ok=True)

    print("Sheets publics")
    for nom, src in S.items():
        if "url" in src:
            telecharger(nom, src, force)

    print("Fichiers locaux")
    for nom, src in S.items():
        if "local" not in src:
            continue
        local = chemin(src["local"])
        if not local.exists():
            arret(f"« {nom} » introuvable : {local}")
        dest = chemin(src["fichier"])
        if nom == "routing_mensuel":
            rows = [canon(r) for r in lignes_xlsx(local, "Routing")]
            buf = io.StringIO()
            csv.writer(buf).writerows(rows)
            dest.write_text(buf.getvalue(), encoding="utf-8")
            print(f"  {nom} : {len(rows) - 1} lignes converties en CSV")
        else:
            shutil.copyfile(local, dest)
            print(f"  {nom} : copié tel quel")

    print("Contrôle des en-têtes")
    for nom, src in S.items():
        if src.get("entetes") and chemin(src["fichier"]).suffix == ".csv":
            controler_entetes(nom, lignes_csv(chemin(src["fichier"]))[0], src["entetes"])
    wb = openpyxl.load_workbook(chemin(S["atom_xlsx"]["fichier"]), read_only=True)
    for o in S["atom_xlsx"]["onglets"]:
        if o not in wb.sheetnames:
            arret(f"onglet « {o} » absent du classeur ATOM")
    print("  ok")

    print("Copies Drive locales contre exports")
    for c in cfg.get("COPIES_A_CONTROLER", []):
        local = chemin(c["local"])
        if not local.exists():
            print(f"  {local.name} : absent, contrôle sauté")
            continue
        a = {canon(r) for r in lignes_xlsx(local, c["onglet"])}
        ref = chemin(S[c["contre"]]["fichier"])
        b = {canon(r) for r in (lignes_xlsx(ref, c["onglet"]) if ref.suffix == ".xlsx" else lignes_csv(ref))}
        if a != b:
            arret(f"{local.name} diffère de l'export « {c['contre']} » "
                  f"({len(a - b)} lignes en plus, {len(b - a)} en moins)")
        print(f"  {local.name} [{c['onglet']}] = {c['contre']} ({len(a)} lignes)")

    print("Contrôle ORDRE_INCHANGÉ = découpage définitif")
    ordre = [canon(r[:5]) for r in lignes_xlsx(chemin(S["rattachement_407"]["fichier"]), "ORDRE_INCHANGÉ")]
    dec = [canon(r[:5]) for r in lignes_csv(chemin(S["decoupage_definitif"]["fichier"]))]
    if ordre != dec:
        diff = [i + 1 for i, (x, y) in enumerate(zip(ordre, dec)) if x != y]
        arret(f"ORDRE_INCHANGÉ diffère du découpage (lignes {diff[:10]}, {len(ordre)} contre {len(dec)})")
    print(f"  identiques ({len(dec) - 1} secteurs)")


if __name__ == "__main__":
    main()
