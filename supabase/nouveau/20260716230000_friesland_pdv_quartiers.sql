-- ============================================================================
-- PDV × QUARTIERS : « secteur » devient « quartier » (Système B).
-- La table `quartier` (référentiel admin, source docs/migrationGood.csv) est la
-- référence. Hiérarchie : Pays > Division > Sous-région > Territoire > Code area
-- (zone.code) > Quartier (quartier.nom) > Distributeur.
--
--   pdv.secteur              -> pdv.quartier              (= quartier.nom exact)
--   profiles.secteurs_assignes -> profiles.quartiers_assignes (jsonb noms quartier)
--
-- pdv.zone reste = territoire.nom, pdv.area_code = zone.code (résolution du
-- triplet (territory_code, area_code, quartier)). Pas de FK (aligné scoping texte).
--
-- Ambiguïtés (quartier homonyme dans 2 areas d'un même territoire) tranchées ici,
-- éditables ensuite dans l'admin : PS-002 ZONE 3 -> ARAS ; PS-004 HIBISCUS -> HIBI ;
-- PS-007 WASSAKARA -> WASS ; PS-008 PLATEAU CENTRE -> AGBA ; PS-006 ASSABOU -> « Assabou 1 ».
--
-- Idempotent. Dépend de 20260716220000 (table quartier).
-- ============================================================================
begin;

-- 1. Rename colonnes (gardes pour idempotence).
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='pdv' and column_name='secteur')
  then execute 'alter table public.pdv rename column secteur to quartier'; end if;
end $$;

do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='profiles' and column_name='secteurs_assignes')
  then execute 'alter table public.profiles rename column secteurs_assignes to quartiers_assignes'; end if;
end $$;

-- 2. Vues qui exposaient `secteur` : Postgres a déjà suivi le rename interne
--    (p.secteur -> p.quartier) ; on renomme juste la colonne de SORTIE.
do $$
declare v text;
begin
  foreach v in array array['v_perfect_store_manques','v_stats_zone_secteur','v_visites_detail'] loop
    if exists (select 1 from information_schema.columns
               where table_schema='public' and table_name=v and column_name='secteur')
    then execute format('alter view public.%I rename column secteur to quartier', v); end if;
  end loop;
end $$;

-- 2b. Trigger d'auto-liaison PDV : référençait NEW.secteur -> NEW.quartier.
--     (Fallback legacy système A ; ne s'active que si le champ est null — l'app
--     renseigne désormais territory_code/area_code/quartier explicitement.)
create or replace function public.pdv_link_referentiels()
returns trigger language plpgsql as $fn$
declare v_cnt integer; v_area text;
begin
  if new.territory_code is null and new.zone is not null then
    select t.code into new.territory_code
    from public.geo_territories t
    where upper(btrim(t.name)) = upper(btrim(new.zone)) limit 1;
  end if;

  if new.distributor_name is null and new.territory_code is not null
     and (new.canal is null or (new.canal not ilike '%modern%' and upper(btrim(new.canal)) <> 'MT')) then
    select a.distributor_name into new.distributor_name
    from public.geo_areas a
    where a.territory_code = new.territory_code
      and a.distributor_name is not null
      and a.distributor_name not in ('A POURVOIR','NOT AVAILABLE','NICE SERVICE','OMNI RETAIL')
    group by a.distributor_name
    order by count(*) desc, a.distributor_name limit 1;
  end if;

  if new.area_code is null and new.territory_code is not null and new.quartier is not null then
    select count(*), min(a.area_code) into v_cnt, v_area
    from public.geo_areas a
    where a.territory_code = new.territory_code
      and a.area_name ilike '%' || new.quartier || '%';
    if v_cnt = 1 then new.area_code := v_area; end if;
  end if;

  return new;
end;
$fn$;

-- 3. Backfill des 14 PDV démo : territory_code + area_code + quartier.
--    Jointure à travers `quartier` -> valeur stockée = quartier.nom byte-exact.
update public.pdv p
set territory_code = v.tcode,
    area_code      = v.acode,
    quartier       = q.nom
from (values
  ('PS-001','COC 1','PALM','palmeraie'),      ('PS-002','TRE','ARAS','zone 3'),
  ('PS-003','BKE 1','KOKO','koko'),           ('PS-004','MAR','HIBI','hibiscus'),
  ('PS-005','GAG 1','SLEIL','soleil'),        ('PS-006','YAM','ASSAB','assabou 1'),
  ('PS-007','YOP 1','WASS','wassakara'),      ('PS-008','PLA','AGBA','plateau centre'),
  ('PS-009','KOR','REBANQ','commerce'),       ('PS-010','DAL','Lbia','labia'),
  ('PS-011','BIN','NVEG','nouveau goudron'),  ('PS-012','MAN','MRCHE','marche'),
  ('PS-013','ABO 1','DKUI','dokui'),          ('PS-014','DIV','SKOURA','sokoura')
) as v(pdv_id, tcode, acode, qnom)
join public.zone z on z.territoire_code = v.tcode and z.code = v.acode
join public.quartier q on q.zone_id = z.id and lower(q.nom) = lower(v.qnom)
where p.pdv_id = v.pdv_id;

-- 4. Garde : échec bruyant si un PDV démo n'a pas résolu (area_code null ou triplet cassé).
do $$
declare n int;
begin
  select count(*) into n
  from public.pdv p
  where p.pdv_id like 'PS-0%'
    and (p.area_code is null
         or not exists (
           select 1 from public.zone z
           join public.quartier q on q.zone_id = z.id and q.nom = p.quartier
           where z.code = p.area_code and z.territoire_code = p.territory_code));
  if n > 0 then
    raise exception 'Backfill quartier incomplet : % PDV démo non résolus', n;
  end if;
end $$;

-- 5. Remap profiles.quartiers_assignes : toute entrée = nom d'area collé (zone.nom)
--    du territoire de l'utilisateur -> éclatée en noms de quartiers de cette area.
--    Les entrées déjà quartier (ou legacy inconnu) passent inchangées (coalesce).
update public.profiles pr
set quartiers_assignes = sub.new_q
from (
  select pr2.id,
         jsonb_agg(distinct coalesce(q.nom, e.val)) as new_q
  from public.profiles pr2
  cross join lateral jsonb_array_elements_text(pr2.quartiers_assignes) e(val)
  left join public.territoire t on t.nom = pr2.zone_assignee
  left join public.zone z on z.territoire_code = t.code and z.nom = e.val
  left join public.quartier q on q.zone_id = z.id
  group by pr2.id
) sub
where sub.id = pr.id
  and pr.quartiers_assignes is not null
  and jsonb_array_length(pr.quartiers_assignes) > 0
  and sub.new_q is distinct from pr.quartiers_assignes;

-- 6. Fonctions dont le corps référençait pdv.secteur (non auto-suivi par le rename).
create or replace function public.import_pdv_from_csv(
  p_pdv_id text, p_nom_pdv text, p_canal text default 'General trade',
  p_categorie_pdv text default 'Point de vente détail', p_sous_categorie_pdv text default 'Boutique C',
  p_autre_sous_categorie text default null, p_region text default null, p_zone text default null,
  p_secteur text default null, p_geolocation text default null, p_adressage text default null,
  p_image text default null, p_date text default null, p_ajoute_par text default null,
  p_jour_routing text default null, p_position_routing integer default null,
  p_canal_routing text default null, p_sales_rep_routing text default null)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $fn$
declare v_lat double precision; v_lng double precision; v_date date; v_parts text[];
begin
  if p_geolocation is not null and p_geolocation <> '' then
    v_parts := string_to_array(replace(p_geolocation,' ',''), ',');
    if array_length(v_parts,1)=2 then v_lat := v_parts[1]::double precision; v_lng := v_parts[2]::double precision; end if;
  end if;
  if p_date is not null and p_date <> '' then
    begin v_date := to_date(p_date,'DD/MM/YYYY'); exception when others then v_date := null; end;
  end if;
  insert into public.pdv (pdv_id, nom_pdv, canal, categorie_pdv, sous_categorie_pdv,
    autre_sous_categorie, region, zone, quartier, geolocation_lat, geolocation_lng, adressage,
    image_url, date_creation, ajoute_par, jour_routing, position_routing, canal_routing, sales_rep_routing)
  values (p_pdv_id, p_nom_pdv, p_canal, p_categorie_pdv, p_sous_categorie_pdv,
    nullif(p_autre_sous_categorie,''), p_region, p_zone, p_secteur, v_lat, v_lng, p_adressage,
    p_image, v_date, p_ajoute_par, nullif(p_jour_routing,''), p_position_routing,
    nullif(p_canal_routing,''), nullif(p_sales_rep_routing,''))
  on conflict (pdv_id) do update set
    nom_pdv=excluded.nom_pdv, canal=excluded.canal, categorie_pdv=excluded.categorie_pdv,
    sous_categorie_pdv=excluded.sous_categorie_pdv, autre_sous_categorie=excluded.autre_sous_categorie,
    region=excluded.region, zone=excluded.zone, quartier=excluded.quartier,
    geolocation_lat=excluded.geolocation_lat, geolocation_lng=excluded.geolocation_lng,
    adressage=excluded.adressage, image_url=excluded.image_url, date_creation=excluded.date_creation,
    ajoute_par=excluded.ajoute_par, jour_routing=excluded.jour_routing, position_routing=excluded.position_routing,
    canal_routing=excluded.canal_routing, sales_rep_routing=excluded.sales_rep_routing, updated_at=now();
end; $fn$;

create or replace function public.dashboard_perfect_store_filtre(
  p_division text default null, p_territoire text default null,
  p_area text default null, p_distributeur text default null)
returns jsonb language sql stable set search_path to 'public' as $fn$
  with scope_pdv as (
    select p.pdv_id from pdv p
    left join territoire t on t.nom = p.zone
    left join sous_region sr on sr.code = t.sous_region_code
    left join region rg on rg.code = sr.region_code
    where (p_division is null or p_division = '' or rg.nom_affichage = p_division)
      and (p_territoire is null or p_territoire = '' or p.zone = p_territoire)
      and (p_area is null or p_area = '' or p.area_code = p_area or p.quartier = p_area)
      and (p_distributeur is null or p_distributeur = '' or p.distributor_name = p_distributeur)
  ),
  actifs as (select count(*) filter (where coalesce(p.is_active,true)) as pdv_total from pdv p where p.pdv_id in (select pdv_id from scope_pdv)),
  scored as (select r.* from resultat_perfect_store r join visites v on v.id = r.visite_id where v.pdv_id in (select pdv_id from scope_pdv)),
  vus as (select count(distinct v.pdv_id) as pdv_vus from visites v where v.pdv_id in (select pdv_id from scope_pdv))
  select jsonb_build_object(
    'visites_scorees', (select count(*) from scored),
    'perfect_stores', (select count(*) filter (where niveau is not null) from scored),
    'perfect_store_pct', (select round(100.0*count(*) filter (where niveau is not null)/nullif(count(*),0),1) from scored),
    'score_global_moyen_pct', (select round(avg(score_global),1) from scored),
    'osa_moyen_pct', (select round(avg(dispo_rayon),1) from scored),
    'visibilite_moyenne_pct', (select round(avg(visibilite),1) from scored),
    'promotion_moyenne_pct', (select round(avg(promotion),1) from scored),
    'assortiment_moyen_pct', (select round(avg(assortiment),1) from scored),
    'pdv_vus', (select pdv_vus from vus),
    'pdv_total', (select pdv_total from actifs),
    'couverture_pct', (select round(100.0*(select pdv_vus from vus)/nullif((select pdv_total from actifs),0),1))
  );
$fn$;

commit;
