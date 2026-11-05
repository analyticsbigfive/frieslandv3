-- ============================================================================
-- 05/11/2026 — Visites hors tournée : les indiquer, sans rien changer au compte
--
-- NON APPLIQUÉE. À appliquer en production (MCP, apply_migration) seulement
-- avec l'accord de Jean Luc. Ajouts seulement : aucune donnée réécrite.
--
-- Réunion du 05/11 : Friesland voit des merchandisers « enregistrer des PDV qui
-- ne figurent pas dans les tournées ». Mesure du 21/10 au 05/11 : presque tous
-- sont des PDV créés sur place, puis visités (Abbé Frédéric : 53 visites hors
-- tournée sur 220, dont 49 sur un PDV qu'il a créé ; Guihi Bernadin : 4 sur
-- 134, toutes sur un PDV créé). Décision de Jean Luc : on l'indique dans
-- l'admin, la visite compte toujours (comme décidé le 22/10).
--
-- Situation d'une visite dans la tournée de son auteur, le jour de la visite
-- (heure d'Abidjan) :
--   · prevue             : le PDV est une étape de la tournée du jour ;
--   · ajoutee_jour       : étape ajoutée au moment de la visite, un jour de
--                          visite libre (objectifs.visite_libre) ou un pushcart
--                          à trouver (objectifs.a_trouver), migrations
--                          20261022100000 et 20261022120000 ;
--   · pdv_cree_sur_place : pas d'étape, et le PDV a été créé par l'auteur ;
--   · hors_tournee       : pas d'étape, sinon ;
--   · null               : pas de tournée ce jour-là (ou tournée annulée),
--                          ou visite sans auteur (anciennes visites).
--
-- 1. situation_tournee_de(...) : la règle, en un seul endroit.
-- 2. situation_tournee(visites) : colonne calculée. PostgREST la lit et la
--    filtre comme une colonne (select=*,situation_tournee ;
--    situation_tournee=in.(...)) : l'écran des visites lit la table visites,
--    pas get_visites_filtered.
-- 3. get_visites_filtered : nouvelle colonne situation_tournee, en dernier.
--    Le type de retour change : drop puis create.
-- 4. recap_situation_tournee(début, fin) : une ligne par merchandiser.
--
-- Pas de security definer : chacun ne voit que les visites, tournées et PDV
-- que ses règles d'accès lui ouvrent. Un compte agence qui ne lit pas un PDV
-- créé sur place verra sa visite « hors tournée » plutôt que « PDV créé sur
-- place ». Les doublons possibles ne sont lisibles que par l'admin et le
-- superviseur : pour les autres, la colonne vaut null (pas 0).
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. La règle
-- ---------------------------------------------------------------------------
create or replace function public.situation_tournee_de(
  p_a_tournee boolean,
  p_etape boolean,
  p_objectifs_etape jsonb,
  p_pdv_cree_par uuid,
  p_auteur uuid
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when not coalesce(p_a_tournee, false) then null
    when coalesce(p_etape, false)
         and (coalesce(p_objectifs_etape ->> 'visite_libre', '') = 'true'
              or coalesce(p_objectifs_etape ->> 'a_trouver', '') = 'true')
      then 'ajoutee_jour'
    when coalesce(p_etape, false) then 'prevue'
    when p_pdv_cree_par is not null and p_pdv_cree_par = p_auteur then 'pdv_cree_sur_place'
    else 'hors_tournee'
  end
$$;

comment on function public.situation_tournee_de(boolean, boolean, jsonb, uuid, uuid) is
  'Situation d''une visite dans la tournée du jour : prevue, ajoutee_jour, pdv_cree_sur_place, hors_tournee, ou null sans tournée (20261105120000).';

-- ---------------------------------------------------------------------------
-- 2. Colonne calculée pour PostgREST
-- ---------------------------------------------------------------------------
create or replace function public.situation_tournee(v public.visites)
returns text
language sql
stable
set search_path = public
as $$
  select public.situation_tournee_de(r.id is not null, rp.id is not null, rp.objectifs, p.created_by, v.user_id)
  from (select 1) as une_ligne
  left join routings r
    on r.user_id = v.user_id
   and r.date_routing = (v.date_visite at time zone 'Africa/Abidjan')::date
   and r.status is distinct from 'cancelled'
  left join routing_pdv rp on rp.routing_id = r.id and rp.pdv_id = v.pdv_id
  left join pdv p on r.id is not null and rp.id is null and p.pdv_id = v.pdv_id
$$;

comment on function public.situation_tournee(public.visites) is
  'Colonne calculée (PostgREST) : situation de la visite dans la tournée de son auteur ce jour-là. Indication seulement, la visite compte toujours (20261105120000).';

-- ---------------------------------------------------------------------------
-- 3. get_visites_filtered : même corps, plus situation_tournee
-- ---------------------------------------------------------------------------
drop function if exists public.get_visites_filtered(
  timestamp with time zone, timestamp with time zone, text, text, text, text,
  text, text, text, text, text, text, integer, integer);

create function public.get_visites_filtered(
  p_date_from timestamp with time zone default null,
  p_date_to timestamp with time zone default null,
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
)
returns table (
  visite_id text,
  date_visite timestamp with time zone,
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
  quartier text,
  situation_tournee text
)
language sql
stable
set search_path = public
set work_mem = '16MB'
as $function$
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
    p.quartier,
    situation_tournee_de(r.id is not null, rp.id is not null, rp.objectifs, p.created_by, v.user_id)
  from visites v
  left join pdv p on p.pdv_id = v.pdv_id
  left join territoire t on t.nom = p.zone
  left join sous_region sr on sr.code = t.sous_region_code
  left join region rg on rg.code = sr.region_code
  -- Au plus une tournée par merchandiser et par jour (routings_user_id_date_routing_key),
  -- au plus une étape par PDV (routing_pdv_routing_id_pdv_id_key) : pas de ligne en double.
  left join routings r
    on r.user_id = v.user_id
   and r.date_routing = (v.date_visite at time zone 'Africa/Abidjan')::date
   and r.status is distinct from 'cancelled'
  left join routing_pdv rp on rp.routing_id = r.id and rp.pdv_id = v.pdv_id
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
$function$;

-- ---------------------------------------------------------------------------
-- 4. Récap par merchandiser
-- ---------------------------------------------------------------------------
create or replace function public.recap_situation_tournee(p_debut date, p_fin date)
returns table (
  user_id uuid,
  merchandiser text,
  email text,
  employeur text,
  visites bigint,
  prevues bigint,
  ajoutees_visite_libre bigint,
  pushcarts_a_trouver bigint,
  -- hors_tournee compte aussi les visites sur un PDV créé sur place (« dont »).
  hors_tournee bigint,
  dont_pdv_cree bigint,
  sans_tournee bigint,
  pdv_crees bigint,
  -- PDV créés sur place, visités sur la période, encore « à vérifier » dans
  -- Points de vente › Doublons possibles. Null hors admin et superviseur.
  pdv_doublons_a_verifier bigint
)
language sql
stable
set search_path = public
as $$
  with s as (
    select
      v.user_id,
      v.pdv_id,
      rp.objectifs,
      situation_tournee_de(r.id is not null, rp.id is not null, rp.objectifs, p.created_by, v.user_id) as situation
    from visites v
    left join routings r
      on r.user_id = v.user_id
     and r.date_routing = (v.date_visite at time zone 'Africa/Abidjan')::date
     and r.status is distinct from 'cancelled'
    left join routing_pdv rp on rp.routing_id = r.id and rp.pdv_id = v.pdv_id
    left join pdv p on p.pdv_id = v.pdv_id
    where v.user_id is not null
      and (p_debut is null or v.date_visite >= (p_debut::timestamp at time zone 'Africa/Abidjan'))
      and (p_fin is null or v.date_visite < ((p_fin + 1)::timestamp at time zone 'Africa/Abidjan'))
  ),
  d as (
    select s.*,
           s.situation = 'pdv_cree_sur_place'
             and exists (select 1 from pdv_doublon_possible dp
                          where dp.pdv_id = s.pdv_id and dp.verifie_le is null) as doublon
    from s
  )
  select
    d.user_id,
    pr.nom,
    pr.email,
    pr.employeur,
    count(*),
    count(*) filter (where d.situation = 'prevue'),
    count(*) filter (where d.situation = 'ajoutee_jour' and d.objectifs ->> 'visite_libre' = 'true'),
    count(*) filter (where d.situation = 'ajoutee_jour' and coalesce(d.objectifs ->> 'visite_libre', '') <> 'true'),
    count(*) filter (where d.situation in ('hors_tournee', 'pdv_cree_sur_place')),
    count(*) filter (where d.situation = 'pdv_cree_sur_place'),
    count(*) filter (where d.situation is null),
    count(distinct d.pdv_id) filter (where d.situation = 'pdv_cree_sur_place'),
    case when est_admin_ou_superviseur()
      then count(distinct d.pdv_id) filter (where d.doublon) end
  from d
  left join profiles pr on pr.id = d.user_id
  group by d.user_id, pr.nom, pr.email, pr.employeur
  order by count(*) filter (where d.situation in ('hors_tournee', 'pdv_cree_sur_place')) desc,
           count(*) desc, pr.nom;
$$;

comment on function public.recap_situation_tournee(date, date) is
  'Visites par merchandiser sur la période (jours à l''heure d''Abidjan) : prévues, ajoutées un jour de visite libre, pushcarts à trouver, hors tournée dont PDV créé sur place, doublons possibles à vérifier (20261105120000).';

-- ---------------------------------------------------------------------------
-- Droits : comptes connectés seulement
-- ---------------------------------------------------------------------------
revoke all on function public.situation_tournee_de(boolean, boolean, jsonb, uuid, uuid) from public, anon;
revoke all on function public.situation_tournee(public.visites) from public, anon;
revoke all on function public.get_visites_filtered(
  timestamp with time zone, timestamp with time zone, text, text, text, text,
  text, text, text, text, text, text, integer, integer) from public, anon;
revoke all on function public.recap_situation_tournee(date, date) from public, anon;
grant execute on function public.situation_tournee_de(boolean, boolean, jsonb, uuid, uuid) to authenticated, service_role;
grant execute on function public.situation_tournee(public.visites) to authenticated, service_role;
grant execute on function public.get_visites_filtered(
  timestamp with time zone, timestamp with time zone, text, text, text, text,
  text, text, text, text, text, text, integer, integer) to authenticated, service_role;
grant execute on function public.recap_situation_tournee(date, date) to authenticated, service_role;

commit;

-- PostgREST : nouvelle colonne calculée et nouvelle fonction.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Contrôle après application (21/10–05/11, mesuré le 05/11 en lecture) :
--   select merchandiser, visites, prevues, ajoutees_visite_libre,
--          pushcarts_a_trouver, hors_tournee, dont_pdv_cree, pdv_doublons_a_verifier
--   from recap_situation_tournee('2026-10-21', '2026-11-05');
-- Attendu à peu près : ABBE FREDERIC 220 / 122 / 45 / 0 / 53 / 49 ;
-- GUIHI BERNADIN 134 / 120 / 8 / 2 / 4 / 4.
--   select visite_id, situation_tournee from get_visites_filtered(
--     '2026-11-04', '2026-11-05', 'GUIHI') where situation_tournee <> 'prevue';
-- doit montrer les visites de « Push amidou » et « Push ali » (pdv_cree_sur_place).
-- ---------------------------------------------------------------------------
