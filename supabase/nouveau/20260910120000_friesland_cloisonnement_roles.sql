-- ============================================================================
-- CLOISONNEMENT DESCENDANT DES RÔLES (demande du 7 septembre 2026)
--
-- Règle posée par le client : un merchandiseur voit LES ACTIONS QU'IL DOIT
-- RÉALISER, pas celles de tout le monde ; ses propres visites, pas celles de
-- l'équipe ; aucun field coaching ; et il ne met à jour que son numéro.
--
-- Constat en base avant cette migration :
--
--  1) `pdv_dans_perimetre()` (20260907150000:25) applique la règle
--     territoriale à TOUT profil actif, merchandiseur compris. Ses trois seuls
--     appelants sont précisément les fonctions à cloisonner, d'où une
--     correction unique et centrale plutôt que policy par policy :
--       - action_commerciale_select : le merchandiseur voyait TOUTES les
--         actions de sa zone ;
--       - field_coaching_select     : il lisait TOUS les coachings de sa zone,
--         y compris ceux qui évaluent son propre travail ;
--       - action_commerciale_insert : déjà borné aux rôles d'encadrement,
--         inchangé (le court-circuit admin/superviseur est conservé).
--
--  2) `profiles_update_own` (_archive/019_security_hardening.sql:25) et le
--     trigger `prevent_profile_privilege_escalation` ne figent que `role` et
--     `is_active`. `zone_assignee`, `territoires_assignes`,
--     `quartiers_assignes` et `commercial_id` — qui DÉFINISSENT le périmètre
--     de lecture, via pdv_ids_perimetre() et pdv_dans_perimetre_commercial() —
--     restaient modifiables par l'intéressé : escalade de périmètre.
--     Ces politiques ne vivaient que dans `_archive/`, elles sont redéclarées
--     ici, dans `nouveau/`, avec les colonnes de périmètre gelées.
--
--  3) `action_commerciale` n'est pas publiée en Realtime : le badge et le
--     toast « nouvelle action assignée » (lot 7) ne pouvaient pas fonctionner.
--
-- Idempotent. Additif (aucune suppression de données).
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1) Périmètre d'ENCADREMENT — le merchandiseur en sort
-- ---------------------------------------------------------------------------
-- Sémantique après cette migration : « ce PDV est-il dans le périmètre que je
-- SUPERVISE ? ». Vrai pour admin et superviseur (tout le réseau), vrai pour un
-- commercial sur ses territoires et quartiers, FAUX pour un merchandiseur —
-- qui n'encadre personne et retombe donc sur `auteur_id`/`assigne_a`.
--
-- À ne pas confondre avec le périmètre de LECTURE TERRAIN d'un merchandiseur
-- (ses propres visites), gouverné par `visites_select` (20260907140100:100).
create or replace function public.pdv_dans_perimetre(p_pdv_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  with moi as (
    select pr.role,
      case
        when jsonb_typeof(pr.territoires_assignes) = 'array'
             and jsonb_array_length(pr.territoires_assignes) > 0
          then (select array_agg(t) from jsonb_array_elements_text(pr.territoires_assignes) t where t <> '')
        when pr.zone_assignee is not null and pr.zone_assignee <> ''
          then array[pr.zone_assignee]
        else array[]::text[]
      end as territoires,
      case
        when jsonb_typeof(pr.quartiers_assignes) = 'array'
          then (select coalesce(array_agg(q), array[]::text[]) from jsonb_array_elements_text(pr.quartiers_assignes) q where q <> '')
        else array[]::text[]
      end as quartiers
    from public.profiles pr
    where pr.id = auth.uid() and pr.is_active = true
  )
  select exists (
    select 1
    from moi m
    left join public.pdv p on p.pdv_id = p_pdv_id
    where m.role in ('admin','superviseur')
       or (
         -- Seul le commercial encadre par territoire. Le merchandiseur est
         -- explicitement exclu : c'est le cloisonnement demandé.
         m.role = 'commercial'
         and p.pdv_id is not null
         and (cardinality(m.territoires) = 0 or p.zone = any(m.territoires))
         and (cardinality(m.quartiers) = 0 or p.quartier is null or p.quartier = any(m.quartiers))
       )
  );
$$;

comment on function public.pdv_dans_perimetre(text) is
  'PDV dans le périmètre d''ENCADREMENT de l''appelant : tout le réseau pour admin/superviseur, les territoires et quartiers assignés pour un commercial, FAUX pour un merchandiseur.';

revoke all on function public.pdv_dans_perimetre(text) from public;
grant execute on function public.pdv_dans_perimetre(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Field coaching : fermé au merchandiseur, y compris le sien
-- ---------------------------------------------------------------------------
-- Le test de rôle est écrit en clair EN PLUS du périmètre. Redondant avec le
-- point 1 aujourd'hui, volontairement : le coaching évalue des personnes, une
-- évolution future de la fonction partagée ne doit pas pouvoir le rouvrir en
-- silence.
--
-- Un merchandiseur ne peut être ni auteur (field_coaching_insert réserve la
-- saisie à superviseur/commercial/admin) ni assigné (les destinataires de
-- transfert sont les mêmes rôles) : il obtient donc zéro ligne.
drop policy if exists field_coaching_select on public.field_coaching;
create policy field_coaching_select on public.field_coaching for select to authenticated
  using (
    auteur_id = auth.uid()
    or assigne_a = auth.uid()
    or superviseur_id = auth.uid()
    or (
      public.role_actif_courant() in ('commercial','superviseur','admin')
      and public.pdv_dans_perimetre(pdv_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 3) profiles : le périmètre n'est plus modifiable par l'intéressé
-- ---------------------------------------------------------------------------
-- Politique permissive : elle s'ajoute (OR) à `profiles_update_admin`, qui
-- laisse l'admin tout modifier. Un utilisateur n'édite donc que sa ligne, et
-- seulement les champs qui ne portent aucun droit.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role                 = (select p.role                 from public.profiles p where p.id = auth.uid())
    and is_active            = (select p.is_active            from public.profiles p where p.id = auth.uid())
    -- Colonnes de périmètre : les modifier élargirait ce que l'utilisateur lit.
    and zone_assignee        is not distinct from (select p.zone_assignee        from public.profiles p where p.id = auth.uid())
    and territoires_assignes is not distinct from (select p.territoires_assignes from public.profiles p where p.id = auth.uid())
    and quartiers_assignes   is not distinct from (select p.quartiers_assignes   from public.profiles p where p.id = auth.uid())
    and commercial_id        is not distinct from (select p.commercial_id        from public.profiles p where p.id = auth.uid())
    and email                is not distinct from (select p.email                from public.profiles p where p.id = auth.uid())
  );

-- Défense en profondeur : même si une politique future réintroduisait la
-- faille, le trigger refuse. `auth.uid() is null` = contexte service_role
-- (scripts backend, maj_telephone_contact) → autorisé, comme dans la version
-- d'origine.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if (new.role                 is distinct from old.role)
  or (new.is_active            is distinct from old.is_active)
  or (new.zone_assignee        is distinct from old.zone_assignee)
  or (new.territoires_assignes is distinct from old.territoires_assignes)
  or (new.quartiers_assignes   is distinct from old.quartiers_assignes)
  or (new.commercial_id        is distinct from old.commercial_id)
  then
    if auth.uid() is not null
       and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
      raise exception 'Rôle, activation et périmètre se modifient depuis l''administration (profil %)', new.id
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_prevent_escalation on public.profiles;
create trigger profiles_prevent_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

-- ---------------------------------------------------------------------------
-- 4) Realtime sur les actions commerciales (lot 7 : badge et toast)
-- ---------------------------------------------------------------------------
-- Realtime respecte la RLS : après le point 1, un merchandiseur n'est notifié
-- que des actions qui lui sont assignées.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'action_commerciale'
  ) then
    alter publication supabase_realtime add table public.action_commerciale;
  end if;
exception
  -- Le badge « nouvelle action » est un confort : son échec ne doit jamais
  -- faire échouer le cloisonnement, qui est l'objet de cette migration.
  when undefined_object then
    raise notice 'publication supabase_realtime absente : Realtime non activé sur ce projet';
  when insufficient_privilege then
    raise notice 'droits insuffisants sur la publication supabase_realtime : activer Realtime sur action_commerciale depuis le tableau de bord Supabase';
end $$;

commit;
