# Notifications push — actions assignées

## Ce que ça fait

Quand un commercial assigne une action à un merchandiseur, le téléphone du
merchandiseur sonne, même application fermée. C'est ce qui manquait : jusqu'ici
l'app ne prévenait qu'à l'écran, application ouverte (toast + badge), et le
commercial devait relancer par WhatsApp.

Trois niveaux, du plus léger au plus lourd, tous en place :

| Situation | Ce que voit le merchandiseur |
|---|---|
| App ouverte | Toast immédiat + badge sur l'onglet Actions (Realtime, déjà livré) |
| App en arrière-plan ou fermée | Notification Android sur l'écran de veille (ce document) |
| Téléphone éteint / hors réseau | La notification arrive au rallumage, FCM la garde |

La notification nomme le point de vente, le type d'action et l'échéance. Un
appui ouvre la liste des actions.

## État : en attente du client

**Le code est en place, l'envoi est inerte tant que Firebase n'est pas fourni.**
Rien ne casse entre-temps : sans `google-services.json`, le plugin Android n'est
pas activé (`android/app/build.gradle`, bloc `try` en fin de fichier),
l'enregistrement du téléphone échoue en silence, et l'app se comporte exactement
comme aujourd'hui.

### Ce que le client doit fournir

1. **Un projet Firebase** sur le compte Google de Friesland, avec une
   application Android déclarée sous l'identifiant exact `com.bdco.bonnetrouge`.
2. **Le fichier `google-services.json`** de cette application → à déposer dans
   `android/app/google-services.json` (non versionné, comme le keystore).
3. **Un compte de service** (Firebase → Paramètres → Comptes de service →
   « Générer une nouvelle clé privée ») : un fichier JSON contenant une clé
   privée. À transmettre par un canal sûr, jamais par e-mail ni par messagerie.

> L'ancienne « clé serveur » Firebase ne fonctionne plus : Google a fermé
> l'API legacy. Seul le compte de service permet d'envoyer.

## Installation, une fois les fichiers reçus

### 1. Secret de la fonction Edge

```bash
supabase secrets set FCM_SERVICE_ACCOUNT="$(cat chemin/vers/service-account.json | tr -d '\n')"
supabase functions deploy notifier-action
```

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement par
la plateforme, il n'y a rien à déclarer pour eux.

### 2. Secrets Vault, pour que la base puisse appeler la fonction

À exécuter une fois dans le SQL Editor du projet Supabase :

```sql
select vault.create_secret(
  'https://<ref-projet>.supabase.co/functions/v1/notifier-action',
  'edge_notifier_action_url'
);
select vault.create_secret('<clé service_role du projet>', 'edge_notifier_action_token');
```

Tant que ces deux secrets n'existent pas, le déclencheur
`trg_action_commerciale_push` ne fait rien et n'échoue pas : créer une action
reste possible en toutes circonstances.

### 3. Nouveau build Android

Le plugin push est une dépendance native : il faut un nouvel APK/AAB signé et
une nouvelle mise en ligne sur le Play Store. Penser à incrémenter
`versionCode` et `versionName` dans `android/app/build.gradle` (voir
`docs/BUILD-ANDROID.md`). Le keystore est détenu par le client.

## Comment ça marche

```
Commercial crée une action
  └─ INSERT sur action_commerciale
       ├─ Realtime  → toast + badge si l'app est ouverte   (layouts/mobile.vue)
       └─ trigger trg_action_commerciale_push
            └─ pg_net → fonction Edge notifier-action
                 ├─ relit l'action (PDV, type, échéance) en service_role
                 ├─ lit les jetons de l'assigné dans appareil_push
                 └─ FCM HTTP v1 → téléphone(s)
```

| Élément | Emplacement |
|---|---|
| Table des jetons + déclencheur | `supabase/nouveau/20260911140000_friesland_push_actions.sql` |
| Envoi FCM | `supabase/functions/notifier-action/index.ts` |
| Enregistrement du téléphone, permission, canal, appui | `composables/usePushNotifications.ts` |
| Branchement au démarrage natif | `plugins/native-app.client.ts` |
| Retrait du jeton à la déconnexion | `stores/auth.ts` (`logout`) |

Points de conception à connaître :

- **Un jeton par appareil**, table `appareil_push`, pas une colonne sur
  `profiles` : une personne peut avoir deux téléphones, et le jeton change à
  chaque réinstallation de l'app.
- **Le déclencheur ne bloque jamais l'insertion.** L'appel HTTP est asynchrone :
  une notification perdue laisse l'action visible dans l'app, l'inverse serait
  inacceptable.
- **Réassignation comprise** : le déclencheur part aussi quand `assigne_a`
  change, pas seulement à la création.
- **Jetons morts purgés** : FCM répondant `UNREGISTERED` fait supprimer le
  jeton, sinon la table se remplit d'appareils désinstallés.
- **Rien de lisible ne transite dans le déclencheur** : il n'envoie que
  l'identifiant de l'action, la fonction Edge relit le reste.
- **Android 13+** demande la permission de notifier à l'exécution ; elle est
  demandée au premier lancement après connexion. Refusée, tout le reste continue
  de fonctionner.

## Vérifier que ça marche

1. Se connecter sur l'APK avec un compte merchandiseur, accepter la permission.
2. `select jeton, user_id from appareil_push;` → une ligne doit apparaître.
3. Depuis un compte commercial, créer une action assignée à ce merchandiseur.
4. Le téléphone doit sonner, application fermée.
5. En cas de silence : `supabase functions logs notifier-action` donne la raison
   (aucun appareil, refus FCM, secret manquant).
