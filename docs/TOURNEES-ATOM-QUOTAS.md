# Tournées : deux logiques (Friesland / Atom BTL)

Mise en place le 06/10/2026. Migrations `supabase/nouveau/20261006100000_*` et `20261006101000_*`.

## Les deux logiques

| | Friesland (intérieur) | Atom BTL (Abidjan) |
|---|---|---|
| Champ profil | `profiles.employeur = 'friesland'` (défaut) | `profiles.employeur = 'atom'` |
| Règle de tournée | `routing_templates.mode = 'perimetre'` | `routing_templates.mode = 'quota'` |
| Portefeuille | tout le périmètre (`scripts/tournees-perimetre.mjs`) | clients DMS du merchandiser (`scripts/affecter-merch-dms.mjs`) |
| Tournée du jour | tout le portefeuille, lundi → samedi | N PDV par canal selon la grille, chaque PDV **une fois par mois civil** |
| Suivi | — | Barre latérale › **Programme Atom** (`/admin/routing/programme-atom`, fonction `programme_atom(mois)` et vue `v_programme_atom` ; objectif = grille × jours de tournée du mois : 420 sur 4 semaines pleines, 465 en octobre 2026) |
| Sous-zone | — | Chaque jour, la sous-zone du **SSF** de la règle du jour (voir plus bas) |

Grille client (Référentiels › Application mobile › **Quotas Atom**, table `routing_quota_canal`) :

| Canal | Lun | Mar | Mer | Jeu | Ven | Sam |
|---|---|---|---|---|---|---|
| Superette | 2 | 2 | 2 | 2 | 1 | 1 |
| Boutique | 13 | 13 | 13 | 13 | 11 | 6 |
| Aboki & Kiosque | 2 | 2 | 2 | 2 | 1 | 1 |
| Pushcart | 2 | 2 | 2 | 2 | 1 | 1 |
| Porridge | 1 | 1 | 1 | 1 | 1 | 1 |

Déficit sur un canal (pas assez de PDV disponibles) : complété en boutiques. Le canal d'un PDV vient de
`canal_atom(sous_categorie_pdv)` : table `canal_atom_sous_categorie` (Référentiels › Application mobile ›
**Canal Atom**), sinon la règle par défaut ; grossistes, supermarchés, pharmacies sont hors quota.

## Comment ça marche

- `materialiser_routing_jour(user, date)` (appelée par l'app à chaque ouverture, et par le cron) : règles
  `perimetre` versées en entier, règles `quota` piochées par `etapes_quota_du_jour`. Idempotente : une
  tournée existante n'est jamais recalculée.
- `etapes_quota_du_jour` exclut les PDV déjà **planifiés** dans une tournée du mois (y compris à venir) ou déjà
  **visités** dans le mois (visites de l'app et visites importées de l'export Atom).
- `pregenerer_tournees(7)` : job pg_cron `pregenerer_tournees` à 03:00, J → J+7 pour tous les merchandisers actifs.
- L'app mobile 1.0.10 n'a pas changé : elle lit la tournée matérialisée.

## Procédure (ordre)

1. Appliquer les migrations `20261006100000` (employeur, ssf, colonnes visites) puis `20261006101000` (quotas, cron, vue).
2. `node scripts/nettoyage-comptes-atom-2026-10-06.mjs --apply` : anciens comptes désactivés, règle de KACOU
   LEONARD retirée, `zones_secteurs` + CSV réalignés, périmètres Atom.
3. `node scripts/importer-routing-atom.mjs --apply` : 10 080 visites Atom juin → septembre (rapport dans
   `~/Downloads/import-routing-atom-rapport.md`, retour arrière en fin de rapport).
4. `node scripts/tournees-perimetre.mjs --compte=djessoumima@gmail.com --pregenerer=7 --apply`.
5. Vérifier Admin › Routing › Règles : badge **Quotas** sur les 6 règles « Portefeuille DMS » ; puis
   `select pregenerer_tournees(7);` pour matérialiser la semaine.
6. APK : `node scripts/upload-apk.mjs dist-apk/friesland-bonnet-rouge-1.0.10-release.apk --latest`, puis
   migration `20261006110000` (version minimale 13 + lien), puis AAB sur Play Console.

## Sous-zones SSF (1.0.12, migration `20261007100000`)

Décision client du 06/10 : les zones sont découpées en **sous-zones**, chacune couverte par un **SSF** (vendeur
du distributeur). Le merchandiser travaille chaque jour avec un SSF et ne sort pas de sa sous-zone ; le planning
est fait par jour de semaine (environ 6 SSF par merchandiser).

| Élément | Où | Table / fonction |
|---|---|---|
| SSF | Référentiels › Distribution › **SSF (vendeurs)** | `ssf` |
| Sous-zone d'un SSF (zone × quartiers) | Référentiels › Distribution › **SSF ↔ Quartiers** | `ssf_quartier`, vue `v_ssf_sous_zone` |
| Planning | Routing › Règles : une règle `SSF — <nom>` (mode quota) par SSF, avec ses jours | `routing_templates.ssf_id` |
| Planning d'un merchandiser | App › Plus › **Ma semaine (SSF)**, guides PDF | RPC `ssf_semaine(user)` |

- `etapes_quota_du_jour` prend d'abord les PDV de la règle du jour, puis les **PDV actifs de la sous-zone** du
  SSF de la règle (`ordre = 50000 + rang`), avec les mêmes exclusions (planifié ou visité dans le mois). Un PDV
  créé sur le terrain dans la sous-zone devient éligible sans script.
- La contrainte `unique (user_id, day_of_week)` de `routing_templates` est levée : plusieurs règles par
  merchandiser.
- La règle « Portefeuille DMS » est gardée pour les jours qu'aucun SSF ne couvre ; si tous les jours sont
  couverts, elle reste active sans jour (« aucun jour »), donc visible dans l'admin.
- L'admin refuse un PDV hors de la sous-zone dans une règle SSF.

**Dérivation en attendant le fichier client** (visites de septembre, mois de référence seulement) : un quartier
est retenu pour un SSF au-delà de 5 visites et 5 % de ses visites, dans la commune dominante du SSF ; un SSF est
retenu pour un merchandiser au-delà de 8 % de ses visites ou 40 visites ; un jour est attribué au SSF qui y
pèse le plus. Tout est marqué `a_confirmer = true`. Résultat au 06/10 : 49 sous-zones, 21 règles pour
9 merchandisers, 3 jours non couverts.

**Procédure**

1. Appliquer les migrations `20261007100000` → `20261007140000` (ordre dans
   [GUIDE-ADMINISTRATION.md](GUIDE-ADMINISTRATION.md) §13).
2. Admin › Import / Export › **Imports terrain** › **Sous-zones SSF et planning Atom** : Simuler (sans fichier =
   dérivation des visites ; avec le fichier client « SSF ↔ zones », ses lignes remplacent la dérivation),
   relire le rapport, Appliquer. Équivalent en ligne de commande :
   `node scripts/deriver-ssf-sous-zones.mjs [--fichier=…] --apply --pregenerer=7`.
3. Admin › Référentiels › Application mobile › **Maintenance** › Recalculer les tournées à venir (Atom).
4. Vérifier pour un merchandiser, chaque jour du lundi au samedi :
   `select q.*, p.zone, p.quartier from etapes_quota_du_jour('<uuid>', '<date>') q join pdv p using (pdv_id);`
   (tous les PDV dans la sous-zone du SSF du jour).

## Reporting Atom dans l'app (1.0.12)

- **Fait** : champ « SSF (avec qui) » dans la visite (prérempli avec le SSF du jour, « autre » = nom libre),
  enregistré dans `visites.ssf_id` / `ssf_brut` ; bandeau si le PDV est hors de la sous-zone ; écran
  « Ma semaine ».
- **Pas encore saisi dans l'app** : compteurs visibilité / pose / affiche / branding, cartons, tâches
  accomplies. `data.atom{…}` reste le format de l'import. Le distributeur est déduit du PDV par trigger si
  absent.
