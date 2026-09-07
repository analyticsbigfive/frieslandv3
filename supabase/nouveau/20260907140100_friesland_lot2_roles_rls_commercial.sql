-- ============================================================================
-- LOT 2 (1.0.4) : RÔLES ET CLOISONNEMENT — commercial en lecture seule réelle
--
-- Constat en production le 7 sept. 2026 (compte commercial réel, PostgREST) :
--  - la lecture des visites est DÉJÀ scopée zone + quartier (1 775 visites
--    visibles = exactement les visites des PDV de ses territoires filtrés par
--    ses quartiers) — politique posée hors dépôt, nom inconnu ;
--  - role_section_access du commercial est déjà ouvert sauf `parametres` ;
--  - MAIS tout utilisateur authentifié peut encore écrire sur pdv, visites et
--    le bucket visite-images (politiques d'archive 001c/019). La « lecture
--    seule » n'existe que dans l'interface.
--
-- Cette migration :
--  1) codifie dans le dépôt la lecture scopée (fonction dédiée à la LECTURE,
--     SECURITY DEFINER, sans toucher est_gestionnaire_perfect_store() qui
--     gouverne l'écriture de ~25 tables) ;
--  2) réserve l'écriture terrain (pdv, visites, bucket) aux rôles
--     admin / superviseur / merchandiser actifs ;
--  3) fige la matrice de sections du commercial (lecture ouverte, paramètres
--     fermés).
--
-- Règle de périmètre = pdvInScope() côté client (composables/useUserScope.ts) :
--   territoires = territoires_assignes non vide, sinon [zone_assignee] ;
--   aucun territoire => pas de contrainte de zone ;
--   quartiers vide OU pdv.quartier null => pas de contrainte de quartier.
--
-- Idempotent. Additif (aucune suppression de données).
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1) Fonctions de rôle (SECURITY DEFINER : lisent profiles sans dépendre de
--    la politique de lecture de profiles)
-- ---------------------------------------------------------------------------
create or replace function public.role_actif_courant()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles
  where id = auth.uid() and is_active = true
  limit 1;
$$;

-- Rôles autorisés à ÉCRIRE sur les données terrain (pdv, visites, photos).
-- Le commercial est explicitement exclu : il consulte, il n'écrit pas.
create or replace function public.peut_ecrire_terrain()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.role_actif_courant() in ('admin','superviseur','merchandiser'), false);
$$;

-- Périmètre de LECTURE d'un commercial actif sur un PDV.
create or replace function public.pdv_dans_perimetre_commercial(p_pdv_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  with moi as (
    select
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
    where pr.id = auth.uid() and pr.is_active = true and pr.role = 'commercial'
  )
  select exists (
    select 1
    from moi m
    join public.pdv p on p.pdv_id = p_pdv_id
    where (cardinality(m.territoires) = 0 or p.zone = any(m.territoires))
      and (cardinality(m.quartiers) = 0 or p.quartier is null or p.quartier = any(m.quartiers))
  );
$$;

revoke all on function public.role_actif_courant() from public;
revoke all on function public.peut_ecrire_terrain() from public;
revoke all on function public.pdv_dans_perimetre_commercial(text) from public;
grant execute on function public.role_actif_courant() to authenticated;
grant execute on function public.peut_ecrire_terrain() to authenticated;
grant execute on function public.pdv_dans_perimetre_commercial(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) visites : lecture scopée + écriture réservée aux rôles terrain
-- ---------------------------------------------------------------------------
alter table public.visites enable row level security;

-- Lecture : ses propres visites, ou tout pour admin/superviseur.
drop policy if exists "visites_select" on public.visites;
create policy "visites_select" on public.visites for select
  using (
    auth.uid() = user_id
    or public.role_actif_courant() in ('admin','superviseur')
  );

-- Lecture commercial : visites des PDV de son périmètre (OR avec la précédente).
drop policy if exists "visites_select_commercial" on public.visites;
create policy "visites_select_commercial" on public.visites for select
  using (public.pdv_dans_perimetre_commercial(pdv_id));

-- Écriture : sous son propre user_id ET rôle autorisé à écrire.
drop policy if exists "visites_insert" on public.visites;
create policy "visites_insert" on public.visites for insert
  with check (auth.uid() = user_id and public.peut_ecrire_terrain());

drop policy if exists "visites_update" on public.visites;
create policy "visites_update" on public.visites for update
  using (
    public.peut_ecrire_terrain()
    and (auth.uid() = user_id or public.role_actif_courant() = 'admin')
  )
  with check (
    public.peut_ecrire_terrain()
    and (auth.uid() = user_id or public.role_actif_courant() = 'admin')
  );

-- ---------------------------------------------------------------------------
-- 3) pdv : création et édition terrain réservées aux rôles qui écrivent
--    (pdv_update_admin et pdv_delete_admin de l'archive restent inchangées)
-- ---------------------------------------------------------------------------
alter table public.pdv enable row level security;

drop policy if exists "pdv_insert_auth" on public.pdv;
drop policy if exists "pdv_insert_terrain" on public.pdv;
create policy "pdv_insert_terrain" on public.pdv for insert
  with check (public.peut_ecrire_terrain());

drop policy if exists "pdv_update_field" on public.pdv;
drop policy if exists "pdv_update_terrain" on public.pdv;
create policy "pdv_update_terrain" on public.pdv for update
  using (public.peut_ecrire_terrain())
  with check (public.peut_ecrire_terrain());

-- ---------------------------------------------------------------------------
-- 4) Bucket visite-images : upload réservé aux rôles qui écrivent
-- ---------------------------------------------------------------------------
drop policy if exists "images_insert_auth" on storage.objects;
drop policy if exists "images_insert_terrain" on storage.objects;
create policy "images_insert_terrain" on storage.objects for insert
  with check (bucket_id = 'visite-images' and public.peut_ecrire_terrain());

-- ---------------------------------------------------------------------------
-- 5) Matrice de sections du commercial : lecture ouverte, paramètres fermés
-- ---------------------------------------------------------------------------
insert into public.role_section_access (role, section, can_access) values
  ('commercial','principal',true),
  ('commercial','pdv',true),
  ('commercial','visites',true),
  ('commercial','perfect-store',true),
  ('commercial','visibilite',true),
  ('commercial','concurrence',true),
  ('commercial','produits',true),
  ('commercial','actions',true),
  ('commercial','parametres',false),
  ('commercial','administration',false)
on conflict (role, section) do update
  set can_access = excluded.can_access,
      updated_at = now();

commit;
