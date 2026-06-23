# Audit sécurité & cohérence — Dashboard + Mobile

Audit multi-agents (Nuxt 3 + Supabase). **31 findings confirmés** après vérification adversariale.

| Sévérité | Count |
|---|---|
| 🔴 Critique | 3 |
| 🟠 Haute | 3 |
| 🟡 Moyenne | 5 |
| ⚪ Basse | 15 (+ doublons fusionnés) |

---

## 1. CRITIQUE

### C1 — Clé `service_role` Supabase committée dans `.env`
**Fichier** : `.env` (suivi par git + présent dans l'historique ; `.gitignore` ajouté trop tard). Scripts liés : `scripts/*.mjs`.
**Risque** : la clé `service_role` (bypass total RLS) est dans le dépôt GitHub. Quiconque a accès au repo a un accès admin complet à la base. **Le pire finding.**
**Correctif (action requise, non corrigeable en code seul)** :
1. **Régénérer la clé `service_role`** dans le dashboard Supabase (invalide la clé fuitée). + régénérer l'anon key par prudence.
2. `git rm --cached .env` puis commit (stoppe le suivi ; le fichier local reste).
3. **Purger de l'historique git** (`git filter-repo` / BFG) puis force-push — destructif, à confirmer.
4. Mettre les clés en variables d'environnement de déploiement (jamais en repo).

### C2 — Auto-escalade de rôle : `profiles_update_own` sans `WITH CHECK`
**Fichier** : `supabase/001c_indexes_triggers_rls.sql:100` (miroir `001_initial_schema.sql:251`).
**Risque** : `CREATE POLICY profiles_update_own FOR UPDATE USING (auth.uid()=id)` sans `WITH CHECK` ni restriction de colonnes. Un merchandiser/commercial peut, via la clé anon exposée, `supabase.from('profiles').update({ role:'admin' }).eq('id', monId)` → **promotion en admin**. La garde existe seulement côté client (`stores/auth.ts:182-183`), trivialement contournable. Permet aussi à un superviseur de se promouvoir via l'UI `admin/users` (édition de sa propre ligne).
**Correctif** : migration DROP+CREATE —
```sql
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin'));
```
Défense en profondeur : trigger BEFORE UPDATE (SECURITY DEFINER) levant une exception si `role`/`is_active` change et appelant non-admin. Gérer les rôles via RPC admin.

### C3 — XSS stocké via popup Leaflet `bindPopup` (carte admin + carte mobile)
**Fichier** : `pages/admin/map.vue`, `pages/mobile/map.vue`.
**Risque** : `image_url` (et champs PDV) injectés en HTML dans `bindPopup(...)` sans échappement → XSS stocké. Amplifié par H1 (tout authentifié peut écrire `image_url` de n'importe quel PDV) → un compte terrain peut injecter un payload qui s'exécute dans la session admin.
**Correctif** : construire le contenu du popup en DOM (`createElement` + `textContent`, `.src/.alt`) et passer l'`HTMLElement` à `bindPopup(el)`. Valider `image_url` par allowlist (https + domaine Supabase storage). Corriger H1 en parallèle.

---

## 2. HAUTE

### H1 — Policy UPDATE `pdv` ouverte à tout authentifié (`OR auth.role()='authenticated'`)
`supabase/001c_indexes_triggers_rls.sql:111-115` (miroir `001_initial_schema.sql:264-268`). Le `OR auth.role()='authenticated'` réduit le `USING` à TRUE → check admin mort, pas de `WITH CHECK`. Tout compte peut modifier n'importe quel PDV (GPS, zone, `image_url`…). Amplificateur de C3. `updatePDV` (`stores/pdv.ts:203`) sans filtre. **Fix** : policy `pdv_update_admin` (role IN admin/superviseur) en `USING` + `WITH CHECK` ; branche scopée si édition terrain requise. Vérifier aussi `pdv_insert_auth`.

### H2 — Bucket storage `visite-images` PUBLIC en lecture
`supabase/001c:145-152`. Bucket `public=true` + policy select sans auth → photos terrain (géolocalisées, PII) accessibles anonymement via `/storage/.../public/...`. URLs publiques permanentes stockées en clair. **Fix** : bucket privé + `createSignedUrl(ttl)` ; stocker les chemins, pas les URLs ; cache PWA storage → `NetworkFirst` ; re-signer l'existant.

### H3 — Mots de passe par défaut en dur dans des scripts committés
`scripts/create-commercial-accounts.mjs:63` (+ `reset-admin-password.mjs`, `create-users-from-zones.mjs`). `admin@friesland.ci` / `Test1234!`, `FrieslandCI2025!`… Combiné à `profiles_select_all` (énumération d'emails) → connexion sur tout compte n'ayant pas changé son mdp. **Fix** : retirer les mdp du code ; **rotation immédiate** des comptes concernés ; flag `must_change_password`.

---

## 3. MOYENNE (résumé)

- **M1** — `admin/users` accessible aux superviseurs ; actions UPDATE/DELETE échouent silencieusement (RLS) + escalade self-edit (= C2). Fix : `middleware/admin-strict` (admin only) sur `admin/users/**` + masquer actions si `!isAdmin` + RLS.
- **M2** — RPC import `SECURITY DEFINER` sans check de rôle ni REVOKE (`supabase/002:103,187,413`). Fix : check `role='admin'` en tête + `REVOKE EXECUTE ... FROM authenticated` + `SET search_path`.
- **M3** — `visites_insert` sans `WITH CHECK (auth.uid()=user_id)` → usurpation de `user_id`/`commercial`/`email`, pollution des stats. Fix : `WITH CHECK` + trigger dérivant les champs.
- **M4** — `import-export.vue:132` passe une string brute à `importPDVFromCSV` (attend un array) → crash ; imports visites/zones/routing = faux succès (no-op). Fix : `parseCsv` d'abord ; implémenter ou désactiver les autres types.
- **M5** — `profiles_select_all USING(true)` → tout authentifié lit email/téléphone/role de tous (annuaire exposé). Fix : policy scopée + VIEW publique sans PII pour l'annuaire mobile.

## 4. BASSE (15)

B1 injection filtre `.or()` (`stores/pdv.ts:93`) · B2 upload sans validation type/taille · B3 incohérence middleware/RLS suppr. visites superviseur · B4 `taux_prix_*` codés à 0 mais exportés · B5 fallback dashboard ignore filtres · B6 `<definePageMeta>` dans le template (`admin/index.vue:3`) · B7 cookies maxAge 30j / pas de CSP · **B8 clés SKU `cereales` divergentes (corrigé sur la branche feature)** · B9 catégorie `cereales` jamais collectée par le formulaire · B10 export Excel omet cereales + SKU non-EVAP · B11 items visibilité intérieure incomplets · B12 `SECURITY DEFINER` sans `search_path` · B13 création PDV terrain exclut `commercial` · B14 `syncRoutingStatus` machine à états figée · B15 mapping titre mobile mort.

> Cause structurelle de la moitié des incohérences : **duplication** des définitions SKU et listes visibilité → centraliser (`utils/products.ts` déjà créé règle B8).

---

## 5. Plan d'action ordonné

**Phase 0 — Confinement immédiat (action utilisateur) :**
1. C1 : régénérer la clé `service_role` Supabase. *Bloquant.*
2. H3 : rotation mdp `admin@friesland.ci` + comptes en mdp connu.

**Phase 1 — RLS (une migration DROP+CREATE) :** C2 (WITH CHECK profiles) · H1 (pdv_update_admin) · M5 (profiles_select scoped) · M3 (visites_insert) · M2 (RPC import gardes + REVOKE).

**Phase 2 — XSS & nettoyage :** C3 (escape DOM maps) · H2 (bucket privé + URLs signées) · M1 (middleware admin-strict users) · M4 (fix import).

**Phase 3 — Durcissement & cohérence (backlog) :** B12 search_path · B7 cookies/CSP · B2 upload · B1 sanitize · B4/B8/B10/B11 cohérence SKU/export · B3/B5/B6/B13/B14/B15 qualité · purge historique git (.env, scripts) après C1/H3.

**Fichiers les plus critiques** : `.env`, `supabase/001c_indexes_triggers_rls.sql` (+ miroir `001_initial_schema.sql`), `pages/admin/map.vue`, `pages/mobile/map.vue`, `scripts/*.mjs`.
