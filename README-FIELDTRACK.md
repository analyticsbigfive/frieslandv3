# FieldTrack — version white-label

Cette branche `feat/white-label-fieldtrack` est une version **débrandée** de
l'application, sans aucune référence à Friesland Campina / Bonnet Rouge, mais
**pointant sur le même backend Supabase** (mêmes accès, mêmes données).

## Ce qui change par rapport à la branche principale
- **Nom** : « FieldTrack » (au lieu de « Friesland Bonnet Rouge ») — app web,
  PWA, APK Android, en-têtes admin et mobile, écran de connexion.
- **Couleur d'accent** : ardoise `#0F172A` (au lieu du rouge `#C8102E`). Les
  classes `fc-red` sont conservées, seule leur valeur change dans
  `tailwind.config.ts`.
- **Identité Android** : `appId` / `applicationId` = `com.fieldtrack.app`,
  `appName` = `FieldTrack`. Le namespace Java interne reste inchangé pour
  éviter un refactor lourd (non visible par l'utilisateur).
- **Logo / icônes / splash** : monogramme « FT » neutre (généré dans
  `resources/icon.png`, `assets/logo.png`, `public/favicon.png`, icônes
  Android).

## Ce qui NE change pas
- Backend, schéma et données Supabase (mêmes `SUPABASE_URL` / clés dans `.env`).
- Noms des migrations SQL (`*_friesland_*`) — internes, sans impact visible.
- Toute la logique métier (tournée GPS, visites, Perfect Store, suivi, etc.).

## Build
Identique à la branche principale (voir `docs/BUILD-ANDROID.md`) :
```bash
pnpm run android:apk   # APK debug FieldTrack
```
L'APK s'installe à côté de l'app Friesland (appId différent) sans conflit.
