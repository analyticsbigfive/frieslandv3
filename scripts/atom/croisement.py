"""Règles du croisement rattachement manuel × GPS récupéré (1.1 ter du brief)."""
from __future__ import annotations

VALIDE = "validé (2 sources)"
CONFLIT = "conflit"
PROVISOIRE = "provisoire"
A_LOCALISER = "à localiser"
GPS_SEUL = "proposé par GPS seul"


def famille(statut_manuel: str) -> str:
    s = (statut_manuel or "").upper()
    if s.startswith("CONFLIT"):
        return "CONFLIT"
    if s.startswith("CONFIRMABLE") or s.startswith("PROPOSÉ") or s.startswith("PROPOSE"):
        return "PROPOSE"
    if s.startswith("TERRITOIRE SEUL"):
        return "TERRITOIRE"
    if s.startswith("NON RATTACH"):
        return "NON"
    raise ValueError(f"statut de rattachement inconnu : {statut_manuel!r}")


def statut_final(statut_manuel: str, cle_manuelle: str | None, territoire_manuel: str | None,
                 cle_gps: str | None, territoire_gps: str | None, confiance_gps: str | None) -> tuple[str, str, str]:
    """Renvoie (statut final, clé de secteur retenue ou '', note).

    Seul un GPS de confiance haute ou moyenne compte ; « ambigu » vaut « aucun ».
    """
    f = famille(statut_manuel)
    gps_ok = confiance_gps in ("haute", "moyenne") and bool(cle_gps)
    if f == "CONFLIT":
        return CONFLIT, cle_manuelle or "", "conflit dans le rattachement manuel : jamais routé sans validation"
    if f == "PROPOSE":
        if not gps_ok:
            return PROVISOIRE, cle_manuelle or "", "position à valider à la visite"
        if cle_gps == cle_manuelle:
            return VALIDE, cle_manuelle or "", "secteur manuel confirmé par le GPS des visites"
        return CONFLIT, cle_manuelle or "", f"le GPS des visites donne un autre secteur : {cle_gps}"
    if f == "TERRITOIRE":
        if gps_ok and territoire_gps == territoire_manuel:
            return PROVISOIRE, cle_gps, "secteur donné par le GPS des visites ; position à valider à la visite"
        if gps_ok:
            return A_LOCALISER, "", f"GPS des visites hors du territoire proposé ({territoire_gps})"
        return A_LOCALISER, "", "territoire seul, pas de GPS"
    # NON RATTACHÉ
    if gps_ok and confiance_gps == "haute":
        return GPS_SEUL, cle_gps, "à faire valider par Jean Luc"
    if gps_ok:
        return A_LOCALISER, "", f"GPS des visites de confiance moyenne ({cle_gps}) : non retenu seul"
    return A_LOCALISER, "", "aucune information de position"


def routable(statut: str, statuts_admis: list[str]) -> bool:
    return statut in statuts_admis
