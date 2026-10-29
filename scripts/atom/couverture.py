"""Quel merchandiser couvre un secteur (pour attribuer les PDV des merchandisers retirés)."""
from __future__ import annotations

from collections import Counter, defaultdict

import pandas as pd


class Couverture:
    """Règles, de la plus sûre à la plus large :
    0. décision de Jean Luc pour le territoire ou la zone (couverture_manuelle.csv) ;
    1. merchandiser dont le routing actuel passe par le secteur (le plus de points de visite) ;
    2. sinon celui qui a créé le plus de PDV dans le secteur ;
    3. sinon les deux mêmes règles au niveau de la zone ;
    4. sinon personne (anomalie).
    À égalité, le créateur du plus de PDV départage, puis l'ordre alphabétique (signalé).
    """

    def __init__(self, points: pd.DataFrame, pdv: pd.DataFrame, admis: set[str],
                 manuelle: pd.DataFrame | None = None):
        # Décisions de Jean Luc (data/ref/couverture_manuelle.csv) : elles passent avant les règles.
        self.manuelle = {}
        if manuelle is not None:
            for t, z, m, d in zip(manuelle.Territoire, manuelle.Zone, manuelle.Merchandiser, manuelle.Decision):
                self.manuelle[(t, z or "")] = (m, d)
        self.pts_s, self.pts_z = defaultdict(Counter), defaultdict(Counter)
        for m, secteurs in zip(points.Merchandiser, points.Secteurs):
            for c in filter(None, str(secteurs).split(" ; ")):
                self.pts_s[c][m] += 1
                self.pts_z[c.rsplit("|", 1)[0]][m] += 1
        self.crea_s, self.crea_z = defaultdict(Counter), defaultdict(Counter)
        for m, c in zip(pdv.Merchandiser, pdv.Cle):
            if m in admis and isinstance(c, str) and c:
                self.crea_s[c][m] += 1
                self.crea_z[c.rsplit("|", 1)[0]][m] += 1
        self.terr = defaultdict(Counter)
        for z, cnt in self.pts_z.items():
            self.terr[z.split("|")[0]].update(cnt)

    @staticmethod
    def _premier(cnt: Counter, depart: Counter) -> tuple[str, bool]:
        top = max(cnt.values())
        ex = [m for m, n in cnt.items() if n == top]
        if len(ex) == 1:
            return ex[0], False
        ex.sort(key=lambda m: (-depart.get(m, 0), m))
        return ex[0], depart.get(ex[0], 0) == depart.get(ex[1], 0)

    def manuel(self, territoire: str | None, zone: str | None = None) -> tuple[str, str] | None:
        for k in ((territoire, zone or ""), (territoire, "")):
            if k in self.manuelle:
                return self.manuelle[k][0], "décision de Jean Luc"
        return None

    def choisir(self, cle: str | None, territoire: str | None = None) -> tuple[str, str]:
        t, z = (cle.split("|")[0], cle.split("|")[1]) if cle else (territoire, None)
        if (m := self.manuel(t, z)):
            return m
        if cle:
            zone = cle.rsplit("|", 1)[0]
            for cnt, dep, nom in ((self.pts_s[cle], self.crea_s[cle], "routing du secteur"),
                                  (self.crea_s[cle], Counter(), "premier créateur du secteur"),
                                  (self.pts_z[zone], self.crea_z[zone], "routing de la zone"),
                                  (self.crea_z[zone], Counter(), "premier créateur de la zone")):
                if cnt:
                    m, egal = self._premier(cnt, dep)
                    return m, nom + (" (égalité)" if egal else "")
        if territoire and self.terr[territoire]:
            m, egal = self._premier(self.terr[territoire], Counter())
            return m, "routing du territoire proposé" + (" (égalité)" if egal else "")
        return "", "aucun merchandiser ne couvre ce secteur"
