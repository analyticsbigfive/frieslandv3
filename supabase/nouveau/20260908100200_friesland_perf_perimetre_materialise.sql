-- ============================================================================
-- PERFORMANCE : pdv_ids_perimetre() recalculait territoires_etendus() pour
-- chaque ligne de pdv (25 000 × 0,2 ms ≈ 6 s par requête, mesuré le 7 sept.
-- avec un compte commercial : liste d'équipe 8 s, comptage 20 s).
-- Les CTE deviennent MATERIALIZED : le périmètre est calculé une seule fois,
-- puis la jointure sur pdv utilise l'index (zone, quartier).
-- Idempotent.
-- ============================================================================
begin;

create or replace function public.pdv_ids_perimetre()
returns setof text
language sql stable security definer
set search_path = public
rows 2000
as $$
  with moi as materialized (
    select pr.role,
      case
        when jsonb_typeof(pr.territoires_assignes) = 'array' and jsonb_array_length(pr.territoires_assignes) > 0
          then (select array_agg(t) from jsonb_array_elements_text(pr.territoires_assignes) t where t <> '')
        when pr.zone_assignee is not null and pr.zone_assignee <> '' then array[pr.zone_assignee]
        else array[]::text[]
      end as territoires,
      case
        when jsonb_typeof(pr.quartiers_assignes) = 'array'
          then (select coalesce(array_agg(q), array[]::text[]) from jsonb_array_elements_text(pr.quartiers_assignes) q where q <> '')
        else array[]::text[]
      end as quartiers
    from public.profiles pr where pr.id = auth.uid() and pr.is_active = true
  ),
  terr as materialized (
    select m.territoires, m.quartiers,
           coalesce((select array_agg(x) from public.territoires_etendus(m.territoires) x), array[]::text[]) as noms
    from moi m
  )
  -- Deux branches sans OR sur une constante : le planificateur utilise l'index.
  select p.pdv_id
  from terr t
  join public.pdv p on p.zone = any(t.noms)
  where cardinality(t.territoires) > 0
    and (cardinality(t.quartiers) = 0 or p.quartier is null or p.quartier = any(t.quartiers))
  union all
  select p.pdv_id
  from terr t
  join public.pdv p on true
  where cardinality(t.territoires) = 0
    and (cardinality(t.quartiers) = 0 or p.quartier is null or p.quartier = any(t.quartiers));
$$;

commit;
