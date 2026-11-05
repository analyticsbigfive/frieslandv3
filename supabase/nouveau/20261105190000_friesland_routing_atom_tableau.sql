-- ============================================================================
-- ROUTING ATOM : TABLEAU DU PROGRAMME, ROTATION SUR PLUSIEURS MOIS, TREICHVILLE
-- (05/11/2026, décisions de Jean Luc)
--
-- Tableau du programme : 20 PDV par jour du lundi au jeudi, 15 le vendredi,
-- 10 le samedi (routing_quota_canal). Le routing mensuel de l'agence (fichier
-- « Routing Mensuel ») se répète chaque mois ; chaque jour prend des PDV
-- différents.
--
-- 1. Objectif du jour : corrige 20261105180000 (appliquée avant le tableau,
--    qui montait vendredi et samedi à 20). Vendredi et samedi reviennent à 15
--    et 10. Du lundi au jeudi (jours dont les quotas atteignent le seuil
--    objectif_jour_minimum = 20), si la tournée générée fait moins de 20 (PDV
--    prévus + pushcarts), « Nouveaux PDV » = nouveaux_pdv_a_recruter (2) à
--    recruter ce jour-là ; les boutiques créées et visitées le jour même le
--    remplissent (visite_libre_apres_visite, inchangé).
-- 2. Rotation : dans la liste du point de visite du jour, les PDV jamais
--    visités d'abord, puis ceux vus il y a le plus longtemps, puis les plus
--    proches ; les PDV des points voisins seulement ensuite. Les listes font
--    600 à 1 400 PDV (1,5 à 3,4 mois) : tout le portefeuille est couvert
--    avant de recommencer.
-- 3. Rattachement : un PDV Atom va au point de visite le plus proche d'un
--    merchandiser de SON distributeur s'il est à rattachement_distributeur_max_m
--    (3 000 m) au plus ; sinon au point le plus proche, comme avant. 397 PDV
--    rattachés à un voisin d'un autre distributeur (tirés par personne)
--    deviennent visitables ; aucun merchandiser n'en perd.
-- 4. Treichville (Gui Stéphane) : les 283 PDV de la liste Atom « ROUTING
--    TREICHVILLE » entrent dans pdv_atom (donc dans sa liste par quartier) ;
--    ses 12 règles « Liste PDV » (périmètre, tous les PDV chaque jour, d'où
--    ~45 par jour) sont arrêtées ; ses tournées du 06/11 au 12/11 sans
--    avancement sont refaites. 190 de ces PDV n'ont pas de GPS (créés par
--    l'import de la liste) : ils sont rattachés au point de visite de leur
--    quartier (pdv_point_visite_force : Quartier Appolo et France Afrique →
--    Quartier Apollo, Belleville → Belle ville, Aras → Arras, Biafra →
--    Biafra) jusqu'à ce qu'une visite leur donne un GPS.
--
-- Le SSF n'entre pas dans le choix des PDV : aucun PDV n'est relié à un SSF
-- (pdv.sales_rep_routing vide). À ajouter quand les distributeurs auront
-- donné la liste des clients de chaque SSF.
--
-- Appliquée le 05/11/2026 par le MCP Supabase après répétitions annulées :
-- plus aucun « Nouveaux PDV » vendredi/samedi ; 12 règles « Liste PDV »
-- arrêtées, 283 PDV de Treichville dans la liste de Gui Stéphane (190 sans
-- GPS rattachés par quartier), ses tournées du 06 au 12/11 refaites
-- (18 + 2, vendredi 14 + 1, samedi 9 + 1) ; listes visitables : Stéphane
-- 276 → 557, Zogbolou +142, Kouamé +104, Guihi +90, Deheo +57, Seregone +4.
-- ============================================================================
begin;

-- 1. Paramètres ----------------------------------------------------------------
update public.parametre_app
set libelle = 'Seuil de l''objectif du jour',
    description = 'Merchandisers d''agence : les jours dont les quotas atteignent ce seuil (lundi–jeudi, 20) demandent de recruter des points de vente quand la tournée générée est en dessous (voir « Nouveaux PDV à recruter »). Vendredi (15) et samedi (10) ne sont pas concernés. 0 : jamais.'
where cle = 'objectif_jour_minimum' and portee = 'tous';

insert into public.parametre_app (cle, portee, valeur, libelle, description, unite, min, max, ordre)
select 'nouveaux_pdv_a_recruter', 'tous', 2,
       'Nouveaux PDV à recruter',
       'Nombre de points de vente à recruter (créer et visiter sur place) un jour où la tournée générée est sous le seuil de l''objectif du jour. Affiché dans l''application comme « Nouveaux PDV 0/2 ».',
       'PDV', 0, 10, 51
where not exists (select 1 from public.parametre_app where cle = 'nouveaux_pdv_a_recruter' and portee = 'tous');

insert into public.parametre_app (cle, portee, valeur, libelle, description, unite, min, max, ordre)
select 'rattachement_distributeur_max_m', 'tous', 3000,
       'Rattachement au distributeur',
       'Un point de vente Atom est rangé chez le merchandiser de son distributeur dont le point de visite est le plus proche, s''il est à cette distance au plus ; sinon chez le point de visite le plus proche, quel que soit le distributeur (il n''entre alors dans aucune tournée).',
       'm', 0, 20000, 52
where not exists (select 1 from public.parametre_app where cle = 'rattachement_distributeur_max_m' and portee = 'tous');

-- PDV sans GPS rattachés à un point de visite par leur quartier (lue par
-- recalculer_quartiers_atom, créée avant tout recalcul).
create table if not exists public.pdv_point_visite_force (
  pdv_id text primary key,
  merchandiser_id uuid not null,
  point_visite text not null,
  motif text,
  cree_le timestamptz not null default now()
);
alter table public.pdv_point_visite_force enable row level security;
drop policy if exists pdv_point_visite_force_lecture on public.pdv_point_visite_force;
create policy pdv_point_visite_force_lecture on public.pdv_point_visite_force
  for select using (role_actif_courant() = any (array['admin', 'superviseur']));
comment on table public.pdv_point_visite_force is
  'PDV Atom sans GPS rattachés à un point de visite par leur quartier, jusqu''à ce qu''une visite leur donne un GPS (migration 20261105190000).';


-- 2. Objectif du jour ----------------------------------------------------------
drop function if exists public.objectifs_a_trouver(date);

create or replace function public.objectifs_a_trouver(p_date date, p_nb_prevus integer default null)
 returns jsonb
 language sql
 stable
 set search_path to 'public'
as $function$
  with q as (
    select
      coalesce(sum(quota) filter (where canal = 'Pushcart' and quota > 0), 0)::int as pushcart,
      coalesce(sum(quota) filter (where quota > 0), 0)::int as tous
    from routing_quota_canal
    where jour_semaine = extract(dow from p_date)::int
  ), s as (
    select q.pushcart, q.tous,
           coalesce(parametre_app_valeur('objectif_jour_minimum')::int, 0) as seuil,
           coalesce(parametre_app_valeur('nouveaux_pdv_a_recruter')::int, 0) as a_recruter
    from q
  ), m as (
    select s.pushcart,
           case when p_nb_prevus is not null and s.seuil > 0 and s.tous >= s.seuil
                     and p_nb_prevus + s.pushcart < s.tous
                then greatest(s.a_recruter, 0) else 0 end as nouveaux
    from s
  )
  select case when m.pushcart + m.nouveaux > 0 then jsonb_build_object(
    'type', 'a_trouver',
    'quotas', jsonb_strip_nulls(jsonb_build_object('Pushcart', nullif(m.pushcart, 0), 'Nouveaux PDV', nullif(m.nouveaux, 0))),
    'total', m.pushcart + m.nouveaux,
    'realise', '{}'::jsonb,
    'nb_realise', 0,
    'nb_visites', 0) end
  from m
$function$;

comment on function public.objectifs_a_trouver(date, integer) is
  'Objectif « à trouver » d''un jour Atom avec point de visite : pushcarts du jour, plus « Nouveaux PDV » à recruter quand la tournée (p_nb_prevus + pushcarts) est sous le seuil un jour lundi–jeudi (migration 20261105190000).';

create or replace function public.materialiser_routing_jour(p_user_id uuid, p_date date)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_routing_id uuid;
  v_template_id uuid;
  v_nb integer;
  v_libre boolean;
  v_objectifs jsonb;
begin
  -- Un merchandiser ne matérialise que ses tournées ; l'admin / superviseur
  -- celles de tout le monde ; le cron (auth.uid() NULL) aussi.
  if auth.uid() is not null and auth.uid() <> p_user_id and not exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')
  ) then
    raise exception 'materialiser_routing_jour : accès refusé';
  end if;

  select id into v_routing_id
  from routings
  where user_id = p_user_id and date_routing = p_date
  limit 1;

  -- IDEMPOTENTE : une tournée existante est rendue telle quelle, jamais
  -- recalculée (l'app appelle cette fonction à chaque ouverture).
  if v_routing_id is not null then
    return v_routing_id;
  end if;

  v_libre := jour_visite_libre(p_user_id, p_date);

  create temp table if not exists _etapes_jour (
    pdv_id text, ordre integer, objectifs jsonb, template_id uuid
  ) on commit drop;
  truncate _etapes_jour;

  -- Règles périmètre : tout le portefeuille, exceptions PDV retirées.
  insert into _etapes_jour (pdv_id, ordre, objectifs, template_id)
  select
    tp.pdv_id,
    row_number() over (order by r.created_at, tp.position_order)::int,
    coalesce(tp.objectifs, '{}'::jsonb),
    r.id
  from routing_regles_du_jour(p_user_id, p_date) r
  join routing_template_pdv tp on tp.template_id = r.id
  where r.mode = 'perimetre'
    and not exists (
      select 1 from routing_template_exception e
      where e.template_id = r.id and e.pdv_id = tp.pdv_id
        and p_date between e.date_debut and e.date_fin
    );

  -- Règles quota : sélection du jour (aucune un jour de visite libre).
  if not v_libre and exists (select 1 from routing_regles_du_jour(p_user_id, p_date) r where r.mode = 'quota') then
    insert into _etapes_jour (pdv_id, ordre, objectifs, template_id)
    select q.pdv_id, 100000 + q.ordre, q.objectifs,
      (select r.id from routing_regles_du_jour(p_user_id, p_date) r where r.mode = 'quota' order by r.created_at limit 1)
    from etapes_quota_du_jour(p_user_id, p_date) q;
  end if;

  select count(distinct e.pdv_id), min(e.template_id::text)::uuid
  into v_nb, v_template_id
  from _etapes_jour e;

  -- Aucune étape : pas de tournée vide, sauf un jour de visite libre.
  if coalesce(v_nb, 0) = 0 and not v_libre then
    return null;
  end if;

  -- Objectif du jour : visite libre, ou pushcarts à trouver un jour Atom avec
  -- un point de visite, plus les nouveaux PDV à recruter si la tournée est
  -- sous l'objectif (05/11/2026).
  if v_libre then
    v_objectifs := objectifs_visite_libre(p_date);
  elsif exists (
    select 1 from routing_mensuel r
    join profiles m on m.id = r.merchandiser_id and m.employeur = 'atom'
    where r.merchandiser_id = p_user_id and r.actif
      and r.jour_semaine = extract(dow from p_date)::int
      and r.semaine_du_mois = semaine_routing(p_date)
      and r.latitude is not null and r.longitude is not null
  ) then
    v_objectifs := objectifs_a_trouver(p_date, coalesce(v_nb, 0));
  end if;

  insert into routings(user_id, date_routing, status, source, template_id, created_by, objectifs)
  values (p_user_id, p_date, 'pending', 'regle', v_template_id, p_user_id, v_objectifs)
  returning id into v_routing_id;

  -- distinct on (pdv_id) : un même PDV dans deux règles ne donne qu'une étape.
  insert into routing_pdv(routing_id, pdv_id, position_order, objectifs, status)
  select v_routing_id, e.pdv_id, row_number() over (order by e.ordre), e.objectifs, 'pending'
  from (
    select distinct on (x.pdv_id) x.pdv_id, x.objectifs, x.ordre
    from _etapes_jour x
    order by x.pdv_id, x.ordre
  ) e;

  return v_routing_id;
end;
$function$;

-- 3. Rotation sur plusieurs mois ----------------------------------------------
create or replace function public.etapes_quota_atom_quartiers(p_user_id uuid, p_date date)
 returns table(pdv_id text, ordre integer, canal text, objectifs jsonb)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_debut date := date_trunc('month', p_date)::date;
  v_fin   date := (date_trunc('month', p_date) + interval '1 month - 1 day')::date;
  v_dow   integer := extract(dow from p_date)::int;
  v_ligne uuid;
  v_q record;
  v_pris integer;
  v_deficit integer := 0;
begin
  -- Même garde que plan_mensuel_atom : soi-même, admin / superviseur, ou
  -- l'agence pour ses merchandisers ; le cron et le serveur (auth.uid() nul) aussi.
  if auth.uid() is not null and auth.uid() <> p_user_id
     and not exists (select 1 from profiles me where me.id = auth.uid() and me.role in ('admin', 'superviseur'))
     and p_user_id not in (select merch_ids_agence()) then
    raise exception 'etapes_quota_atom_quartiers : accès refusé' using errcode = '42501';
  end if;

  select r.id into v_ligne
  from routing_mensuel r
  join profiles m on m.id = r.merchandiser_id and m.employeur = 'atom'
  where r.merchandiser_id = p_user_id and r.actif
    and r.jour_semaine = v_dow and r.semaine_du_mois = semaine_routing(p_date)
    and r.latitude is not null and r.longitude is not null
  limit 1;
  if v_ligne is null then
    return;
  end if;

  create temp table if not exists _cand_atom_rotation (
    pdv_id text, canal text, rang integer, voisin boolean, vu_le timestamptz, pris boolean default false
  ) on commit drop;
  truncate _cand_atom_rotation;

  -- Rotation (05/11/2026) : la date de la dernière visite du PDV, quel que soit
  -- le merchandiser ; jamais visité = null, pris en premier.
  insert into _cand_atom_rotation (pdv_id, canal, rang, voisin, vu_le)
  select c.pdv_id, c.canal, c.rang, c.quartier_voisin,
         (select max(v.date_visite) from visites v where v.pdv_id = c.pdv_id)
  from atom_pdv_possibles(v_ligne) c
  where not exists (
      select 1 from routing_pdv rp join routings rt on rt.id = rp.routing_id
      where rt.user_id = p_user_id and rt.date_routing between v_debut and v_fin
        and rt.status <> 'cancelled' and rp.pdv_id = c.pdv_id)
    and not exists (
      select 1 from visites v
      where v.user_id = p_user_id and v.pdv_id = c.pdv_id
        and v.date_visite >= v_debut and v.date_visite < v_fin + 1);

  -- Les pushcarts bougent : pas tirés par leur nom, ils sont « à trouver »
  -- (objectifs_a_trouver), donc pas de déficit à combler par des boutiques.
  -- Ordre : PDV du point du jour d'abord, jamais vus puis vus il y a le plus
  -- longtemps, puis les plus proches ; points voisins ensuite.
  for v_q in select qc.canal, qc.quota from routing_quota_canal qc
             where qc.jour_semaine = v_dow and qc.canal <> 'Pushcart' loop
    update _cand_atom_rotation c set pris = true
    where c.pdv_id in (
      select c2.pdv_id from _cand_atom_rotation c2
      where c2.canal = v_q.canal and not c2.pris
      order by c2.voisin, c2.vu_le nulls first, c2.rang limit v_q.quota);
    get diagnostics v_pris = row_count;
    v_deficit := v_deficit + v_q.quota - v_pris;
  end loop;

  -- Un type manquant est remplacé par des boutiques (NB du client).
  if v_deficit > 0 then
    update _cand_atom_rotation c set pris = true
    where c.pdv_id in (
      select c2.pdv_id from _cand_atom_rotation c2
      where c2.canal = 'Boutique' and not c2.pris
      order by c2.voisin, c2.vu_le nulls first, c2.rang limit v_deficit);
  end if;

  -- Ordre de passage : celui de la proximité (rang), comme avant.
  return query
    select c.pdv_id, c.rang, c.canal, jsonb_build_object('releve_stock', true, 'photos', true)
    from _cand_atom_rotation c where c.pris order by c.rang;
end;
$function$;

-- 4. Rattachement au distributeur ---------------------------------------------
create or replace function public.recalculer_quartiers_atom(p_pdv_ids text[] default null::text[])
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  n integer;
  m integer;
  v_max_m numeric := coalesce(parametre_app_valeur('rattachement_distributeur_max_m'), 0);
begin
  if p_pdv_ids is null then
    delete from pdv_quartier_tournee where true;
  else
    delete from pdv_quartier_tournee where pdv_id = any (p_pdv_ids);
  end if;

  with points as materialized (
    select r.merchandiser_id, r.latitude, r.longitude, r.distributeur
    from routing_mensuel r
    join profiles m on m.id = r.merchandiser_id and m.employeur = 'atom' and coalesce(m.is_active, true)
      and coalesce(m.email, '') not like '%@friesland-test.ci'
    where r.actif and r.latitude is not null and r.longitude is not null
  )
  insert into pdv_quartier_tournee (pdv_id, merchandiser_id, point_lat, point_lng, distance_m, calcule_le)
  select p.pdv_id, x.merchandiser_id, x.latitude, x.longitude,
         round(distance_m(p.geolocation_lat, p.geolocation_lng, x.latitude, x.longitude))::int, now()
  from pdv_atom a
  join pdv p on p.pdv_id = a.pdv_id
  cross join lateral (
    select pt.merchandiser_id, pt.latitude, pt.longitude
    from points pt
    cross join lateral (
      select round(sqrt(power((pt.latitude - p.geolocation_lat) * 110574, 2)
                      + power((pt.longitude - p.geolocation_lng) * 111320 * 0.9958, 2))) as d
    ) dd
    -- 05/11/2026 : d'abord un merchandiser de son distributeur à v_max_m au
    -- plus ; sinon le point le plus proche (il n'entre alors dans aucune tournée).
    order by case when pt.distributeur is not distinct from p.distributor_name and dd.d <= v_max_m then 0 else 1 end,
             dd.d,
             (pt.distributeur is distinct from p.distributor_name),
             pt.merchandiser_id
    limit 1
  ) x
  where coalesce(p.is_active, true)
    and p.geolocation_lat is not null and p.geolocation_lng is not null
    and not (p.geolocation_lat = 0 and p.geolocation_lng = 0)
    and (p_pdv_ids is null or p.pdv_id = any (p_pdv_ids));
  get diagnostics n = row_count;

  -- PDV sans GPS rattachés à un point de visite par leur quartier (liste
  -- Treichville, 05/11/2026) : la première visite leur donne un GPS
  -- (pdv_gps_depuis_visite), puis le rattachement par GPS prend le relais.
  insert into pdv_quartier_tournee (pdv_id, merchandiser_id, point_lat, point_lng, distance_m, calcule_le)
  select p.pdv_id, f.merchandiser_id, pt.latitude, pt.longitude, 0, now()
  from pdv_point_visite_force f
  join pdv_atom a on a.pdv_id = f.pdv_id
  join pdv p on p.pdv_id = f.pdv_id
  cross join lateral (
    select r.latitude, r.longitude from routing_mensuel r
    where r.merchandiser_id = f.merchandiser_id and r.actif and r.point_visite = f.point_visite
      and r.latitude is not null and r.longitude is not null
    order by r.semaine_du_mois, r.jour_semaine limit 1
  ) pt
  where coalesce(p.is_active, true)
    and (p.geolocation_lat is null or p.geolocation_lng is null or (p.geolocation_lat = 0 and p.geolocation_lng = 0))
    and (p_pdv_ids is null or p.pdv_id = any (p_pdv_ids))
    and not exists (select 1 from pdv_quartier_tournee q where q.pdv_id = p.pdv_id);
  get diagnostics m = row_count;
  return n + m;
end;
$function$;

-- 5. Treichville ----------------------------------------------------------------
create table if not exists public.routing_regles_liste_pdv_avant_20261105 (
  template_id uuid primary key,
  regle jsonb not null,
  pdv jsonb not null,
  sauvegarde_le timestamptz not null default now()
);
alter table public.routing_regles_liste_pdv_avant_20261105 enable row level security;
comment on table public.routing_regles_liste_pdv_avant_20261105 is
  'Règles « Liste PDV » (périmètre) de Gui Stéphane arrêtées le 05/11/2026 (migration 20261105190000).';

create temporary table regles_treichville on commit drop as
select t.id
from routing_templates t
where t.user_id = 'b2c92c6f-6841-4ded-97cd-61172b55b7cb'
  and t.mode = 'perimetre' and t.is_active and t.label like 'Liste PDV —%';

insert into routing_regles_liste_pdv_avant_20261105 (template_id, regle, pdv)
select t.id, to_jsonb(t),
       coalesce((select jsonb_agg(to_jsonb(tp)) from routing_template_pdv tp where tp.template_id = t.id), '[]'::jsonb)
from routing_templates t join regles_treichville r on r.id = t.id
on conflict (template_id) do nothing;

-- PDV sans GPS : point de visite d'après leur quartier (avant pdv_atom,
-- dont le trigger recalcule aussitôt leur rattachement).
insert into pdv_point_visite_force (pdv_id, merchandiser_id, point_visite, motif)
select distinct on (p.pdv_id) p.pdv_id, 'b2c92c6f-6841-4ded-97cd-61172b55b7cb'::uuid,
       case p.quartier
         when 'Quartier Appolo' then 'Quartier Apollo'
         when 'France Afrique' then 'Quartier Apollo'
         when 'Belleville' then 'Belle ville'
         when 'Aras' then 'Arras'
         when 'Biafra' then 'Biafra'
       end,
       'Liste Atom Treichville sans GPS (quartier ' || p.quartier || ')'
from routing_template_pdv tp
join regles_treichville r on r.id = tp.template_id
join pdv p on p.pdv_id = tp.pdv_id and coalesce(p.is_active, true)
where (p.geolocation_lat is null or p.geolocation_lng is null)
  and p.quartier in ('Quartier Appolo', 'France Afrique', 'Belleville', 'Aras', 'Biafra')
on conflict (pdv_id) do nothing;

insert into pdv_atom (pdv_id, source_id, ajoute_le)
select distinct tp.pdv_id, 'liste-treichville-20261105', now()
from routing_template_pdv tp
join regles_treichville r on r.id = tp.template_id
join pdv p on p.pdv_id = tp.pdv_id and coalesce(p.is_active, true)
on conflict do nothing;

update routing_templates t
set is_active = false, date_fin = (now() at time zone 'Africa/Abidjan')::date
from regles_treichville r
where t.id = r.id;



-- 6. Listes par quartier recalculées (rattachement + nouveaux PDV de Treichville)
select recalculer_quartiers_atom();

-- 7. Tournées de Gui Stéphane à partir de demain, sans avancement : refaites --
create table if not exists public.routings_refaits_20261105 (
  routing_id uuid primary key,
  routing jsonb not null,
  etapes jsonb not null,
  sauvegarde_le timestamptz not null default now()
);
alter table public.routings_refaits_20261105 enable row level security;
comment on table public.routings_refaits_20261105 is
  'Tournées de Gui Stéphane du 06/11 au 12/11/2026, avant d''être refaites sans les règles « Liste PDV » (migration 20261105190000).';

create temporary table tournees_a_refaire on commit drop as
select r.id, r.date_routing
from routings r
where r.user_id = 'b2c92c6f-6841-4ded-97cd-61172b55b7cb'
  and r.date_routing > (now() at time zone 'Africa/Abidjan')::date
  and not exists (select 1 from routing_pdv rp where rp.routing_id = r.id and rp.status <> 'pending')
  and not exists (
    select 1 from visites v
    where v.user_id = r.user_id and (v.date_visite at time zone 'Africa/Abidjan')::date = r.date_routing);

insert into routings_refaits_20261105 (routing_id, routing, etapes)
select r.id, to_jsonb(r),
       coalesce((select jsonb_agg(to_jsonb(rp)) from routing_pdv rp where rp.routing_id = r.id), '[]'::jsonb)
from routings r join tournees_a_refaire t on t.id = r.id
on conflict (routing_id) do nothing;

delete from routings r using tournees_a_refaire t where r.id = t.id;

select materialiser_routing_jour('b2c92c6f-6841-4ded-97cd-61172b55b7cb', t.date_routing)
from tournees_a_refaire t order by t.date_routing;

-- 8. Objectifs des autres tournées à venir -------------------------------------
create temporary table objectifs_maj on commit drop as
select r.id,
       objectifs_a_trouver(r.date_routing, (
         select count(*)::int from routing_pdv rp
         where rp.routing_id = r.id
           and not coalesce((rp.objectifs->>'a_trouver')::boolean, false)
           and not coalesce((rp.objectifs->>'visite_libre')::boolean, false)
           and not (rp.objectifs ? 'cree_ce_jour'))) as nouveau
from routings r
where r.date_routing >= (now() at time zone 'Africa/Abidjan')::date
  and r.status <> 'cancelled'
  and r.objectifs->>'type' = 'a_trouver';

update routings r
set objectifs = r.objectifs || jsonb_build_object('quotas', m.nouveau->'quotas', 'total', m.nouveau->'total')
from objectifs_maj m
where m.id = r.id
  and m.nouveau is not null
  and (r.objectifs->'quotas') is distinct from (m.nouveau->'quotas');

select bilan_visite_libre(m.id) from objectifs_maj m;

commit;
