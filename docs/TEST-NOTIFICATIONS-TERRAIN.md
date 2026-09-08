# Tester les notifications d'actions — guide terrain

Ce guide permet de vérifier soi-même, sans outil technique, qu'un merchandiseur
reçoit bien une notification quand son commercial lui assigne une action.

Comptez 10 minutes et **deux téléphones** : un pour le commercial, un pour le
merchandiseur. À défaut, un téléphone et l'application web pour le commercial.

## Avant de commencer

| À vérifier | Comment |
|---|---|
| Version de l'app | 1.0.6 ou plus récente, sur les **deux** téléphones. Menu « Plus » → bas de l'écran. Une version antérieure ne reçoit aucune notification. |
| Le merchandiseur a un commercial | Le commercial le voit dans « Mon équipe ». Sinon, l'administrateur le rattache dans Utilisateurs → Équipes. |
| Le merchandiseur a autorisé les notifications | Voir ci-dessous. |

### Autoriser les notifications sur le téléphone du merchandiseur

L'autorisation est demandée **une seule fois**, au premier lancement après
connexion. Si elle a été refusée, il faut la réactiver à la main :

Réglages Android → Applications → **Friesland Bonnet Rouge** → Notifications →
activer, et vérifier que la catégorie **« Actions à réaliser »** est active.

## Le test

**Sur le téléphone du merchandiseur**

1. Se connecter avec son compte.
2. Revenir à l'écran d'accueil du téléphone (bouton Accueil ou balayage vers le
   haut). L'application doit rester en arrière-plan.

> ⚠️ Ne **forcez pas l'arrêt** de l'application depuis les réglages Android.
> Dans cet état, Android bloque toute notification jusqu'au prochain lancement
> manuel — ce n'est pas un défaut de l'application. Fermer l'app par balayage ou
> verrouiller le téléphone ne pose aucun problème.

**Sur le téléphone du commercial**

3. Se connecter avec le compte commercial.
4. Onglet **PDV** → ouvrir un point de vente du territoire de ce merchandiseur.
5. Section **Actions commerciales** → bouton **Nouvelle action**.
6. Renseigner : type d'action, **Merchandiseur assigné** = la personne testée,
   une échéance, un commentaire. Valider.

**Résultat attendu, en moins de 10 secondes**

Le téléphone du merchandiseur sonne et affiche :

> **Friesland Bonnet Rouge**
> **[Type d'action] — [Nom du point de vente]**
> [Nom du commercial] vous a assigné une action · pour le [date]

7. Appuyer sur la notification : l'application s'ouvre directement sur l'écran
   **Actions commerciales**, filtre « Ouvertes », avec l'action en tête de liste.

> Si plusieurs notifications se sont empilées, Android les regroupe. Appuyer sur
> l'en-tête du groupe ouvre simplement l'application ; il faut **déplier le
> groupe** (petite flèche à droite) puis appuyer sur la ligne voulue.

## Les autres signaux, à vérifier au passage

| Signal | Où | Quand |
|---|---|---|
| Message qui apparaît en haut de l'écran | Sur le téléphone du merchandiseur, **application ouverte** | Immédiatement à la création de l'action |
| Pastille chiffrée rouge | Onglet « Actions » (commercial) ou « Plus » (merchandiseur) | Compte les actions ouvertes qui lui sont assignées |
| La pastille redescend | Même endroit | Quand l'action passe à « faite » ou est supprimée |

## Si rien n'arrive

Reprendre dans cet ordre — la cause est presque toujours dans les trois premières
lignes :

| Symptôme | Cause la plus fréquente | Ce qu'il faut faire |
|---|---|---|
| Aucune notification, jamais | Version de l'app antérieure à 1.0.6 | Installer la dernière version sur le téléphone du merchandiseur |
| Aucune notification, jamais | Autorisation refusée | Réglages Android → Applications → Bonnet Rouge → Notifications |
| Aucune notification, jamais | Application arrêtée de force | Rouvrir l'application une fois, puis refaire le test |
| Rien après un changement de téléphone ou une réinstallation | L'application doit se réenregistrer | Ouvrir l'application une fois en étant connecté |
| Notification en retard | Téléphone en économie d'énergie | Réglages → Batterie → retirer Bonnet Rouge des applications restreintes |
| Notification reçue, mais l'action n'apparaît pas | Écran resté ouvert en arrière-plan | Tirer la liste vers le bas pour la recharger |
| Le merchandiseur reçoit les actions d'un autre | Mauvais rattachement | Administration → Utilisateurs → Équipes |

Si le problème persiste après ces vérifications, signalez-le en précisant : le
compte concerné, l'heure exacte de création de l'action, le modèle de téléphone
et sa version d'Android. Ces quatre informations permettent de retrouver l'envoi
dans les journaux techniques.

## Ce que les notifications ne font pas

- **Elles ne remplacent pas le périmètre.** Un merchandiseur voit toujours les
  mêmes points de vente qu'avant : ce sont ses territoires qui décident, pas son
  rattachement à un commercial.
- **Elles ne préviennent que la personne assignée.** Une action sans
  merchandiseur assigné ne déclenche aucune notification.
- **Elles ne remplacent pas la relance WhatsApp**, qui reste disponible depuis
  l'écran Actions du commercial — utile quand le merchandiseur n'a pas encore
  installé la nouvelle version.

---

Détails techniques (déclencheur, fonction d'envoi, Firebase) :
`docs/PUSH-NOTIFICATIONS.md`.
