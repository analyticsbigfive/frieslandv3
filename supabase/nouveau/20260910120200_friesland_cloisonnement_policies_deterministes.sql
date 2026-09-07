-- ============================================================================
-- CLOISONNEMENT : rendre les politiques de LECTURE déterministes
--
-- Constat après application de 20260910120000, avec le compte
-- qa.merchandiser@friesland-test.ci :
--   - public.pdv_dans_perimetre() renvoie bien FALSE pour un merchandiseur
--     (vérifié par appel RPC direct) ;
--   - mais il lit toujours LES DEUX actions en base, dont une qui ne lui est
--     ni assignée ni imputable.
--
-- Une seule explication tient : il existe sur `action_commerciale` une
-- politique SELECT permissive supplémentaire, posée hors dépôt. Les politiques
-- PERMISSIVE se combinent en OR — une seule suffit à tout rouvrir. Le même
-- précédent est documenté pour `visites` en tête de 20260907140100 :
-- « politique posée hors dépôt, nom inconnu ».
--
-- On ne peut pas la nommer depuis le dépôt : `pg_policies` n'est pas exposée
-- par PostgREST. Cette migration ne devine donc rien — elle ÉNUMÈRE les
-- politiques réellement présentes, retire toutes celles qui gouvernent la
-- lecture (SELECT et ALL), et redéclare l'ensemble complet voulu. L'état final
-- ne dépend plus de ce qui traînait avant.
--
-- Les noms retirés sont affichés en NOTICE : les conserver, ils documentent ce
-- qui existait réellement en base.
--
-- Idempotent. Rejouable sans effet de bord.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1) Purge des politiques de lecture posées hors dépôt
-- ---------------------------------------------------------------------------
-- `ALL` couvre aussi l'écriture : les politiques d'écriture voulues sont
-- redéclarées intégralement plus bas, rien n'est perdu.
do $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select schemaname, tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and tablename in ('action_commerciale', 'field_coaching')
      and cmd in ('SELECT', 'ALL')
  loop
    raise notice 'Politique retirée : %.% → "%" (%)', r.schemaname, r.tablename, r.policyname, r.cmd;
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    n := n + 1;
  end loop;
  raise notice '% politique(s) de lecture retirée(s).', n;
end $$;

-- ---------------------------------------------------------------------------
-- 2) action_commerciale : jeu complet et unique
-- ---------------------------------------------------------------------------
alter table public.action_commerciale enable row level security;

-- Lecture. Le merchandiseur ne passe que par `assigne_a` ou `auteur_id` :
-- pdv_dans_perimetre() est faux pour lui depuis 20260910120000. Il voit donc
-- exactement « les actions qu'il doit réaliser ».
create policy action_commerciale_select on public.action_commerciale
  for select to authenticated
  using (
    auteur_id = auth.uid()
    or assigne_a = auth.uid()
    or public.pdv_dans_perimetre(pdv_id)
  );

-- Écriture : identique au lot 3 (20260907150000:137-163), redéclarée pour que
-- le jeu de politiques soit complet même si une politique ALL a été retirée.
drop policy if exists action_commerciale_insert on public.action_commerciale;
create policy action_commerciale_insert on public.action_commerciale
  for insert to authenticated
  with check (
    auteur_id = auth.uid()
    and public.role_actif_courant() in ('commercial', 'admin', 'superviseur')
    and public.pdv_dans_perimetre(pdv_id)
  );

drop policy if exists action_commerciale_update on public.action_commerciale;
create policy action_commerciale_update on public.action_commerciale
  for update to authenticated
  using (
    auteur_id = auth.uid()
    or assigne_a = auth.uid()
    or public.role_actif_courant() in ('admin', 'superviseur')
  )
  with check (
    auteur_id = auth.uid()
    or assigne_a = auth.uid()
    or public.role_actif_courant() in ('admin', 'superviseur')
  );

drop policy if exists action_commerciale_delete on public.action_commerciale;
create policy action_commerciale_delete on public.action_commerciale
  for delete to authenticated
  using (public.role_actif_courant() = 'admin');

-- ---------------------------------------------------------------------------
-- 3) field_coaching : jeu complet et unique
-- ---------------------------------------------------------------------------
alter table public.field_coaching enable row level security;

-- Le test de rôle est redondant avec pdv_dans_perimetre() : c'est voulu. Le
-- coaching évalue des personnes, il ne doit pas pouvoir se rouvrir par une
-- évolution de la fonction partagée avec les actions.
create policy field_coaching_select on public.field_coaching
  for select to authenticated
  using (
    auteur_id = auth.uid()
    or assigne_a = auth.uid()
    or superviseur_id = auth.uid()
    or (
      public.role_actif_courant() in ('commercial', 'superviseur', 'admin')
      and public.pdv_dans_perimetre(pdv_id)
    )
  );

-- Écriture : identique au lot 4 (20260907160000:100-113).
drop policy if exists field_coaching_insert on public.field_coaching;
create policy field_coaching_insert on public.field_coaching
  for insert to authenticated
  with check (
    auteur_id = auth.uid()
    and public.role_actif_courant() in ('superviseur', 'commercial', 'admin')
  );

drop policy if exists field_coaching_update on public.field_coaching;
create policy field_coaching_update on public.field_coaching
  for update to authenticated
  using (
    auteur_id = auth.uid() or assigne_a = auth.uid()
    or public.role_actif_courant() in ('admin', 'superviseur')
  )
  with check (
    auteur_id = auth.uid() or assigne_a = auth.uid()
    or public.role_actif_courant() in ('admin', 'superviseur')
  );

drop policy if exists field_coaching_delete on public.field_coaching;
create policy field_coaching_delete on public.field_coaching
  for delete to authenticated
  using (public.role_actif_courant() = 'admin');

commit;
