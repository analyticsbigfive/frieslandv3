-- ============================================================================
-- get_visites_filtered : lever la troncature silencieuse
--
-- La fonction se terminait par un `limit 2000` EN DUR (20260717150000:84), pour
-- 26 261 visites en base. Les 18 écrans branchés sur `DashboardFilters` via
-- `useDashboardDirection` n'analysaient donc que les 2 000 visites les plus
-- récentes du périmètre — sans message, sans indicateur : sur la fenêtre par
-- défaut de trois mois, un territoire actif dépasse ce seuil et les chiffres
-- affichés étaient faux vers le bas.
--
-- On remplace la constante par `p_limit` / `p_offset`, valeurs par défaut
-- inchangées (2 000 / 0) pour que le front actuel se comporte exactement comme
-- avant tant qu'il ne les passe pas.
--
-- `order by v.date_visite desc` seul ne suffit pas à paginer : deux visites
-- peuvent partager la même date et changer d'ordre entre deux requêtes, donc
-- apparaître deux fois ou jamais. On départage par `visite_id`.
--
-- ATTENTION : `create or replace function` ne sait pas ajouter un paramètre —
-- il crée une SECONDE surcharge, et PostgREST échoue en PGRST203 puisque tous
-- les arguments ont une valeur par défaut. D'où le `drop function <signature
-- exacte>` (même motif qu'en 20260730120000:20-24).
--
-- Idempotent. Additif.
-- ============================================================================
begin;

drop function if exists get_visites_filtered(timestamptz, timestamptz, text, text, text, text, text, text, text, text, text, text);

create or replace function get_visites_filtered(
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_commercial text default null,
  p_canal text default null,
  p_categorie text default null,
  p_sous_categorie text default null,
  p_region text default null,
  p_zone text default null,
  p_secteur text default null,
  p_nom_pdv text default null,
  p_division text default null,
  p_area text default null,
  p_limit integer default 2000,
  p_offset integer default 0
) returns table(
  visite_id text,
  date_visite timestamptz,
  commercial text,
  email text,
  data jsonb,
  pdv_id text,
  nom_pdv text,
  canal text,
  categorie_pdv text,
  sous_categorie_pdv text,
  region text,
  zone text,
  quartier text
)
language sql stable
set search_path = public
as $$
  select
    v.visite_id,
    v.date_visite,
    v.commercial,
    v.email,
    v.data,
    p.pdv_id,
    p.nom_pdv,
    p.canal,
    p.categorie_pdv,
    p.sous_categorie_pdv,
    p.region,
    p.zone,
    p.quartier
  from visites v
  left join pdv p on p.pdv_id = v.pdv_id
  left join territoire t on t.nom = p.zone
  left join sous_region sr on sr.code = t.sous_region_code
  left join region rg on rg.code = sr.region_code
  where (p_date_from is null or v.date_visite >= p_date_from)
    and (p_date_to is null or v.date_visite <= p_date_to)
    and (p_commercial is null or p_commercial = '' or v.commercial ilike '%' || p_commercial || '%' or v.email ilike '%' || p_commercial || '%')
    and (p_canal is null or p_canal = '' or p.canal = p_canal)
    and (p_categorie is null or p_categorie = '' or p.categorie_pdv = p_categorie)
    and (p_sous_categorie is null or p_sous_categorie = '' or p.sous_categorie_pdv = p_sous_categorie)
    and (p_division is null or p_division = '' or rg.nom_affichage = p_division)
    and (p_region is null or p_region = '' or sr.nom_affichage = p_region or p.region = p_region)
    and (p_zone is null or p_zone = '' or p.zone = p_zone)
    and (p_area is null or p_area = '' or p.area_code = p_area or p.quartier = p_area)
    and (p_secteur is null or p_secteur = '' or p.quartier ilike '%' || p_secteur || '%')
    and (p_nom_pdv is null or p_nom_pdv = '' or p.nom_pdv ilike '%' || p_nom_pdv || '%')
  -- Ordre TOTAL : sans le départage par visite_id, la pagination pourrait
  -- rendre deux fois la même ligne et en sauter une autre.
  order by v.date_visite desc, v.visite_id
  limit greatest(coalesce(p_limit, 2000), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

commit;
