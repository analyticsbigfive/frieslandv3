-- ============================================================================
-- LISTE PERFECT STORE : recherche texte dans la RPC filtrée
--
-- La page liste (perfect-store/liste.vue) gagne un filtre de période (réunion
-- 23/07 : jour/semaine/mois partout). Elle passe donc par la RPC
-- perfect_store_liste_filtre — mais celle-ci ne savait pas chercher par texte,
-- la recherche n'existait que sur le chemin « vue » sans dates. Combiner
-- période + recherche impose de porter la recherche dans la RPC.
--
-- La signature change (ajout de p_search) : on droppe l'ancienne pour éviter
-- une surcharge ambiguë côté PostgREST.
-- ============================================================================
begin;

drop function if exists perfect_store_liste_filtre(text, text, integer, integer, text, text, text, text, text, date, date);

create or replace function perfect_store_liste_filtre(
  p_niveau text default null,
  p_type text default null,
  p_page integer default 1,
  p_per_page integer default 10,
  p_order text default 'date',
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_date_debut date default null,
  p_date_fin date default null,
  p_search text default null
) returns jsonb
language sql stable
set search_path = public
as $$
  with scope_pdv as (
    select p.pdv_id
    from pdv p
    left join territoire t on t.nom = p.zone
    left join sous_region sr on sr.code = t.sous_region_code
    left join region rg on rg.code = sr.region_code
    where (p_division is null or p_division = '' or rg.nom_affichage = p_division)
      and (p_territoire is null or p_territoire = '' or p.zone = p_territoire)
      and (p_area is null or p_area = '' or p.area_code = p_area or p.quartier = p_area)
      and (p_distributeur is null or p_distributeur = '' or p.distributor_name = p_distributeur)
  ),
  latest as (
    select distinct on (v.pdv_id)
      r.visite_id, v.pdv_id, p.nom_pdv,
      coalesce(p.sous_categorie_pdv, 'Non renseigné') as type_pdv,
      p.zone, v.date_visite, v.commercial,
      coalesce(r.niveau, 'NON CONFORME') as niveau,
      r.score_global, r.dispo_rayon, r.assortiment, r.visibilite, r.promotion
    from resultat_perfect_store r
    join visites v on v.id = r.visite_id
    join pdv p on p.pdv_id = v.pdv_id
    where v.pdv_id in (select pdv_id from scope_pdv)
      and (p_date_debut is null or v.date_visite >= p_date_debut::timestamptz)
      and (p_date_fin is null or v.date_visite < (p_date_fin + 1)::timestamptz)
    order by v.pdv_id, v.date_visite desc, r.calcule_le desc
  ),
  filtre as (
    select * from latest l
    where (p_niveau is null or p_niveau = ''
           or (p_niveau = 'CONFORMES' and l.niveau <> 'NON CONFORME')
           or l.niveau = p_niveau)
      and (p_type is null or p_type = '' or l.type_pdv = p_type)
      -- Mêmes colonnes que la recherche de l'ancien chemin « vue » :
      -- nom, code PDV, zone.
      and (p_search is null or btrim(p_search) = ''
           or l.nom_pdv ilike '%' || btrim(p_search) || '%'
           or l.pdv_id ilike '%' || btrim(p_search) || '%'
           or l.zone ilike '%' || btrim(p_search) || '%')
  ),
  page as (
    select * from filtre
    order by
      case when p_order = 'score' then score_global end desc nulls last,
      date_visite desc
    limit greatest(coalesce(p_per_page, 10), 1)
    offset greatest(coalesce(p_page, 1) - 1, 0) * greatest(coalesce(p_per_page, 10), 1)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtre),
    'items', coalesce((
      select jsonb_agg(to_jsonb(pg)
        order by case when p_order = 'score' then pg.score_global end desc nulls last, pg.date_visite desc)
      from page pg
    ), '[]'::jsonb)
  );
$$;

commit;
