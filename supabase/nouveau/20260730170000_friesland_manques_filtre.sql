-- ============================================================================
-- « PASSER AU NIVEAU SUPÉRIEUR » FILTRÉ (géographie + période)
--
-- Le tableau des critères manquants était chargé une fois au montage, sans
-- période : v_perfect_store_manques émet une ligne PAR VISITE scorée, hors de
-- tout périmètre. Résultat : un PDV revisité apparaissait plusieurs fois, et
-- changer la période du dashboard ne changeait pas ce bloc — seul écart restant
-- de la tâche « tout se recalcule quand on change les filtres » (réunion 23/07).
--
-- Cette RPC restreint la vue à LA dernière visite de chaque PDV dans la
-- période, et applique les mêmes filtres géo que les autres RPC du dashboard.
-- Le tri reprend celui du front : les moins conformes d'abord.
-- ============================================================================
begin;

create or replace function perfect_store_manques_filtre(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_date_debut date default null,
  p_date_fin date default null,
  p_limit integer default 50
) returns setof v_perfect_store_manques
language sql stable
set search_path = public
as $$
  with derniere as (
    select distinct on (v.pdv_id) v.id as visite_id
    from visites v
    where (p_date_debut is null or v.date_visite >= p_date_debut::timestamptz)
      and (p_date_fin is null or v.date_visite < (p_date_fin + 1)::timestamptz)
    order by v.pdv_id, v.date_visite desc
  )
  select m.*
  from v_perfect_store_manques m
  join derniere d on d.visite_id = m.visite_id
  where (p_division is null or p_division = '' or m.division = p_division)
    and (p_territoire is null or p_territoire = '' or m.zone = p_territoire)
    and (p_area is null or p_area = '' or m.quartier = p_area)
    and (p_distributeur is null or p_distributeur = '' or m.distributor_name = p_distributeur)
  -- Les moins conformes d'abord : non conformes (niveau_actuel null), puis
  -- dispo manquante — même tri que l'ancien chargement direct de la vue.
  order by m.niveau_actuel asc nulls first, m.dispo_manque desc
  limit greatest(coalesce(p_limit, 50), 1);
$$;

grant execute on function perfect_store_manques_filtre(text, text, text, text, date, date, integer) to authenticated;

commit;
