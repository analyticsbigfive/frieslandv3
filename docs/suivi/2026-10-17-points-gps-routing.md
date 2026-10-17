# Points GPS du routing mensuel : vérification et correction (17/10/2026)

## Ce qui s'est passé

- Samedi 17/10, **Zogbolou Kevin** (prévu à Maroc) et **Abbé Frédéric** (prévu à Dallas) ont reçu dans l'appli des PDV d'une autre zone.
- Cause : depuis le 09/10, chaque case du routing mensuel a un point GPS. La tournée prend les PDV du distributeur **à moins de 500 m de ce point** (`pdvsDeCase`, `scripts/lib/imports/routing-mensuel.mjs`). Plusieurs points du fichier Atom du 10/10 ne tombent pas sur le lieu : celui de « Maroc 3 » était à Siporex / Banco 2, à environ 2,9 km du quartier Maroc.
- Les points faux sont surtout des points **estimés à la main**, avec des chiffres ronds (5.3555, -4.0788) : 58 % de ces points sont hors du lieu, contre 15 % des points précis.

## Méthode

Chaque case (215 cases, 9 merchandisers) est comparée à deux autres sources :

1. **OpenStreetMap** (Nominatim, une requête par seconde) : « lieu, commune ». On garde le résultat seulement s'il est dans la bonne commune.
2. **Les PDV du quartier reconnu** à l'import (`routing_mensuel.lieux`) : distance du point au PDV le plus proche de ce quartier.

Verdict :

- **OK** : point à moins de 1 km du lieu OSM, ou un PDV du quartier à moins du rayon.
- **Corrigé** : point hors du lieu et OSM fiable, ou nom du lieu = nom du quartier. Nouveau point = OSM ou centre des PDV du quartier. Ensuite, on vérifie la part de PDV du bon quartier dans la nouvelle règle. Si elle est faible, on passe au centre des PDV : c'est arrivé pour Port-Bouët 2 et Anador 2.
- **À confirmer** : sources contradictoires, ou rien pour vérifier. **Aucun changement** sans la réponse d'Atom.

Les scripts sont dans le scratchpad de la session : `geocode_lieux.py`, `verdicts.py`, `generer_sql.py` et `livrables.py`.

## Résultat

| Statut | Cases |
|---|---|
| OK | 141 |
| Corrigé le 17/10 | 24 |
| À confirmer (douteux) | 29 |
| À confirmer (non vérifiable) | 21 |
| **Total** | **215** |

### Les 24 cases corrigées

| Merch | Jour | Sem. | Lieu | Ancien point | Nouveau point | Écart | Source |
|---|---|---|---|---|---|---|---|
| Abbe Frederic | Mercredi | S2 | Dallas 1 | 5.33200, -4.03900 | 5.34191, -4.02370 | 2021 m | OpenStreetMap « Carrefour Dallas » |
| Abbe Frederic | Jeudi | S2 | Williamsville 1 | 5.37200, -4.01800 | 5.37375, -4.02510 | 810 m | Centre des PDV du quartier (lieu introuvable sur OpenStreetMap) |
| Abbe Frederic | Vendredi | S2 | Bramakoté 1 | 5.36100, -4.02900 | 5.34927, -4.03242 | 1358 m | Centre des PDV du quartier (lieu introuvable sur OpenStreetMap) |
| Abbe Frederic | Samedi | S2 | Dallas 1 | 5.33200, -4.03900 | 5.34191, -4.02370 | 2021 m | OpenStreetMap « Carrefour Dallas » |
| Abbe Frederic | Lundi | S3 | Bracodi 1 | 5.35200, -4.02500 | 5.36160, -4.02523 | 1068 m | OpenStreetMap « Bracodi » |
| Abbe Frederic | Mercredi | S3 | Saint Michel 1 | 5.35500, -4.02300 | 5.34548, -4.02202 | 1064 m | OpenStreetMap « Saint-Michel » |
| Abbe Frederic | Vendredi | S3 | Bramakoté 2 | 5.36250, -4.03050 | 5.34927, -4.03242 | 1486 m | Centre des PDV du quartier (lieu introuvable sur OpenStreetMap) |
| Abbe Frederic | Mercredi | S4 | Dallas 2 | 5.33350, -4.04050 | 5.34191, -4.02370 | 2082 m | OpenStreetMap « Carrefour Dallas » |
| Deheo Wilfried | Lundi | S1 | Sable et Institut des aveugles | 5.33800, -4.07800 | 5.35705, -4.06819 | 2380 m | OpenStreetMap « Sable » |
| Deheo Wilfried | Jeudi | S2 | Koweït 2 et Agbayaté 1 | 5.32100, -4.09200 | 5.32122, -4.05446 | 4156 m | OpenStreetMap « Koweit » |
| Gui Stephane | Lundi | S3 | Quartier Apollo | 5.29200, -4.00800 | 5.30614, -4.00926 | 1578 m | Centre des PDV du quartier (lieu introuvable sur OpenStreetMap) |
| Guihi Bernadin | Jeudi | S4 | M'Pouto et CAD | 5.34100, -3.95100 | 5.32697, -3.95611 | 1659 m | OpenStreetMap « M’pouto » |
| Kouadio Atoffe Guy Anicet | Jeudi | S1 | Ahoussabougou | 5.29268, -3.97293 | 5.29388, -3.95973 | 1468 m | Centre des PDV du quartier (lieu introuvable sur OpenStreetMap) |
| Yao Venance | Samedi | S2 | Kennedy 2 | 5.43500, -4.02200 | 5.41948, -4.00835 | 2294 m | OpenStreetMap « Kennedy » |
| Yao Venance | Jeudi | S3 | Anador 2 | 5.42100, -4.02500 | 5.40870, -4.01022 | 2132 m | Centre des PDV notés ANADOR (le point OSM « Anador » donnait surtout ABOBO CENTRE / SAMAKE) |
| Zogbolou Kevin | Jeudi | S1 | Lubafrik | 5.37100, -4.08900 | 5.31966, -4.10706 | 6049 m | Centre des PDV du quartier (lieu introuvable sur OpenStreetMap) |
| Zogbolou Kevin | Samedi | S1 | Maroc 1 | 5.34850, -4.07220 | 5.33942, -4.09920 | 3155 m | OpenStreetMap « Quartier Maroc » |
| Zogbolou Kevin | Lundi | S2 | Andokoi 1 | 5.37800, -4.07200 | 5.36607, -4.06824 | 1390 m | OpenStreetMap « Andokoi » |
| Zogbolou Kevin | Samedi | S2 | Maroc 2 | 5.35200, -4.07550 | 5.33942, -4.09920 | 2973 m | OpenStreetMap « Quartier Maroc » |
| Zogbolou Kevin | Lundi | S3 | Andokoi 2 | 5.37950, -4.07050 | 5.36607, -4.06824 | 1514 m | OpenStreetMap « Andokoi » |
| Zogbolou Kevin | Vendredi | S3 | Port-Bouët 2 (1) | 5.34100, -4.06800 | 5.34983, -4.08868 | 2491 m | Centre des PDV notés PORT BOUET 2 (le point OSM « Port-Bouët II » tombait sur des PDV notés MAROC) |
| Zogbolou Kevin | Samedi | S3 | Maroc 3 | 5.35550, -4.07880 | 5.33942, -4.09920 | 2881 m | OpenStreetMap « Quartier Maroc » |
| Zogbolou Kevin | Vendredi | S4 | Port-Bouët 2 (2) | 5.34250, -4.06650 | 5.34983, -4.08868 | 2587 m | Centre des PDV notés PORT BOUET 2 (le point OSM « Port-Bouët II » tombait sur des PDV notés MAROC) |
| Zogbolou Kevin | Samedi | S4 | Maroc 4 | 5.35900, -4.08200 | 5.33942, -4.09920 | 2892 m | OpenStreetMap « Quartier Maroc » |

Contrôle après correction (PDV de la nouvelle règle dans le quartier prévu) : Maroc 81 sur 109 (et 28 à Carrefour Kimi, juste à côté), Andokoi 87/90, Port-Bouët 2 90/98, Lubafrik 24/31, Koweït 81/91, M'Pouto 35/37, Saint Michel 73/93, Ahoussabougou 58/91, Apollo 143/252, Dallas 63/132 (et 20 à Délégation), Bracodi 33/67.

**À vérifier sur le terrain :**

- **Sable** (Deheo) : PDV notés GABRIEL GARE.
- **Kennedy 2** (Yao) : PDV notés ABOBO CENTRE / SAMAKE.
- **Bramakoté 1 et 2** (Abbé) : 40 des 54 PDV notés BRAMAKOTE sont chez un autre distributeur que celui de la case (Diallo Souleymane). La règle n'en prend donc que 7.

### Comment c'est appliqué en base (sans DELETE)

Pour chaque case : `routing_mensuel.latitude/longitude` prend le nouveau point. Une **règle neuve** est créée (copie de l'ancienne, PDV du distributeur à moins de 500 m du nouveau point). L'**ancienne règle est désactivée** (`is_active = false`, note datée), sans rien supprimer. Le retour arrière est prêt dans `supabase/nouveau/20261017100000_friesland_points_gps_corriges.sql` : ce fichier est une trace, il **ne se rejoue pas**.

Tournées déjà créées, refaites sur place (seulement les étapes « en attente ») :

- **Aujourd'hui 17/10** :
  - Zogbolou : 7 étapes basculées sur Maroc (à 40-170 m du point OSM).
  - Abbé : 6 étapes basculées sur Dallas 1 (à 30-90 m du Carrefour Dallas), à sa demande.
  - Les étapes faites, passées ou en cours n'ont pas bougé.
- **19 au 24/10** :
  - Zogbolou 19 (Andokoi 2 : 20/20), 23 (Port-Bouët 2 : 15/15), 24 (Maroc 4 : 8 MAROC + 2 Carrefour Kimi).
  - Guihi 22 (M'Pouto : 19/20).
  - Abbé 19 (Bracodi 1) et 21 (Saint Michel 1 : 16/20).
  - Gui 19 (Apollo).
- Après le 24/10, le cron de 03:00 utilise les règles corrigées.

> **Contrainte de l'outil SQL (MCP Supabase)** : une requête qui contient `DELETE` (et sans doute `TRUNCATE`) attend une confirmation qui n'arrive pas. Elle est annulée au bout de 60 s. D'où le choix « nouvelle règle + désactivation » et « réutiliser les lignes d'étapes ».

## À confirmer par Atom

Classeur à joindre au mail : `docs/suivi/2026-10-17-routing-validation-atom.xlsx`. La version à imprimer est `…-atom.pdf`, à côté. Le classeur contient :

- les 215 cases ;
- deux colonnes jaunes à remplir : « Validation Atom » (Oui / Non) et « Correction Atom » ;
- un onglet sur la numérotation des semaines.

### Cases douteuses (prioritaires)

| Merch | Jour | Sem. | Lieu | Point actuel | Pourquoi | Suggestion OSM |
|---|---|---|---|---|---|---|
| Abbe Frederic | Jeudi | S1 | Paillet | 5.37671, -4.01332 | Lieu introuvable sur OpenStreetMap ; PDV du quartier reconnu à 1016 m du point |  |
| Abbe Frederic | Mardi | S2 | Attécoubé 1 | 5.33700, -4.03200 | Point à 511 m des PDV notés ATTECOUBE (limite) ; le centre de ces PDV tombe côté Adjamé. | 5.35151, -4.05196 (« Attécoubé 3 ») |
| Abbe Frederic | Jeudi | S3 | Vidange | 5.38519, -4.00601 | Lieu introuvable sur OpenStreetMap ; PDV du quartier reconnu à 2059 m du point |  |
| Deheo Wilfried | Jeudi | S3 | Agbayaté 2 | 5.32250, -4.09400 | OpenStreetMap propose « Carrefour Agbayaté » (bus_stop) à 5133 m du point de l'agence : lieu peu sûr | 5.32220, -4.04764 (« Carrefour Agbayaté ») |
| Deheo Wilfried | Mardi | S4 | Assonvon | 5.33300, -4.08800 | OpenStreetMap propose « Pharmacie Assonvon » (pharmacy) à 2205 m du point de l'agence : lieu peu sûr | 5.33276, -4.06809 (« Pharmacie Assonvon ») |
| Gui Stephane | Mardi | S1 | Grand marché | 5.30100, -4.00500 | OpenStreetMap propose « Grand marché de Marcory » (marketplace) à 3216 m du point de l'agence : lieu peu sûr | 5.29986, -3.97598 (« Grand marché de Marcory ») |
| Gui Stephane | Mardi | S4 | Zone portuaire | 5.28500, -4.01500 | Lieu introuvable sur OpenStreetMap ; PDV du quartier reconnu à 1079 m du point |  |
| Guihi Bernadin | Mercredi | S1 | Mahou Dokoui | 5.37800, -3.98500 | Lieu introuvable sur OpenStreetMap ; PDV du quartier reconnu à 2168 m du point |  |
| Guihi Bernadin | Mercredi | S2 | Allocodrome | 5.35800, -3.99100 | OpenStreetMap propose « Allocodrome » (bus_stop) à 4506 m du point de l'agence : lieu peu sûr | 5.39661, -4.00336 (« Allocodrome ») |
| Guihi Bernadin | Samedi | S4 | CA (à confirmer) | 5.35000, -3.97000 | Le fichier dit lui-même « à confirmer » ; OpenStreetMap ne donne que la commune (Cocody). | 5.35737, -3.99493 (« Cocody ») |
| Kouadio Atoffe Guy Anicet | Mercredi | S4 | Grand carrefour | 5.28817, -3.96996 | OpenStreetMap propose « Grand Carrefour de Koumassi - Avant le feu » (trunk) à 1365 m du point de l'agence : lieu peu sûr | 5.27638, -3.96652 (« Grand Carrefour de Koumassi - Avant le feu ») |
| Kouadio Atoffe Guy Anicet | Vendredi | S4 | Petroci | 5.29800, -3.94100 | OpenStreetMap propose « Petroci » (bus_stop) à 3123 m du point de l'agence : lieu peu sûr | 5.30171, -3.96896 (« Petroci ») |
| Kouadio Atoffe Guy Anicet | Samedi | S4 | Sans fil | 5.30750, -3.95296 | OpenStreetMap propose « Pont sans fil Aliodan » (bridge) à 1244 m du point de l'agence : lieu peu sûr | 5.30577, -3.96406 (« Pont sans fil Aliodan ») |
| Kouame Hellarion | Jeudi | S1 | Djorobité 1 | 5.40500, -3.93500 | Djorobité : le point de l'agence, OpenStreetMap et les PDV notés DJOROBITE donnent 3 endroits différents. | 5.39725, -3.93969 (« Carrefour Djorobité ») |
| Kouame Hellarion | Vendredi | S1 | Djorobité 2 | 5.41200, -3.92800 | Djorobité : le point de l'agence, OpenStreetMap et les PDV notés DJOROBITE donnent 3 endroits différents. | 5.39725, -3.93969 (« Carrefour Djorobité ») |
| Kouame Hellarion | Mardi | S2 | Faya Ephrata | 5.37200, -3.94500 | Lieu introuvable sur OpenStreetMap ; PDV du quartier reconnu à 637 m du point |  |
| Kouame Hellarion | Jeudi | S2 | Djorobité 1 | 5.40600, -3.93400 | Djorobité : le point de l'agence, OpenStreetMap et les PDV notés DJOROBITE donnent 3 endroits différents. | 5.39725, -3.93969 (« Carrefour Djorobité ») |
| Kouame Hellarion | Vendredi | S2 | Djorobité 2 | 5.41300, -3.92700 | OpenStreetMap propose « Carrefour Djorobité » (bus_stop) à 2245 m du point de l'agence : lieu peu sûr | 5.39725, -3.93969 (« Carrefour Djorobité ») |
| Kouame Hellarion | Jeudi | S3 | Djorobité 1 | 5.40700, -3.93300 | Djorobité : le point de l'agence, OpenStreetMap et les PDV notés DJOROBITE donnent 3 endroits différents. | 5.39725, -3.93969 (« Carrefour Djorobité ») |
| Kouame Hellarion | Vendredi | S3 | Djorobité 2 | 5.41400, -3.92600 | OpenStreetMap propose « Carrefour Djorobité » (bus_stop) à 2401 m du point de l'agence : lieu peu sûr | 5.39725, -3.93969 (« Carrefour Djorobité ») |
| Kouame Hellarion | Vendredi | S4 | Djorobité 2 | 5.41500, -3.92500 | OpenStreetMap propose « Carrefour Djorobité » (bus_stop) à 2557 m du point de l'agence : lieu peu sûr | 5.39725, -3.93969 (« Carrefour Djorobité ») |
| Seregone Schadrack | Lundi | S2 | Djibi | 5.42202, -3.98193 | OpenStreetMap « Djibi Village » : aucun PDV autour de ce point. Lieu à préciser. | 5.45613, -3.97275 (« Djibi Village ») |
| Seregone Schadrack | Jeudi | S3 | Abobo 4 étages | 5.43806, -4.00843 | Lieu introuvable sur OpenStreetMap ; PDV du quartier reconnu à 625 m du point |  |
| Seregone Schadrack | Vendredi | S3 | Mâle | 5.41400, -4.02100 | OpenStreetMap propose « Groupe Scolaire Male Gbinde Akeikoi extension » (school) à 4470 m du point de l'agence : lieu peu sûr | 5.45183, -4.00735 (« Groupe Scolaire Male Gbinde Akeikoi extension ») |
| Seregone Schadrack | Samedi | S3 | Château | 5.43800, -4.01900 | OpenStreetMap propose « Château » (bus_stop) à 7599 m du point de l'agence : lieu peu sûr | 5.46404, -4.08247 (« Château ») |
| Yao Venance | Jeudi | S1 | Alépé | 5.43200, -3.99800 | OpenStreetMap propose « Route d'Alépé » (secondary) à 4343 m du point de l'agence : lieu peu sûr | 5.46069, -3.97138 (« Route d'Alépé ») |
| Yao Venance | Mardi | S2 | Colatier | 5.47952, -4.05357 | OpenStreetMap propose « EPV Colatier » (school) à 2261 m du point de l'agence : lieu peu sûr | 5.45936, -4.05088 (« EPV Colatier ») |
| Yao Venance | Lundi | S3 | Belle vie | 5.44100, -4.03200 | Lieu introuvable sur OpenStreetMap ; PDV du quartier reconnu à 4418 m du point |  |
| Yao Venance | Jeudi | S4 | Abobo Belle vie | 5.44250, -4.03050 | Lieu introuvable sur OpenStreetMap ; PDV du quartier reconnu à 1886 m du point |  |

Les 21 autres cases « non vérifiables » (lieu introuvable sur OSM, pas de quartier reconnu) sont dans le classeur.

### Question ouverte : la numérotation des semaines

L'appli compte la semaine du mois par jours : 1 à 7 = S1, 8 à 14 = S2, etc. (`semaine_du_mois` en SQL, `semaineDuMois` dans `utils/routingRecurrence.ts`).

Le samedi 17/10, l'appli donne donc la **S3** (Attécoubé 2 pour Abbé). Abbé, lui, attendait la **S2** (Dallas 1). Ce serait juste si Atom compte la semaine à partir du **1er lundi du mois** (5/10).

Les visites réelles ne tranchent pas. Deheo (Mossikro), Guihi (Blockauss) et Kouadio (Abia Sud) ont suivi la numérotation de l'appli. Zogbolou était à Songon le 14/10, ce qui ne colle avec aucune des deux.

**Décision du 17/10 : on ne change rien avant la réponse d'Atom.** L'onglet « Semaines octobre » du classeur montre les deux numérotations, date par date.

### Abbé Frédéric

Selon lui, son planning a changé après la réaffectation du 16/10. La base a toujours le fichier du 10/10. Il faut **réimporter le nouveau fichier d'Atom** (Admin › Imports terrain › Routing mensuel), puis relancer la vérification des points. Un nouveau fichier qui reprendrait les points estimés referait l'erreur.

## Messages

**Zogbolou** : « Bonjour M. Zogbolou, le problème venait de notre côté : le point GPS de Maroc était mal placé. C'est corrigé. Appuyez sur Actualiser dans l'application : vos prochaines étapes sont à Maroc. »

**Abbé** : « Bonjour M. Abbé, merci. Le point GPS d'Attécoubé était mal placé, d'où des PDV éloignés et mélangés. Vos étapes restantes d'aujourd'hui sont maintenant à Dallas (près du Carrefour Dallas). Appuyez sur Actualiser. Nous vérifions votre planning avec Atom. »
