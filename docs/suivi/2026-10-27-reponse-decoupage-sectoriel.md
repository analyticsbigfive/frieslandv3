# Réponse à Naya : découpage sectoriel Abidjan (27/10/2026)

## Notes pour Jean Luc (à ne pas envoyer)

- Les deux fichiers reçus sont identiques à ceux analysés ce matin (mêmes empreintes) : « SOUTH 1.xlsx » = nouvelle version, « SOUTH 2.xls » = ancienne version avec RECAP.
- **Abobo : on ne se corrige pas.** Dans le référentiel Friesland de l'application, ABOBO 2 = Anyama, N'Dotré, PK 18, Ebimpé (LKA SERVICES). La phrase du 23/10 était juste ; c'est le fichier qui contredit leurs propres données.
- **Origine du territoire des boutiques Friesland** : pour celles de leur ancienne application (export AppSheet « VISITE (3).xlsx », import du 31/08, `scripts/import-rest-2026-08-31.mjs`), c'est la colonne « Zone » saisie par leurs équipes (vérifié : zone ABOBO 2 → ABO 2, etc.). Les boutiques DMS du 29/09 ont reçu le territoire de leurs voisines (`scripts/lib/imports/dms-pdv.mjs`) : l'e-mail donne les deux chiffres. Les boutiques Atom aussi ont reçu le territoire de leurs voisines (`scripts/lib/imports/pdv-atom.mjs`) : leur « zone » en base n'est plus celle du fichier Atom, d'où le tableau du 23/10 gardé tel quel (export Atom du 06/10).
- **Le paragraphe « correction de notre côté » sur Abobo, présent dans les brouillons de ce matin, était faux.** Ne pas l'envoyer ; s'il est déjà parti, le rectifier.
- Comptages par nom de quartier (champ `quartier`) : ce sont des minimums.
- Aucun point de visite modifié depuis le 22/10 (`routing_mensuel`).
- Pièce jointe : `2026-10-27-referentiel-friesland-vs-decoupage.csv`.

---

**Objet :** RE: Découpage sectoriel Abidjan – comparaison avec vos données

Bonjour Naya,

Merci pour les deux fichiers. Nous les avons comparés ligne par ligne entre eux, aux boutiques Friesland enregistrées dans l'application, puis aux boutiques et points de visite Atom. Ils ne nous permettent pas encore de corriger les écarts, pour les trois raisons ci-dessous. Le détail est dans le fichier joint.

### 1. Les deux fichiers ne disent pas la même chose

- **« DECOUPAGE SECTORIEL ABIDJAN SOUTH 2.xls »** reprend 21 territoires avec leurs distributeurs (onglet RECAP). Ses zones sont celles déjà chargées dans l'application.
- **« DECOUPAGE SECTORIEL ABIDJAN SOUTH 1.xlsx »** est une version plus récente, avec les noms des SSF, mais sans distributeurs. Elle change :
  - Cocody 1 : Mahou, 7e et 8e tranches, Djibi, Angré Château, Djorobité 1 et 2, Bessikoi, Palmeraie, Attoban, Bonoumin, Faya, Akouédo, Abatta, Cité SIR ;
  - Cocody 2 : Lycée technique, Vallon, Colombie, 2 Plateaux les Perles, Danga, Cocody centre, Blockhauss, Riviera 2 et 3, Anono, M'Pouto, CIAD, M'Badon ;
  - Bingerville : Feh Kessé, Akandjé, Laurier 15, Santé, Bingerville centre et Gbagba ; Abatta n'y est plus ;
  - Port-Bouët passe à 5 zones, Koumassi à 2 zones, Adjamé à 6 zones ;
  - Djibi village disparaît d'Abobo 1.

**Question :** lequel des deux fichiers fait foi ? Ou chacun vaut-il pour sa région (South 1 et South 2) ?

### 2. Le découpage ne correspond pas au rattachement de vos propres boutiques

Le dashboard classe vos boutiques selon leur territoire dans l'application. Pour les boutiques reprises de votre ancienne application, ce territoire est la zone saisie par vos équipes. Pour les boutiques du DMS (29/09), c'est le territoire des boutiques voisines. Sur plusieurs quartiers, ce rattachement et les fichiers se contredisent.

| Quartier | Vos boutiques (dont saisies dans votre ancienne application) | Territoire dans l'application | Territoire dans les fichiers |
|---|---|---|---|
| Anyama, N'Dotré, Ebimpé | 247 (245) | ABOBO 2 (LKA SERVICES) | ANYAMA, territoire où l'application n'a aucune de vos boutiques |
| PK 18 | 74 (72) | ABOBO 2 (LKA SERVICES) | absent des deux fichiers |
| Agripac | 9 (9) | ABOBO 1 | ABOBO 2 |
| Bingerville | 169 (155) | COCODY 2 (PRODISMA pour 156) | BINGERVILLE (DYNAMYS) |
| Abatta, Akouédo, Faya | 172 (98) | COCODY 2 | COCODY 1 dans South 1 ; Bingerville ou Cocody 2 dans South 2 |
| 2 Plateaux | 359 (197) | COCODY 1 (PRODISMA) | COCODY 2 dans South 1 |

Pour Abobo, vos équipes ont donc saisi en ABOBO 2 le nord : Anyama, N'Dotré, PK 18, Ebimpé. Les fichiers, eux, mettent en Abobo 2 Mosquée blanche, ONUCI et CMA, et font d'Anyama et N'Dotré un territoire à part.

**Décision à prendre :**
- **Si le fichier fait foi**, vos boutiques changent de territoire sur le dashboard et devront être reclassées :
  - avec South 1, au moins 950 boutiques, dont 700 saisies par vos équipes ;
  - avec South 2, au moins 420 boutiques, dont 400 saisies par vos équipes.
- **Si le rattachement actuel fait foi**, c'est le fichier qu'il faut corriger sur ces quartiers.

Ces chiffres sont des minimums : nous n'avons compté que les boutiques dont le quartier porte l'un de ces noms.

### 3. Les distributeurs ne concordent pas

- **Plaisir Bachuss** ne figure dans aucun des deux fichiers. Il sert pourtant 710 de vos boutiques (556 en Cocody 1, 154 en Cocody 2). C'est aussi le distributeur de tous les jours de Kouamé Hellarion.
- **N'Dotré et PK 18** : vos boutiques dans l'application et le RECAP indiquent LKA SERVICES. Atom note 204 boutiques de ces quartiers chez ETABLISSEMENT NIARE & FRERES, et le routing de Seregone Schadrack utilise NIARE tous les jours. Quel distributeur doit-il suivre ?
- **Bingerville** : le RECAP indique DYNAMYS, mais 156 des 169 boutiques Bingerville que vous avez dans l'application sont chez PRODISMA.

### 4. Points de visite : les fichiers ne contiennent aucune position

Aucun point de visite n'a été déplacé depuis le 22/10. Les deux demandes du 23/10 restent donc ouvertes.

**A. Les 45 points à position approximative**

26 d'entre eux ne figurent dans aucun des deux fichiers :
- Seregone : CMPC, CMPC 2, Belle vie, Abobo Belle vie, Colochat, Cazar ;
- Yao : Pharmacie Lamé, Niamké, 14e arrondissement, Quartier Yacouba, Mâle, Abobo 4 étages ;
- Gui : Grand marché, Snap, Konan Raphaël, Marie Core, Déguerpis, Zone portuaire, Texas ;
- Guihi : Allocodrome, CAD, CA ;
- Kouadio : Quartier Adioukrou, Grand carrefour, Petroci ;
- Deheo : Assonvon.

Pour les autres, les fichiers donnent le quartier, mais pas l'emplacement. Trois exemples :
- **Alépé** (Seregone) est toujours placé dans Abobo (5.43200, -3.99800), alors que la ville est à plus de 30 km.
- **Belle vie** (Seregone) : les boutiques du quartier sont à environ 4,8 km à l'est du point.
- **Paillet et Vidange** (Abbé Frédéric, parmi les 45), ainsi que HMA : les fichiers les mettent en Adjamé 2 et le routing les note « ABOBO 2 », mais leurs positions tombent côté Cocody. Ces trois points attribuent à Abbé 117 boutiques de Cocody 1.

**B. Les 14 points à faible volume**

Les chiffres ci-dessous comptent les boutiques à 800 m ou moins du point, puis celles du distributeur du jour.

- **Distributeur à revoir** (le distributeur du routing n'a pas ou presque pas de boutiques autour du point) :
  - Anyama (Seregone, vendredi S2) : 0 boutique Atom. Vous y avez 124 boutiques chez LKA SERVICES ;
  - Djibi village (Seregone, lundi S4) : 0 boutique. Djibi est désormais en Cocody 1 dans South 1 ;
  - Abatta (Kouamé, samedis S1 et S2) : 7 boutiques, dont 0 Plaisir Bachuss ;
  - Angré Mahou 1 et 2 (Kouamé, mercredis S1 et S2) : 29 boutiques, dont 0 et 1 Plaisir Bachuss.
- **Quartier absent des fichiers** :
  - CHU (Gui, lundi S4) : 0 boutique ; seul un « CRF CHU » existe, en Yopougon 3 ;
  - Biétry (Gui, mercredi S1) : 9 boutiques, dont 7 SIDECOM.
- **Recensement à compléter** (le distributeur du jour est le bon, mais il y a peu de boutiques) :
  - Biabou (Seregone) : 9 sur 9 ;
  - Zone 4 (Gui) : 1, dont 0 SIDECOM ;
  - 2 Plateaux Casa et Vallon (Guihi) : 1 sur 3 et 9 sur 10. Ils sont notés Cocody 1 dans le routing, mais South 1 les met en Cocody 2 ;
  - Niangon (Deheo) : 9 sur 35 ;
  - Azito (Deheo) : 9 sur 9 ;
  - Songon (Zogbolou) : 0.

### 5. Ce dont nous avons besoin

1. Le fichier qui fait foi (South 1, South 2, ou chacun pour sa région).
2. Pour les quartiers du tableau du point 2, la référence à retenir : le rattachement actuel de vos boutiques ou le fichier.
3. Les distributeurs : Plaisir Bachuss sur Cocody, LKA SERVICES ou NIARE pour N'Dotré et PK 18, DYNAMYS ou PRODISMA pour Bingerville.
4. Le choix entre l'option 1 (un découpage commun Atom et Friesland) et l'option 2 (deux découpages). Avec l'option 1, je vois avec Elias KOME pour que l'export Atom reprenne ces noms.
5. Les positions des 45 points de visite, relevées sur le terrain (partage de position WhatsApp ou lien Google Maps).
6. Pour les points à faible volume, votre choix entre recensement complémentaire et changement de distributeur.

Si l'agence du Census dispose de la liste des boutiques recensées avec leurs coordonnées GPS et leur secteur, ou d'une carte des limites de secteurs (fichier KML ou KMZ), ce serait le document le plus utile. Il permettrait de rattacher toutes les boutiques sans passer par les noms de quartiers.

Dès réception, nous mettons à jour l'application et recalculons les tournées.

Bien cordialement,

Jean Luc Houedanou
