# Point du soir — 8 octobre 2026

Notes de travail, non commitées. Reprise prévue le 9 octobre à 8 h.

## 1. Où on en est

### Git
- Guide admin (URL de connexion, compte admin) : commité et poussé sur `main` (`caab31a`). Le mot de passe n'est dans aucun fichier du dépôt.
- Exemplaire personnel du guide avec le mot de passe : `docs/guides/utilisateurs/admin/admin.pdf`, non versionné, à remettre en main propre.
- Chantier en cours : branche `jl/ssf-binomes`, PR [#14](https://github.com/analyticsbigfive/frieslandv3/pull/14), **non fusionnée**.

### Migrations (production, sondée en lecture seule)
- **Appliquées** : les 10 migrations du 06/10 au 07/10, de `20261006100000` à `20261007140000`.
- **En attente** : les 7 de la PR #14, dans cet ordre :
  1. `20261008100000_friesland_agence`
  2. `20261008110000_friesland_direction_profil`
  3. `20261008120000_friesland_ssf_commercial`
  4. `20261008130000_friesland_routing_mensuel`
  5. `20261008140000_friesland_routing_ssf`
  6. `20261008150000_friesland_programme_merchandiser`
  7. `20261008160000_friesland_field_coaching_mt_objectif`
- Règle : **appliquer les 7, puis fusionner la PR**. Le front lit les nouvelles colonnes.

## 2. Les décisions, en clair

1. **Le SSF n'est pas un chef.** C'est le vendeur d'un distributeur. Le commercial (sales officer, salarié FrieslandCampina) a deux leviers : les SSF pour la vente, les merchandisers d'agence pour l'exécution. Personne ne commande l'autre ; ils passent dans les mêmes magasins le même jour.
2. **C'est l'agence qui fait le planning.** Elle envoie un **routing mensuel** : pour chaque merchandiser, chaque jour et chaque semaine du mois, un point de visite et, souvent, un SSF.
   - L'import met à jour sans doublon.
   - La règle « Portefeuille DMS » devient une règle de **repli** : elle ne sert que les jours sans case.
3. **Les agences sont un réglage.** Atom (Abidjan), une agence pour l'intérieur (à nommer), FrieslandCampina pour les salariés.
   - « Programme Atom » devient « Programme merchandiser South » ; « Programme merchandiser North » est créé.
4. **Chaque compte a une direction** : South, North ou MT. L'écran des installations se trie par direction et donne l'inventaire des licences.
5. **Contrôle d'écart** : pour un jour donné, il liste les magasins de la tournée du merchandiser que le SSF prévu ne suit pas dans le DMS.
6. **Field coaching** : le vendeur coaché est choisi parmi les SSF ; un champ objectif est prêt ; le coaching MT (un commercial suit un merchandiser) est prêt, mais les critères de Cindy manquent.
7. **Rapprochements prudents.**
   - Les noms écrits autrement sont reconnus.
   - Les lieux ne passent que par un libellé exact ou un alias validé (« Port-Bouët 2 » est à Yopougon).
   - Le commercial d'un merchandiser n'est jamais changé par l'import, seulement signalé.

## 3. Le fichier d'Elias (`~/Downloads/Routing_mensuel_merchandisers.xlsx`)

- **Contenu** : 214 lignes, 9 merchandisers d'Abidjan, 6 jours × 4 semaines. 72 cases sont « Aucun SSF ».
- **Simulation de l'import** (lecture seule) :
  - 8 merchandisers reconnus sur 9 ; Gui Stéphane n'a pas de compte ;
  - 190 cases, 63 règles ;
  - 2 SSF à créer, 3 à relier ;
  - 126 cases sans lieu reconnu : elles restent au portefeuille tant que les alias ne sont pas validés.
- **Pièce jointe préparée pour Elias** : `~/Downloads/points-de-visite-a-confirmer.xlsx`. Elle contient 203 lieux avec propositions, plus la liste des quartiers de la base.
- **E-mail à Elias** (copie Naya), avec 7 questions :
  1. la 5e semaine du mois ;
  2. les lieux (pièce jointe) ;
  3. Gui Stéphane remplace-t-il Akedan ? ;
  4. Zogbolou : M. Kamy ou M. Souaré ? Qui est « Mme Tea » (Guihi) ? ;
  5. Moustapha N'Diaye, absent du fichier ;
  6. les SSF « Non nommé » / « À préciser » et 4 correspondances de noms ;
  7. le samedi de la semaine 4 qui manque pour Abbé et Deheo.

  Le texte complet est dans la conversation du 08/10, et dans le plan `~/.claude/plans/commite-et-pousse-robust-blanket.md` (version précédente).

## 4. Commerciaux de l'intérieur (simulation, rien d'écrit)

**Hypothèse** : à l'intérieur comme à Abidjan, les commerciaux encadrent les merchandisers d'une agence.

**Script** : `scripts/encadrement-interieur-2026-10-08.mjs`, non commité. Sans option, il ne fait que simuler ; `--apply` écrit.

| Compte | Aujourd'hui | Après | Effet |
|---|---|---|---|
| DJESSOU JEMIMA (djessoumima@) | merchandiser sous KACOU LEONARD, Gagnoa | commerciale, Gagnoa | 1 règle désactivée, 6 tournées à venir supprimées, 0 visite |
| ASSAMOI TRESOR (cnefcyamoussoukro@) | merchandiser, Yamoussoukro | commercial, Yamoussoukro | 1 règle désactivée, 6 tournées à venir supprimées, 0 visite |

- Aucun des deux n'a d'équipe pour l'instant : elle se constituera avec les merchandisers de l'agence de l'intérieur.
- **Gagnoa n'aurait plus de merchandiser.**
- **Signalés, non modifiés** : 5 comptes « merchandiser » à l'adresse de commercial (cnefc… / cnofc…), sans visite en 30 jours.
  - N'Dja Koffi Florent (Daloa)
  - Coulibaly Padie (Korhogo)
  - Zanga Ouattara (Abengourou)
  - Guea Hermann (Bouaké)
  - Ebrottie (San Pedro) : il a aussi un compte commercial, et son compte merchandiser est **gardé comme 2e compte** (décision du soir).
- Si l'hypothèse se confirme, l'intérieur n'a **aucun vrai merchandiser** aujourd'hui. Sewinde Nouhoun (Man) reste à vérifier.

## 5. Questions ouvertes

**Pour Elias** : voir la section 3.

**Pour Naya ou Assamoi**
- Les 5 comptes cnefc / cnofc sont-ils des commerciaux ?
- Quel est le nom de l'agence de l'intérieur, et qui sont ses merchandisers ?
- Qui couvre Gagnoa ?
- Le territoire de Soubré (Mme Djessou).

**Pour Cindy** : la grille d'exécution MT et les objectifs du field coaching.

## 6. Demain, dans l'ordre

1. **Envoyer l'e-mail à Elias**, avec `points-de-visite-a-confirmer.xlsx`, si ce n'est pas déjà fait. Relancer Naya pour les questions sur l'intérieur.
2. **Appliquer les 7 migrations de la PR #14** dans l'ordre, puis **fusionner la PR**. Vercel déploie ensuite.
3. **Imports terrain** :
   - « Routing des SSF (export DMS) » : simuler, puis appliquer ;
   - « Routing mensuel » (fichier d'Elias) : simuler, puis relire le rapport.
4. Selon les réponses d'Elias :
   - régler la 5e semaine (Paramètres terrain) ;
   - créer les alias de lieux et de noms ;
   - simuler de nouveau, puis appliquer.
5. **Intérieur** :
   - ajuster le script pour Ebrottie (double compte conservé), puis le commiter ;
   - lancer `--apply` pour Jemima et Assamoi une fois l'hypothèse confirmée et les migrations passées.
6. **Tests du samedi** : vérifier que les merchandisers d'Atom ont installé l'application (écran Versions de l'app, filtre South).
