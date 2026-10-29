# Territoires Atom et territoires Friesland : pourquoi ils diffèrent (29/10/2026)

## Notes pour Jean Luc (à ne pas envoyer)

- Question posée par Desire à la réunion du 29/10 : pourquoi les territoires d'Atom (merchandisers) ne sont-ils pas ceux de Friesland (commerciaux) ?
- Mesures du 29/10, lecture seule, rien n'a été modifié en base :
  - **liste d'un merchandiser** : `pdv_ids_merch_atom(id)`, soit 7 541 boutiques pour les 9 merchandisers actifs. On n'a pas utilisé `pdv_quartier_tournee`, qui est deux fois plus large ;
  - **territoire d'une boutique** : `pdv.zone`, c'est-à-dire le territoire actuel dans l'application, **avant reclassement**. Pour les boutiques Atom, il vient des boutiques voisines (`scripts/lib/imports/pdv-atom.mjs`). Il ne suit pas encore les 306 secteurs du découpage définitif ;
  - **zone Atom** : colonne « Zone » de l'onglet PDV de « BONNET ROUGE MAI 2026.xlsx » (9 693 boutiques, toutes retrouvées en base par `pdv_atom.source_id`, dont 13 inactives). Le tableau du 23/10 venait d'une autre source, l'export routing du 06/10 (4 626 boutiques). Les chiffres ne se comparent donc pas ligne à ligne : Abobo 2 compte 585 boutiques le 23/10 contre 778 ici, pour le même constat ;
  - **binôme** : `profiles.commercial_id`, et les territoires de ce commercial (`territoires_assignes`, étendus aux alias).
- **Ce que Desire voit à l'écran** : les territoires d'un merchandiser Atom ne sont saisis par personne. Le cron `synchroniser_zones_atom` (02:50) les réécrit chaque nuit d'après `pdv.zone` des boutiques de sa liste. Une seule boutique suffit à ajouter un territoire entier.
- **Écart avec le 28/10** : on mesure aujourd'hui 92 % des boutiques dans le territoire du binôme, contre 96 % le 28/10. Les deux chiffres sont cohérents. Le 28/10 estimait le secteur du découpage définitif, alors qu'aujourd'hui on lit le territoire actuel. En reportant les quartiers dans le découpage définitif, on retrouve 96 % :
  - 225 boutiques de Deheo : Locodjro, Agbayaté et Abobo Doumé passent en YOPOUGON 1 et 2 ;
  - 46 boutiques d'Abbé : Paillet et les rues d'Adjamé passent en ADJAMÉ 2 (quelques boutiques HMA en plus, non comptées) ;
  - 44 boutiques d'Abbé dont la zone porte un nom de quartier : Agban-village et Quartier ébrié, à Attécoubé.

  Soit (6 958 + 315) / 7 541 ≈ 96 %.
- **Cocody** : c'est désormais un seul territoire, que Murielle et Anne Marie se partagent par quartier (`quartiers_assignes`). Les 100 % mesurés sur Cocody ne prouvent donc rien. En base, 1 020 boutiques sur 1 435 n'ont pas de quartier. On a donc lu le quartier en base et, à défaut, la colonne « Quartier » du fichier Atom, comparés par mots-clés aux listes des deux commerciaux :
  - Kouamé : 476 chez Murielle, 0 chez Anne Marie, 1 en 2 Plateaux, 177 non reconnues ;
  - Guihi : 436 chez Anne Marie, 6 chez Murielle, 229 en 2 Plateaux, 110 non reconnues.

  « 2 PLATEAUX » figure dans les listes des deux commerciaux : c'est le seul vrai point à trancher dans Cocody.
- **Points de visite hors d'Abidjan** (`routing_mensuel` actif) : Seregone en a à Anyama, Alépé et N'Dotré (Niare), Zogbolou à Songon, Gui à la gare de Bassam. Anyama et Songon : 0 boutique du distributeur autour du point (constat du 27/10). Alépé est placé par erreur dans Abobo.
- **Proposition 2 (seuil d'affichage)** : ne pas la faire dans le cron. `territoires_assignes` sert aussi ailleurs : `useOfflineData`, `useUserScope`, `PDVQuickCreateModal`. `pdv_ids_perimetre` ne le lit pas pour Atom (branche `pdv_ids_merch_atom`), mais le reste n'a pas été vérifié. À faire seulement dans l'affichage de l'écran d'administration.
- **SODICOM-CI** : les 212 boutiques Friesland SODICOM-CI d'ATTÉCOUBÉ-PLATEAU sont à Abobo Doumé (132) et Locodjro (36), donc dans la même situation que celles de Deheo (reclassement en attente). Ce n'est pas un exemple de distributeur à cheval sur deux commerciaux ; il n'est pas cité.
- Moustapha N'Diaye est encore « actif » dans l'onglet Merchandiseurs du fichier Atom, mais désactivé dans l'application.
- Vocabulaire : ni « case », ni « rattachement », ni « règle ». Le message du 27/10 employait « rattachement » ; on ne le reprend pas.
- Fichiers de travail, temporaires (scratchpad de la session, disparaîtront) : `/private/tmp/claude-504/-Users-bfa-Developer-GitHub-frieslandv3/0821e292-5b83-41e9-875e-12c23af67817/scratchpad/` (`atom-pdv-zones.csv`, `analyse.mjs`, `exemples.mjs`, `cocody.mjs`).

### Chiffres par merchandiser (liste du 29/10, territoire actuel)

| Merchandiser | Binôme | Boutiques | Dans le territoire du binôme | Territoires affichés pour le merchandiser | Hors territoire du binôme |
|---|---|---|---|---|---|
| Gui Stéphane | Ophelia | 372 | 100 % | Koumassi, Marcory, Treichville | — |
| Kouamé Hellarion | Murielle | 654 | 100 % | Cocody | — |
| Guihi Bernadin | Anne Marie | 781 | 100 % | Cocody | — |
| Kouadio Anicet | Ophelia | 616 | 99 % | Abobo 1, Koumassi, Marcory, Port-Bouët 2 | Port-Bouët 2 : 4, Abobo 1 : 1 |
| Seregone Schadrack | Rachid | 856 | 98 % | Abobo 1, Abobo 2, Cocody | Cocody : 15 |
| Yao Venance | Rachid | 800 | 98 % | Abobo 1, Abobo 2, Adjamé | Adjamé : 17 |
| Zogbolou Kevin | Kamy | 1 172 | 94 % | Yopougon 1 à 4 | Yopougon 2 : 43, Yopougon 1 : 24 (Souare) |
| Abbé Frédéric | Armande | 971 | 86 % (≈ 95 % après reclassement) | Abobo 2, Adjamé, Attécoubé-Plateau, Cocody | Cocody : 74, quartier en guise de territoire : 47, Abobo 2 : 16 |
| Deheo Wilfried | Souare | 1 319 | 74 % (≈ 91 % après reclassement) | Attécoubé-Plateau, Cocody, Yopougon 1 à 4 | Attécoubé-Plateau : 282, Yopougon 3 et 4 : 56 (Kamy), Cocody : 1 |
| **Total** | | **7 541** | **92 % (≈ 96 %)** | | |

### Zone du fichier Atom et territoire actuel (9 680 boutiques actives)

| Zone Atom | Boutiques | Dans le territoire Friesland correspondant | Où Friesland les place surtout |
|---|---|---|---|
| Abobo 2 | 778 | 22 % | ABOBO 1 : 552 (Dokui, Belleville, Abobo Baoulé, Samaké) |
| Bingerville | 287 | 10 % | COCODY : 238 (Faya, Abatta, Bessikoi) |
| Bassam | 220 | 20 % | PORT-BOUËT 2 : 109, ADJAMÉ : 56 |
| Yopougon 2 | 1 382 | 54 % (Yopougon 3 + 4) | YOPOUGON 2 : 243, YOPOUGON 1 : 189 |
| Yopougon 1 | 794 | 65 % (Yopougon 1 + 2) | ATTÉCOUBÉ-PLATEAU : 156 (Locodjro, Agbayaté) |
| Marcory | 391 | 57 % | COCODY 49, KOUMASSI 44, TREICHVILLE 36 |
| Koumassi | 846 | 78 % | PORT-BOUËT 2 : 107 |
| Abobo 1 | 880 | 81 % | ABOBO 2 : 131 (PK 18, Banco 1) |
| Adjamé / Attécoubé | 883 | 85 % | COCODY : 74 (Paillet) |
| Port-Bouët | 354 | 93 % | — |
| Cocody 1, Cocody 2, Cocody | 2 066 | 97 à 99 % | un seul territoire COCODY (voir plus haut) |
| **Total** | **9 680** | **71 %** (77 % pour les boutiques présentes dans une liste) | |

Parmi les boutiques du fichier Atom, 2 661 ne figurent dans aucune liste : Yopougon 2 (423), Port-Bouët (354), Bingerville (277), Cocody 2 (287) et Bassam (174).

---

**Objet :** Pourquoi les territoires Atom ne sont pas ceux de Friesland

Bonjour Desire,

Comme convenu à la réunion du 29/10, voici pourquoi les territoires affichés pour les merchandisers Atom ne correspondent pas à ceux de vos commerciaux. Nous avons vérifié boutique par boutique.

### En résumé

Sur les 7 541 boutiques que visitent les 9 merchandisers Atom, **92 % sont déjà dans le territoire de leur commercial binôme. Une fois les boutiques reclassées dans le découpage définitif, la part monte à environ 96 %.** Les écarts que vous voyez à l'écran viennent surtout de la façon dont les territoires d'un merchandiser sont affichés. Ils ne traduisent pas un vrai désaccord sur le terrain.

### 1. Les territoires d'un merchandiser Atom sont déduits de sa liste de boutiques

Personne ne donne de territoires aux merchandisers Atom. Chaque nuit, l'application les recalcule à partir des boutiques qu'ils visitent. **Une seule boutique suffit à faire apparaître un territoire entier.** Par exemple :

- Kouadio Anicet (binôme Ophelia) affiche ABOBO 1 pour **une** boutique ;
- Deheo Wilfried (binôme Souare) affiche COCODY pour **une** boutique ;
- Seregone (binôme Rachid) affiche COCODY pour 15 boutiques sur 856 ;
- Abbé Frédéric (binôme Armande) affiche ABOBO 2 pour 16 boutiques sur 971.

À l'inverse, un territoire n'apparaît pas tant que le merchandiser n'y a aucune boutique, même si son routing y prévoit un jour. Par exemple, Seregone a un point de visite à Anyama et Zogbolou un à Songon, mais leur distributeur n'a aucune boutique autour de ces points. ANYAMA n'apparaît donc pas chez Seregone. Agboville, Adzopé et Bonoua n'ont aucun point de visite Atom.

### 2. La journée d'un merchandiser Atom suit un distributeur, pas un territoire

La liste d'un merchandiser vient de son routing. Chaque jour de chaque semaine, il a un point de visite et un distributeur, et il visite les boutiques de ce distributeur autour du point de visite. Chaque merchandiser suit un seul distributeur :

| Merchandiser | Distributeur | Commercial binôme |
|---|---|---|
| Yao Venance, Seregone Schadrack | Niare & Frères | Rachid |
| Deheo Wilfried | SODICOM-CI | Souare |
| Zogbolou Kevin | Nouveaux Distributeurs Associés | Kamy |
| Abbé Frédéric | Boussoura | Armande |
| Kouamé Hellarion | Plaisir Bachuss | Murielle |
| Guihi Bernadin | PRODISMA | Anne Marie |
| Gui Stéphane, Kouadio Anicet | SIDECOM | Ophelia |

Vos territoires, eux, sont ceux des commerciaux. Le découpage de la ville peut donc différer. Par exemple, Niare, le distributeur de Yao et de Seregone, a presque toutes vos boutiques en ABOBO 1 (932). Votre ABOBO 2 (N'Dotré, PK 18) est servi surtout par LKA Services (401 boutiques), et aucun merchandiser Atom ne suit LKA Services. Comme Rachid a les deux Abobo, cela ne change rien pour lui.

### 3. Atom a ses propres noms de zones

Le fichier Atom découpe Abidjan à sa façon, et ses zones ne recouvrent pas les vôtres :

- **Abobo** : sur 778 boutiques notées « Abobo 2 » par Atom, 552 sont pour vous en ABOBO 1 (Dokui, Belleville, Abobo Baoulé, Samaké…). Le découpage définitif confirme Dokui et Abobo Baoulé en ABOBO 1.
- **Yopougon** : Atom a 2 zones, vous en avez 4, plus les périphéries.
- **Bingerville** : sur 287 boutiques notées « Bingerville » par Atom, 238 sont en fait à Faya, Abatta ou Bessikoi, donc dans Cocody. Kouamé Hellarion a toujours « Bingerville » comme zone chez Atom, alors qu'il travaille dans Cocody. Murielle ayant les deux territoires, cela ne change rien pour elle.
- **La zone est saisie à la main**, souvent celle du merchandiser plutôt que celle de la boutique. Elle s'écrit de 46 façons, et 1 198 boutiques sont notées « Yopougon » ou « Cocody » sans numéro. Par exemple, 45 boutiques créées par Moustapha N'Diaye, le merchandiser de Bassam, sont notées « Bassam », alors qu'elles sont à Adjamé Dallas.

Au total, la zone du fichier Atom correspond à votre territoire pour 71 % des boutiques.

### 4. Vos boutiques ne sont pas encore reclassées dans le découpage définitif

Dans l'application, chaque boutique a encore le territoire qu'elle avait avant le 28/10. Le reclassement dans les 306 secteurs du découpage définitif fera disparaître la plupart des écarts restants :

- **Deheo Wilfried** : 282 de ses boutiques sont aujourd'hui en ATTÉCOUBÉ-PLATEAU (Armande). Parmi elles, 225 sont à Locodjro, Agbayaté ou Abobo Doumé, des secteurs que le découpage définitif place en YOPOUGON 1 et 2, chez Souare, son binôme.
- **Abbé Frédéric** : 74 de ses boutiques sont aujourd'hui en COCODY. Une cinquantaine sont à Paillet, à HMA ou dans les rues d'Adjamé, des secteurs que le découpage définitif place en ADJAMÉ 2, chez Armande, sa binôme.

Après reclassement, il restera environ 4 % de boutiques chez un autre commercial. Elles se trouvent surtout en bordure : par exemple, 67 boutiques de Zogbolou (binôme Kamy) dans les Yopougon 1 et 2 de Souare.

### 5. Certaines zones n'ont pas de merchandiser Atom

- Dans l'application, aucun merchandiser Atom actif ne couvre Port-Bouët, Bassam ou la ville de Bingerville. Moustapha N'Diaye y est désactivé, alors qu'il figure toujours comme actif dans le fichier Atom. Kena n'a donc aucun binôme Atom.
- 2 661 boutiques du fichier Atom ne sont dans la liste d'aucun merchandiser, surtout à Yopougon, Port-Bouët, Bingerville, Cocody et Bassam.

### 6. Le cas de Cocody

Cocody est maintenant un seul territoire, partagé par quartier entre Murielle et Anne Marie. Là aussi, Atom suit bien le partage :
- Kouamé (binôme Murielle) : 476 boutiques dans les quartiers de Murielle, aucune chez Anne Marie ;
- Guihi (binôme Anne Marie) : 436 boutiques dans les quartiers d'Anne Marie, 6 chez Murielle.

Il reste un point à trancher : **le quartier « 2 Plateaux » figure dans les listes des deux commerciaux**, et Guihi y visite 229 boutiques. Il faut nous dire à qui il revient.

### Ce que nous proposons

1. **Reclasser les boutiques dans les 306 secteurs du découpage définitif.** C'est ce qui réduit le plus les écarts.
2. **Sur l'écran d'administration, n'afficher pour un merchandiser Atom que les territoires où il a un nombre réel de boutiques**, par exemple au moins 20. L'écran montrerait ainsi son vrai terrain, sans rien changer à ses visites.
3. **Nous dire à qui revient 2 Plateaux** : Murielle ou Anne Marie.
4. **Confirmer si Atom doit couvrir Port-Bouët, Bassam et Bingerville**, et, si oui, avec quel merchandiser.
5. Si vous souhaitez qu'Atom utilise vos noms de territoires dans ses fichiers, nous le verrons avec Elias KOME.

Je reste disponible pour en parler.

Bien cordialement,

Jean Luc Houedanou
