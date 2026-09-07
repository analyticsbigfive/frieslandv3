-- ============================================================================
-- LECTURE DE `pdv` BORNÉE AU PÉRIMÈTRE (demande du 7 septembre 2026)
--
-- Constat : `pdv_select_auth` (_archive/001c_indexes_triggers_rls.sql:109) rend
-- les 25 391 PDV lisibles par TOUT authentifié. Les visites, elles, ont été
-- resserrées (20260907140100 puis 20260907150100) — d'où deux effets :
--
--  1) Analyse faussée pour le commercial. Toutes les RPC du dashboard sont
--     `security invoker` : leur CTE `scope_pdv`, issue de `pdv`, compte le parc
--     ENTIER pendant que les CTE de visites ne rendent que son périmètre.
--     `couverture_pct` s'effondre, `dispo_moyenne` se dilue, et
--     `alertes = pdv_total` devient structurel — le symptôme mesuré le 7 sept.
--     sur les 37 zones.
--
--  2) Le cloisonnement n'existait que côté client : `pdvInScope()`
--     (composables/useUserScope.ts:27) applique déjà exactement cette règle,
--     mais après avoir téléchargé tout le parc.
--
-- La politique ci-dessous applique côté serveur la règle déjà appliquée côté
-- client. Vérifié avant écriture : les 24 merchandiseurs et les 13 commerciaux
-- actifs ont tous un territoire assigné, et `pdv_ids_perimetre()` dégrade en
-- « tout le parc » quand aucun territoire n'est posé — personne ne se retrouve
-- avec un écran vide.
--
-- Idempotent. Additif (aucune donnée touchée).
-- ============================================================================
begin;

alter table public.pdv enable row level security;

-- L'ancienne politique est permissive : la laisser en place annulerait la
-- nouvelle (les politiques SELECT se combinent en OR).
drop policy if exists "pdv_select_auth" on public.pdv;
drop policy if exists "pdv_select_perimetre" on public.pdv;
create policy "pdv_select_perimetre" on public.pdv for select to authenticated
  using (
    -- Court-circuit : évite d'évaluer la fonction pour qui voit tout.
    public.role_actif_courant() in ('admin', 'superviseur')
    -- pdv_ids_perimetre() est SECURITY DEFINER : elle lit `pdv` en tant que
    -- propriétaire, donc sans réentrer dans cette politique.
    or pdv_id in (select public.pdv_ids_perimetre())
  );

comment on policy "pdv_select_perimetre" on public.pdv is
  'Lecture bornée aux territoires et quartiers assignés. Miroir serveur de pdvInScope() (composables/useUserScope.ts). Admin et superviseur voient tout le parc.';

commit;
