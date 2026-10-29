# Découpage sectoriel : réponses de Friesland aux 14 points (29/10/2026)

## Notes pour Jean Luc (à ne pas envoyer)

- Sources : feuille « Découpage sectoriel – 14 points à confirmer (28/10/2026) », colonne « Réponse Friesland », et compte rendu Fathom de la réunion du 29/10. Quand les deux divergent, on suit la feuille.
- Fichier `final` relu le 29/10 : les lignes citées n'ont pas bougé.
- Appliqué en base le 29/10 : migration `supabase/nouveau/20261029100000_friesland_decoupage_reponses_14_points.sql`. Résultat : 23 territoires, 60 zones, **306 secteurs** (13 retirés, 1 ajouté). Les lignes retirées sont gardées dans `decoupage_avant_20261028` (objet `quartier_reponses_20261029`).
- Choix de Jean Luc là où la réponse n'était pas nette :
  - point 6 : les 3 secteurs vont en N'DOTRÉ (la réponse ne choisissait pas de zone) ;
  - point 9 : ANANERAIE n'est plus que dans SONGON & KM 17, une zone qui n'était pas proposée ;
  - point 11 : ABOISSO 1, comme dans la feuille (Fathom disait ABOISSO 3) ;
  - point 3 : seul le secteur AZAGUIÉ quitte Armande ; PETIT YAPO, GRAND YAPO, RUBINO et SECHI restent dans sa zone AZAGUIÉ. Fathom garde « régler Azaguié avec Rachid et Armande » parmi les actions ouvertes.
- La phrase Fathom « Songon, Dabou, Fresco → zone de Yopougon de Soiré » contredit le fichier et le point 7. C'est une erreur de résumé, on n'en tient pas compte.
- Les boutiques ne sont pas encore reclassées : les noms de secteur retirés existent tous encore dans la zone retenue.
- La carte https://claude.ai/artifact/4JwcHNFzCorDzhgunVChQU (onglet « 14 points ») affiche les 14 réponses.
- Encore à faire, issu de la réunion :
  - expliquer pourquoi les territoires d'Atom diffèrent de ceux de Friesland, puis en rendre compte à Desire ;
  - Desire et Sonia réévaluent les visites des merchandisers dans les périphéries éloignées, dont Alépé.

## Ce qui a changé

| N° | Lieu | Retenu | Changement dans l'application |
|---|---|---|---|
| 1 | Sikensi | Souare | retiré de la zone Agboville ville (Armande) |
| 2 | N'Douci | Souare | retiré de la zone Agboville ville (Armande) |
| 3 | Azaguié | Rachid, zone Anyama | secteur Azaguié retiré de la zone Azaguié d'Agboville |
| 4 | Agboville (zone Anyama) | Rachid | aucun |
| 5 | Adzopé (zone Anyama) | Rachid | aucun |
| 6 | Ancienne gendarmerie, Belle ville morgue, Gare | zone N'Dotré | retirés de la zone Anyama |
| 7 | Km 17 | Songon & Km 17 | retiré de Maroc / Bagnon |
| 8 | Cité Verte | Lubafrique / Cité Verte (Yopougon 3) | retiré de Maroc / Bagnon |
| 9 | Ananeraie | Songon & Km 17 | retiré de Siporex / Port-Bouët 2 / Ananeraie et de Maroc / Bagnon |
| 10 | Grand-Lahou | zone Grand-Lahou | Grand-Lahou et CRF Grand-Lahou retirés de Grand-Lahou / Fresco |
| 11 | Aboisso | Aboisso 1 | retiré d'Aboisso 3 |
| 12 | Carrefour de Jacqueville | périphérie de Yopougon (Dabou) | aucun |
| 13 | Alépé | confirmé | aucun |
| 14 | Adiaké, Assinie | Anne Marie | aucun |
