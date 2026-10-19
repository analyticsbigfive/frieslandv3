-- ============================================================================
-- 19/10/2026 — Retours des merchandisers Atom sur le routing
--
-- 1. La position du PDV vient du terrain.
--    Visites faites avec l'app en octobre : 87, dont 13 à plus de 500 m du PDV
--    (jusqu'à 14 km) avec une précision tablette médiane d'environ 1,5 m. C'est
--    la position du PDV en base (DMS, agence) qui est fausse, pas l'agent.
--    Décision de Jean Luc : on laisse faire la visite et on prend la position de
--    la tablette. Après chaque visite hors zone avec une bonne précision, le PDV
--    prend la position de la visite ; l'ancienne est gardée dans
--    pdv_gps_historique. Jamais pour un PDV placé par l'admin, jamais pour les
--    visites importées (ATOM-…). Côté serveur : aucune nouvelle APK.
--    geolocaliser_pdv (1.0.10) reste inchangée : elle ne remplit qu'un GPS vide.
--
-- 2. La tournée suit la rue.
--    « Sur un axe de 500 m il y a au moins 5 PDV, ils ne sont pas enregistrés
--    l'un après l'autre » (Abbé Frédéric). La sélection par quotas range les PDV
--    par catégorie. Sa tournée du 19/10 : 4,5 km à pied pour 20 PDV dans l'ordre
--    de l'app, 2,2 km au plus proche voisin. reordonner_tournee réécrit
--    position_order au plus proche voisin, en partant du point de la journée
--    (routing_mensuel) ; elle est appelée à la fin de la transaction qui crée
--    les étapes (trigger différé), sans toucher materialiser_routing_jour.
--
-- Appliquée en production le 19/10/2026 via le MCP Supabase (sections 0 à 2,
-- puis rattrapage de la section 3 : 63 tournées Atom réordonnées, trajet moyen
-- de 4,2 à 3,5 km ; les 77 tournées « périmètre » Friesland sont ignorées).
-- Idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Distance en mètres (haversine)
-- ---------------------------------------------------------------------------
create or replace function public.distance_m(
  lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision
) returns double precision
language sql immutable parallel safe
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

-- ---------------------------------------------------------------------------
-- 1. Position du PDV corrigée par la visite
-- ---------------------------------------------------------------------------
create table if not exists public.pdv_gps_historique (
  id           bigserial primary key,
  pdv_id       text not null,
  ancien_lat   double precision,
  ancien_lng   double precision,
  ancienne_source text,
  nouveau_lat  double precision not null,
  nouveau_lng  double precision not null,
  precision_m  numeric,
  ecart_m      integer,
  visite_id    text,
  auteur       uuid references public.profiles(id) on delete set null,
  cree_le      timestamptz not null default now()
);
create index if not exists pdv_gps_historique_pdv_idx on public.pdv_gps_historique (pdv_id, cree_le desc);
comment on table public.pdv_gps_historique is
  'Positions de PDV remplacées par une visite terrain hors zone (19/10/2026). Pour revenir en arrière : remettre ancien_lat/ancien_lng.';

alter table public.pdv_gps_historique enable row level security;
drop policy if exists pdv_gps_historique_lecture_admin on public.pdv_gps_historique;
create policy pdv_gps_historique_lecture_admin on public.pdv_gps_historique
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')));

create or replace function public.pdv_gps_depuis_visite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pdv record;
  v_emp text;
  v_rayon numeric;
  v_prec_max numeric;
  v_ecart double precision;
begin
  if new.visite_id like 'ATOM-%'
     or new.geolocation_lat is null or new.geolocation_lng is null
     or (new.geolocation_lat = 0 and new.geolocation_lng = 0)
     or new.precision_gps is null or new.precision_gps <= 0 then
    return new;
  end if;

  -- Même garde que geolocaliser_pdv : la visite est celle de l'agent connecté,
  -- qui a le droit d'écrire sur le terrain, et le PDV est dans son périmètre.
  -- Une visite insérée par le service (import, script) ne déplace rien.
  if auth.uid() is null or new.user_id is distinct from auth.uid()
     or not public.peut_ecrire_terrain()
     or not exists (select 1 from public.pdv_ids_perimetre() x where x = new.pdv_id) then
    return new;
  end if;

  v_prec_max := coalesce(parametre_app_valeur('gps_precision_pdv_max_m'), 30);
  if new.precision_gps > v_prec_max then
    return new;
  end if;

  select pdv_id, geolocation_lat, geolocation_lng, gps_source
  into v_pdv
  from pdv where pdv_id = new.pdv_id;
  if not found or v_pdv.gps_source = 'admin'
     or v_pdv.geolocation_lat is null or v_pdv.geolocation_lng is null then
    -- PDV sans position : geolocaliser_pdv s'en charge déjà côté app.
    return new;
  end if;

  select employeur into v_emp from profiles where id = new.user_id;
  v_rayon := coalesce(parametre_app_valeur('geofence_rayon_m', v_emp), 300);
  v_ecart := distance_m(v_pdv.geolocation_lat, v_pdv.geolocation_lng, new.geolocation_lat, new.geolocation_lng);
  if v_ecart <= v_rayon then
    return new;
  end if;

  insert into pdv_gps_historique (pdv_id, ancien_lat, ancien_lng, ancienne_source, nouveau_lat, nouveau_lng,
                                  precision_m, ecart_m, visite_id, auteur)
  values (v_pdv.pdv_id, v_pdv.geolocation_lat, v_pdv.geolocation_lng, v_pdv.gps_source,
          new.geolocation_lat, new.geolocation_lng, new.precision_gps, round(v_ecart)::int, new.visite_id, new.user_id);

  update pdv
  set geolocation_lat = new.geolocation_lat,
      geolocation_lng = new.geolocation_lng,
      gps_source = 'terrain',
      gps_precision_m = round(new.precision_gps)::int,
      gps_maj_par = new.user_id,
      gps_maj_le = now()
  where pdv_id = v_pdv.pdv_id;

  return new;
end;
$$;

drop trigger if exists trg_pdv_gps_depuis_visite on public.visites;
create trigger trg_pdv_gps_depuis_visite
  after insert on public.visites
  for each row execute function public.pdv_gps_depuis_visite();

-- ---------------------------------------------------------------------------
-- 2. Ordre de passage de la tournée
-- ---------------------------------------------------------------------------
create or replace function public.reordonner_tournee(p_routing_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_date date;
  v_lat double precision;
  v_lng double precision;
  v_cur record;
  v_rang integer := 0;
  v_nb integer;
begin
  -- Seulement les tournées générées par les règles : une tournée composée à la
  -- main par l'admin garde son ordre.
  select user_id, date_routing into v_user, v_date from routings where id = p_routing_id and source = 'regle';
  if v_user is null then
    return 0;
  end if;

  create temp table if not exists _ordre_tournee (
    rp_id uuid primary key, lat double precision, lng double precision, rang integer
  ) on commit drop;
  truncate _ordre_tournee;

  insert into _ordre_tournee (rp_id, lat, lng)
  select rp.id, p.geolocation_lat, p.geolocation_lng
  from routing_pdv rp
  left join pdv p on p.pdv_id = rp.pdv_id
  where rp.routing_id = p_routing_id;

  get diagnostics v_nb = row_count;
  -- Tournées « périmètre » Friesland (des centaines de PDV) : on ne touche pas.
  if v_nb < 2 or v_nb > 200 then
    return 0;
  end if;

  -- Départ : le point de la journée (routing mensuel), sinon le PDV le plus à l'ouest.
  select rm.latitude, rm.longitude into v_lat, v_lng
  from routing_mensuel rm
  where rm.merchandiser_id = v_user and rm.actif
    and rm.jour_semaine = extract(dow from v_date)::int
    and rm.semaine_du_mois = semaine_routing(v_date)
    and rm.latitude is not null and rm.longitude is not null
  limit 1;

  if v_lat is null then
    select lat, lng into v_lat, v_lng from _ordre_tournee
    where lat is not null and lng is not null
    order by lng, lat limit 1;
  end if;

  if v_lat is not null then
    loop
      select rp_id, lat, lng into v_cur
      from _ordre_tournee
      where rang is null and lat is not null and lng is not null
      order by distance_m(v_lat, v_lng, lat, lng)
      limit 1;
      exit when not found;
      v_rang := v_rang + 1;
      update _ordre_tournee set rang = v_rang where rp_id = v_cur.rp_id;
      v_lat := v_cur.lat;
      v_lng := v_cur.lng;
    end loop;
  end if;

  -- PDV sans position : en fin de liste, dans leur ordre d'origine.
  update _ordre_tournee o
  set rang = v_rang + s.n
  from (
    select o2.rp_id, row_number() over (order by rp.position_order, rp.id) as n
    from _ordre_tournee o2 join routing_pdv rp on rp.id = o2.rp_id
    where o2.rang is null
  ) s
  where o.rp_id = s.rp_id;

  update routing_pdv rp
  set position_order = o.rang
  from _ordre_tournee o
  where rp.id = o.rp_id and rp.position_order is distinct from o.rang;

  return v_nb;
end;
$$;

-- Pas d'appel direct depuis l'app : seuls le trigger (security definer) et le
-- service l'utilisent.
revoke all on function public.reordonner_tournee(uuid) from public, anon, authenticated;
grant execute on function public.reordonner_tournee(uuid) to service_role;

-- Appelée une fois par tournée, à la fin de la transaction qui crée ses étapes
-- (materialiser_routing_jour, imports, régénérations), sans la modifier.
create or replace function public.reordonner_tournee_apres_insertion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cle text := 'friesland.tournee_ordonnee_' || replace(new.routing_id::text, '-', '');
begin
  if current_setting(v_cle, true) = '1' then
    return null;
  end if;
  perform set_config(v_cle, '1', true);
  perform reordonner_tournee(new.routing_id);
  return null;
end;
$$;

drop trigger if exists trg_reordonner_tournee on public.routing_pdv;
create constraint trigger trg_reordonner_tournee
  after insert on public.routing_pdv
  deferrable initially deferred
  for each row execute function public.reordonner_tournee_apres_insertion();

-- ---------------------------------------------------------------------------
-- 3. Rattrapage : tournées d'aujourd'hui et à venir
-- ---------------------------------------------------------------------------
select count(*) as tournees_reordonnees
from (
  select public.reordonner_tournee(r.id)
  from public.routings r
  where r.date_routing >= current_date and r.source = 'regle'
) x;
