-- ============================================================================
-- LOT 2/3 (1.0.4) : PERFORMANCE DU PÉRIMÈTRE COMMERCIAL
--
-- Mesuré le 7 sept. 2026 avec un compte commercial : select pdv_id,date_visite
-- sur visites = 4,6 s pour 1 000 lignes, pdv_fraicheur_filtre = 9 s. Cause :
-- la politique visites_select_commercial appelle pdv_dans_perimetre_commercial
-- (jointure profiles + pdv) pour CHACUNE des 26 000 visites scannées.
--
-- Correctif : une fonction qui renvoie UNE FOIS l'ensemble des pdv_id du
-- périmètre ; la politique devient « pdv_id in (select …) », que Postgres
-- évalue une seule fois par requête (hash semi-join). Même règle métier.
--
-- Idempotent. Additif.
-- ============================================================================
begin;

create or replace function public.pdv_ids_perimetre()
returns setof text
language sql stable security definer
set search_path = public
rows 2000
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
  select p.pdv_id
  from moi m
  join public.pdv p
    on (cardinality(m.territoires) = 0 or p.zone = any(m.territoires))
   and (cardinality(m.quartiers) = 0 or p.quartier is null or p.quartier = any(m.quartiers));
$$;
revoke all on function public.pdv_ids_perimetre() from public;
grant execute on function public.pdv_ids_perimetre() to authenticated;

-- Lecture commercial : ensemble calculé une fois par requête.
drop policy if exists "visites_select_commercial" on public.visites;
create policy "visites_select_commercial" on public.visites for select
  using (
    public.role_actif_courant() = 'commercial'
    and pdv_id in (select public.pdv_ids_perimetre())
  );

create index if not exists idx_pdv_zone_quartier on public.pdv (zone, quartier);

commit;
