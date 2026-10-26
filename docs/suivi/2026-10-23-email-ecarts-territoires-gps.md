**Objet :** Abidjan – écarts de découpage Atom / Friesland et points de visite à repositionner

**Pièces jointes :**
- `2026-10-23-ecarts-zones-atom-territoires-friesland.csv`
- `2026-10-23-points-de-visite-gps-a-verifier.csv`

---

Bonjour à tous,

En regardant la réclamation de Seregone (Abobo 2), qui reçoit des boutiques situées chez Yao, nous avons trouvé deux sujets qui concernent tous les merchandisers Atom d'Abidjan. Les voici, avec les décisions et les informations dont nous avons besoin.

## 1. Atom et Friesland ne découpent pas les zones de la même façon

Nous avons comparé les 4 626 boutiques de l'export Atom importé le 06/10 :
- **la zone notée dans le fichier Atom** (colonne « Zone / Quartier ») ;
- **le territoire Friesland de la boutique**, déduit de sa position GPS (les boutiques Friesland voisines).

Pour Yopougon, nous avons rapproché « Yopougon 1 » d'Atom de YOPOUGON 1 + 2 chez Friesland, et « Yopougon 2 » de YOPOUGON 3 + 4, comme dans le routing actuel.

| Zone dans le fichier Atom | Boutiques | Territoire Friesland correspondant | Part dans ce territoire |
|---|---|---|---|
| Port-Bouët | 175 | PORT-BOUET | 100 % |
| Adjamé / Attécoubé | 321 | ADJAME + ATTECOUBE-PLATEAU | 94 % |
| Koumassi | 409 | KOUMASSI | 84 % |
| Yopougon 1 | 427 | YOPOUGON 1 + 2 | 79 % |
| Abobo 1 | 663 | ABOBO 1 | 78 % |
| Yopougon 2 | 662 | YOPOUGON 3 + 4 | 68 % |
| Cocody 2 | 335 | COCODY 2 | 59 % |
| Cocody 1 | 299 | COCODY 1 | 57 % |
| Marcory | 87 | MARCORY | 40 % |
| Bassam | 91 | Bassam | 38 % (44 en PORT-BOUET) |
| **Abobo 2** | **585** | **ABOBO 2** | **26 %** (418 en ABOBO 1) |
| **Bingerville** | **215** | **BINGERVILLE** | **12 %** (180 en COCODY 1 et 2) |

Ce qu'il faut retenir :
- **Abobo :** chez Friesland, ABOBO 1 couvre presque tout Abobo, et ABOBO 2 ne couvre guère que le côté N'Dotré / PK 18. Chez Atom, Abobo 1 est le centre et le nord (Yao), et Abobo 2 le sud-est et N'Dotré (Seregone). Résultat : la tablette affiche « ABOBO 1 », la zone de Yao, sous la plupart des boutiques de Seregone.
- **Cocody 1 et Cocody 2 :** les deux découpages ne se recoupent presque pas, avec environ 4 boutiques sur 10 de l'autre côté.
- **Bingerville :** pour Friesland, la plupart de ces boutiques sont dans Cocody.
- **Le fichier Atom écrit les zones de 46 façons différentes** (« Cocody2 », « Cicody 2 », « Port bouet( Gonzague) »…). Par ailleurs, 356 boutiques sont notées « Yopougon » ou « Cocody » sans numéro.
- Quelques écarts viennent sans doute de la position de la boutique elle-même plutôt que du découpage : par exemple 14 boutiques notées « Koumassi » sont placées dans Abobo.

**Décision à prendre**, au choix :
1. **Aligner les deux découpages :** Atom et Friesland se mettent d'accord sur une seule définition des secteurs (Abobo 1 / 2, Cocody 1 / 2, Yopougon, Bingerville), utilisée par tout le monde.
2. **Garder les deux découpages côte à côte :** l'application montre aux merchandisers Atom le découpage d'Atom, et le dashboard garde celui de Friesland comme référence, avec le découpage Atom à côté. Les chiffres de Friesland ne changent pas. Dans ce cas, il nous faut une liste fixe des noms de zones Atom.

## 2. Points de visite à repositionner

Les boutiques d'un jour sont choisies autour du point de visite du routing. Si ce point est mal placé, le merchandiser reçoit des boutiques ailleurs, parfois dans la zone d'un collègue. La visite corrige la position d'une boutique, mais jamais celle du point de visite.

### 2a. Position approximative : 45 points de visite

Ces points n'ont pas pu être confirmés au contrôle du 17/10, et leur position n'a pas changé depuis. Soit le lieu est douteux, soit il est introuvable sur la carte et la position a été donnée par l'agence.

| Merchandiser | Points de visite |
|---|---|
| Seregone Schadrack | CMPC, CMPC 2, Belle vie, Abobo Belle vie, Colochat, Cazar, Alépé, Colatier |
| Yao Venance | Avocatier le Grand, Avocatier marché de nuit, Avocatier 32e arrondissement, Pharmacie Lamé, Niamké, 14e arrondissement, Quartier Yacouba, Djibi, Mâle, Château, Abobo 4 étages |
| Gui Stéphane | Grand marché, Snap, Konan Raphaël, Marie Core, Déguerpis, Zone portuaire, Texas |
| Guihi Bernadin | Mahou Dokoui, Allocodrome, CAD, Blockoss, CA (à confirmer) |
| Kouadio Atoffe | 3 Ampoules, Quartier Adioukrou, Grand carrefour, Petroci, Sans fil |
| Abbé Frédéric | Paillet, Cité Rane, Attécoubé 1, Vidange |
| Kouamé Hellarion | Djorobité 1, Djorobité 2, Faya Ephrata |
| Deheo Wilfried | Agbayaté 2, Assonvon |

Deux exemples :
- **Belle vie / Abobo Belle vie (Seregone) :** les 62 boutiques du quartier Belleville sont environ 4,8 km plus à l'est que le point actuel.
- **Alépé :** c'est une ville à plus de 30 km, mais le point est placé dans Abobo.

**Ce dont nous avons besoin :** pour chaque point, la vraie position, si possible relevée sur place par le merchandiser (partage de position WhatsApp ou lien Google Maps). Nous recalculons les tournées dès réception.

### 2b. Position correcte, mais peu ou pas de boutiques du distributeur : 14 points de visite

Pour ces points, la position est bonne, mais il y a 10 boutiques ou moins du distributeur du jour dans un rayon de 800 m. Soit le quartier n'a pas encore de boutiques recensées, soit le distributeur n'est pas présent dans ce quartier.

| Merchandiser | Points de visite |
|---|---|
| Seregone Schadrack | Anyama, Biabou, Djibi village |
| Kouamé Hellarion | Abatta, Angré Mahou 1, Angré Mahou 2 |
| Gui Stéphane | CHU, Zone 4, Biétry |
| Guihi Bernadin | 2 Plateaux (Casa), 2 Plateaux (Valon) |
| Deheo Wilfried | Niangon, Azito |
| Zogbolou Kevin | Songon |

**Ce dont nous avons besoin :** pour chacun, dites-nous s'il faut recenser les boutiques du quartier ou changer de distributeur pour ce jour.

Le fichier joint donne, pour chaque point, le jour, la semaine, la position actuelle et le nombre de boutiques autour.

Merci d'avance pour vos retours.

Bien cordialement,

Jean Luc Houedanou
