# Tournées : deux logiques (Friesland / Atom BTL)

Mise en place le 06/10/2026. Migrations `supabase/nouveau/20261006100000_*` et `20261006101000_*`.

## Les deux logiques

| | Friesland (intérieur) | Atom BTL (Abidjan) |
|---|---|---|
| Champ profil | `profiles.employeur = 'friesland'` (défaut) | `profiles.employeur = 'atom'` |
| Règle de tournée | `routing_templates.mode = 'perimetre'` | `routing_templates.mode = 'quota'` |
| Portefeuille | tout le périmètre (`scripts/tournees-perimetre.mjs`) | clients DMS du merchandiser (`scripts/affecter-merch-dms.mjs`) |
| Tournée du jour | tout le portefeuille, lundi → samedi | N PDV par canal selon la grille, chaque PDV **une fois par mois civil** |
| Suivi | — | Référentiels › Application mobile › **Programme Atom** (vue `v_programme_atom`, objectif = grille × jours de tournée du mois : 420 sur 4 semaines pleines, 465 en octobre 2026) |

Grille client (Référentiels › Application mobile › **Quotas Atom**, table `routing_quota_canal`) :

| Canal | Lun | Mar | Mer | Jeu | Ven | Sam |
|---|---|---|---|---|---|---|
| Superette | 2 | 2 | 2 | 2 | 1 | 1 |
| Boutique | 13 | 13 | 13 | 13 | 11 | 6 |
| Aboki & Kiosque | 2 | 2 | 2 | 2 | 1 | 1 |
| Pushcart | 2 | 2 | 2 | 2 | 1 | 1 |
| Porridge | 1 | 1 | 1 | 1 | 1 | 1 |

Déficit sur un canal (pas assez de PDV disponibles) : complété en boutiques. Le canal d'un PDV vient de
`canal_atom(sous_categorie_pdv)` ; grossistes, supermarchés, pharmacies sont hors quota.

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

## Reporting Atom dans l'app (1.0.11, à venir)

Le formulaire visite 1.0.10 ne saisit pas : SSF « avec qui », compteurs visibilité / pose / affiche / branding,
cartons, tâches accomplies. Les colonnes `visites.ssf_id`, `ssf_brut`, `distributeur_id`, `distributeur_brut`
et la table `ssf` sont prêtes ; `data.atom{…}` est le format utilisé par l'import. Le distributeur est déduit du
PDV par trigger si absent.
