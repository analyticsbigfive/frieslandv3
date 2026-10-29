import importlib

import pytest

from atom.commun import cle_secteur, confiance_gps_visites, gps, gps_texte, norm, tel8
from atom.croisement import A_LOCALISER, CONFLIT, GPS_SEUL, PROVISOIRE, VALIDE, routable, statut_final

secteurs = importlib.import_module("04_secteurs")


# ---------------------------------------------------------------- clé de secteur

def test_cle_distingue_les_homonymes():
    cles = {cle_secteur("KOUMASSI", "KOUMASSI 2", "SICOGI"), cle_secteur("MARCORY", "MARCORY 2", "SICOGI"),
            cle_secteur("BINGERVILLE", "GBAGBA", "SICOGI"), cle_secteur("YOPOUGON 1", "WASSAKARA", "SICOGI")}
    assert len(cles) == 4


def test_port_bouet_2_secteur_de_yopougon_3():
    assert cle_secteur("YOPOUGON 3", "SIPOREX / PORT-BOUËT 2 / ANANERAIE", "PORT-BOUËT 2") != \
        cle_secteur("PORT-BOUËT 2", "PORT-BOUËT 2", "GONZAGUEVILLE")


def test_cle_incomplete_refusee():
    with pytest.raises(ValueError):
        cle_secteur("COCODY", "", "PALMERAIE")


# ---------------------------------------------------------------- GPS

@pytest.mark.parametrize("lat,lng,attendu", [
    ("5,390722", "-3,945571", (5.390722, -3.945571, "ok")),
    ("5.390722", "-3.945571", (5.390722, -3.945571, "ok")),
    ("-3.945571", "5.390722", (5.390722, -3.945571, "inversé")),
    ("0", "", (None, None, "vide")),
    ("0", "0", (None, None, "vide")),
    ("", "", (None, None, "vide")),
    ("48.85", "2.35", (None, None, "hors CI")),
    ("abc", "-4", (None, None, "illisible")),
])
def test_gps(lat, lng, attendu):
    assert gps(lat, lng) == attendu


def test_gps_texte_virgule():
    assert gps_texte("5.371857, -4.012246") == (5.371857, -4.012246, "ok")
    assert gps_texte("5,371857, -4,012246") == (5.371857, -4.012246, "ok")
    assert gps_texte("") == (None, None, "vide")
    assert gps_texte(None) == (None, None, "vide")


def test_tel8():
    assert tel8("0788603611") == "88603611"
    assert tel8("788603611.0") == "88603611"
    assert tel8("+225 07 88 60 36 11") == "88603611"
    assert tel8("Diallo Armed") is None


def test_norm():
    assert norm("Boutique chez Moussa !") == norm("boutique CHEZ moussa")
    assert norm("Koweït") == "koweit"


def test_groupement_100m():
    proches = [(5.3500, -4.0200), (5.3502, -4.0201), (5.3501, -4.0199)]
    assert confiance_gps_visites(proches, 100, 2 / 3)["confiance"] == "haute"
    deux_tiers = proches[:2] + [(5.3600, -4.0300)]
    assert confiance_gps_visites(deux_tiers, 100, 2 / 3)["confiance"] == "moyenne"
    eparpilles = [(5.35, -4.02), (5.36, -4.03), (5.37, -4.04)]
    assert confiance_gps_visites(eparpilles, 100, 2 / 3)["confiance"] == "ambigu"


# ---------------------------------------------------------------- noms de secteurs

def test_nom_secteur_inclus_dans_le_quartier():
    j = secteurs.jetons
    assert secteurs.nom_contient(j("SICOGI"), j("Sicogi 2 pharmacie"))
    assert secteurs.nom_contient(j("8ÈME TRANCHE"), j("Angré 8e tranche"))
    assert not secteurs.nom_contient(j("YOPOUGON SABLE"), j("Yopougon"))
    assert not secteurs.nom_contient(j("KOUMASSI 32"), j("Koumassi 05"))


def test_noms_avec_apostrophe():
    j = secteurs.jetons
    for ecrit in ("N'Dotré extension", "N dotre extension", "Ndotré extension", "N’DOTRÉ EXTENSION"):
        assert secteurs.nom_contient(j("N'DOTRÉ EXTENSION"), j(ecrit)), ecrit
    assert secteurs.nom_contient(j("M'POUTO"), j("Riviera Mpouto"))


def test_le_nom_le_plus_precis_gagne():
    cands = [("A", secteurs.jetons("SANTÉ")), ("B", secteurs.jetons("YOPOUGON SANTÉ"))]
    assert secteurs.correspondances("Yopougon santé carrefour", cands) == ["B"]
    assert secteurs.correspondances("Santé", cands) == ["A"]


# ---------------------------------------------------------------- croisement des 407

C = "PORT-BOUËT 2|PORT-BOUËT 2|GONZAGUEVILLE"
D = "PORT-BOUËT 2|PORT-BOUËT 5|TERRE ROUGE"


@pytest.mark.parametrize("manuel,cle_m,terr_m,cle_g,terr_g,conf,attendu", [
    ("CONFIRMABLE — SOURCE GÉOGRAPHIQUE", C, "PORT-BOUËT 2", C, "PORT-BOUËT 2", "haute", VALIDE),
    ("PROPOSÉ — QUARTIER / REPÈRE", C, "PORT-BOUËT 2", D, "PORT-BOUËT 2", "moyenne", CONFLIT),
    ("PROPOSÉ — À CONTRÔLER", C, "PORT-BOUËT 2", None, None, None, PROVISOIRE),
    ("PROPOSÉ — QUARTIER / REPÈRE", C, "PORT-BOUËT 2", C, "PORT-BOUËT 2", "ambigu", PROVISOIRE),
    ("TERRITOIRE SEUL — SECTEUR À IDENTIFIER", None, "PORT-BOUËT 2", D, "PORT-BOUËT 2", "haute", PROVISOIRE),
    ("TERRITOIRE SEUL — SECTEUR À IDENTIFIER", None, "PORT-BOUËT 2", D, "COCODY", "haute", A_LOCALISER),
    ("TERRITOIRE SEUL — SECTEUR À IDENTIFIER", None, "PORT-BOUËT 2", None, None, None, A_LOCALISER),
    ("NON RATTACHÉ — INFORMATION INSUFFISANTE", None, None, D, "PORT-BOUËT 2", "haute", GPS_SEUL),
    ("NON RATTACHÉ — INFORMATION INSUFFISANTE", None, None, None, None, None, A_LOCALISER),
    ("CONFLIT — VÉRIFICATION IMPÉRATIVE", C, "PORT-BOUËT 2", C, "PORT-BOUËT 2", "haute", CONFLIT),
])
def test_statut_final(manuel, cle_m, terr_m, cle_g, terr_g, conf, attendu):
    assert statut_final(manuel, cle_m, terr_m, cle_g, terr_g, conf)[0] == attendu


def test_statuts_admis_dans_le_routing():
    admis = ["validé (2 sources)", "provisoire"]
    assert routable(VALIDE, admis) and routable(PROVISOIRE, admis)
    assert not any(routable(s, admis) for s in (CONFLIT, A_LOCALISER, GPS_SEUL))


# ---------------------------------------------------------------- reprise des PDV des merchandisers retirés

def test_couverture_par_routing_puis_createur():
    import pandas as pd
    from atom.couverture import Couverture
    pts = pd.DataFrame({"Merchandiser": ["Guihi", "Guihi", "Kouamé"],
                        "Secteurs": ["COCODY|COCODY 2|ANONO", "COCODY|COCODY 2|ANONO ; COCODY|COCODY 2|DANGA",
                                     "COCODY|COCODY 1|ABATTA"]})
    pdv = pd.DataFrame({"Merchandiser": ["Seregone", "Seregone", "Kouadio", "Diabaté"],
                        "Cle": ["BINGERVILLE|GBAGBA|BERLIN"] * 3 + ["COCODY|COCODY 2|ANONO"]})
    cv = Couverture(pts, pdv, {"Guihi", "Kouamé", "Seregone", "Kouadio"})
    assert cv.choisir("COCODY|COCODY 2|ANONO") == ("Guihi", "routing du secteur")
    assert cv.choisir("COCODY|COCODY 2|RIVIERA 3") == ("Guihi", "routing de la zone")
    assert cv.choisir("BINGERVILLE|GBAGBA|BERLIN") == ("Seregone", "premier créateur du secteur")
    assert cv.choisir("BINGERVILLE|FAYA|SANTÉ")[0] == ""


def test_decision_manuelle_passe_avant_les_regles():
    import pandas as pd
    from atom.couverture import Couverture
    pts = pd.DataFrame({"Merchandiser": ["Kouamé"], "Secteurs": ["COCODY|COCODY 1|ABATTA"]})
    pdv = pd.DataFrame({"Merchandiser": ["Seregone"], "Cle": ["BINGERVILLE|GBAGBA|BERLIN"]})
    man = pd.DataFrame({"Territoire": ["BINGERVILLE"], "Zone": [""], "Merchandiser": ["Kouamé"], "Decision": ["29/10"]})
    cv = Couverture(pts, pdv, {"Kouamé", "Seregone"}, man)
    assert cv.choisir("BINGERVILLE|GBAGBA|BERLIN") == ("Kouamé", "décision de Jean Luc")
    assert cv.choisir(None, "BINGERVILLE")[0] == "Kouamé"


# ---------------------------------------------------------------- calendrier et quota

def test_calendrier_novembre():
    from datetime import date
    from atom.planif import date_du
    d = date(2026, 11, 2)
    assert date_du("Lundi", 1, d) == date(2026, 11, 2)
    assert date_du("Samedi", 1, d) == date(2026, 11, 7)
    assert date_du("Lundi", 2, d) == date(2026, 11, 9)
    assert date_du("Samedi", 4, d) == date(2026, 11, 28)


def test_un_jour_ne_depasse_jamais_le_quota():
    import pandas as pd
    routing = importlib.import_module("13_routing")
    pool = pd.DataFrame({"lat": [5.35 + i * 1e-4 for i in range(40)], "lng": [-4.0] * 40,
                         "canal": ["Superette & Boutique"] * 30 + ["Aboki & Kiosque"] * 10,
                         "prio": list(range(40))})
    q = {"Superette & Boutique": 15, "Aboki & Kiosque": 2, "Porridge": 1, "Pushcart": 2}
    choisis = routing.choisir_jour(pool, q)
    assert len(choisis) == 18  # 20 moins les 2 pushcarts à trouver ; le porridge manquant → une boutique
    assert (pool.loc[choisis].canal == "Aboki & Kiosque").sum() == 2
    assert choisis[0] == 0  # départ au plus prioritaire


def test_regle_stricte_du_distributeur():
    import pandas as pd
    from atom.planif import couverture_pdv
    pts = pd.DataFrame({"Merchandiser": ["Kouamé", "Guihi"],
                        "Secteurs": ["COCODY|COCODY 1|ABATTA", "COCODY|COCODY 2|ANONO"]})
    prop = pd.DataFrame({"Merchandiser": ["Kouamé", "Guihi"]},
                        index=["COCODY|COCODY 1|ABATTA", "COCODY|COCODY 2|ANONO"])
    pdv = pd.DataFrame({"Cle": ["COCODY|COCODY 1|ABATTA", "COCODY|COCODY 1|ABATTA", "BINGERVILLE|GBAGBA|BERLIN",
                                "COCODY|COCODY 1|ABATTA"],
                        "Distributeur": ["PRODISMA", "Plaisir Bachus", "Dynamys", ""]})
    man = pd.DataFrame({"Territoire": ["BINGERVILLE"], "Zone": [""], "Merchandiser": ["Kouamé"], "Decision": [""]})
    r = couverture_pdv(pdv, pts, prop, {"Kouamé": "Plaisir Bachus", "Guihi": "PRODISMA"}, man)
    assert list(r.couvert_par) == ["Guihi", "Kouamé", "", "Kouamé"]
