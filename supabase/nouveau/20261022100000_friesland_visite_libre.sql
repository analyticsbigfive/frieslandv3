-- ============================================================================
-- VISITE LIBRE DES MERCHANDISERS ATOM (décision de Jean Luc du 22/10/2026)
--
-- « Le samedi 4, c'est visite libre » (Deheo Wilfried). Jean Luc :
-- « les jours sans routing - visite libre. les jours avec routing on suit la
-- logique de l'app ».
--
-- 1. Jour de visite libre = un merchandiser Atom qui a une tournée mensuelle
--    (routing_mensuel), mais pas de point de visite ce jour-là : le samedi de
--    la semaine 4 de Deheo, les jours de la 5e semaine (29, 30, 31 octobre),
--    tout autre trou. Aucun PDV n'est imposé (avant : 10 à 20 PDV choisis par
--    l'ancien calcul, etapes_quota_du_jour_avant_quartiers, qui ne sert plus
--    aux merchandisers Atom que pour une ligne de routing sans GPS).
--    Les jours avec un point de visite ne changent pas. Le dimanche (aucun
--    quota) n'est jamais un jour de visite libre.
-- 2. La tournée du jour existe quand même, sans PDV, avec son objectif :
--    routings.objectifs = quotas par type de boutique de ce jour
--    (routing_quota_canal ; samedi : Boutique 6, Porridge 1, Pushcart 1,
--    Superette 1, Aboki & Kiosque 1).
-- 3. Chaque visite du merchandiser ce jour-là devient un PDV fait de sa
--    tournée (routing_pdv « completed », dans l'ordre des visites). Elle compte
--    dans l'objectif de son type, sauf :
--      · PDV déjà visité ou déjà prévu dans une autre tournée du mois
--        (une fois par mois, comme etapes_quota_atom_quartiers) ;
--      · quota de son type déjà atteint (la 7e boutique d'un samedi) ou type
--        hors grille (supermarché, grossiste…).
--    Un PDV hors de sa liste (pdv_quartier_tournee, même distributeur) compte
--    quand même (Jean Luc : « Oui, elle compte ») : simple indication.
--    Rien n'est jamais refusé : la visite est toujours gardée, et une erreur
--    ici n'empêche jamais son enregistrement.
-- 4. Le soir (20 h, heure d'Abidjan), controler_visites_libres note les jours
--    de visite libre sous l'objectif (alerte_visite_libre) et prévient les
--    responsables par e-mail (fonction Edge notifier-validation-tournee,
--    mêmes secrets RESEND_API_KEY / NOTIF_DESTINATAIRES que la validation des
--    tournées). Sans ces secrets, l'alerte reste visible dans l'admin.
--
-- Mêmes gardes que pdv_gps_depuis_visite (application 1.0.15, inchangée) :
-- visites importées ATOM-… ignorées, seule la visite de l'agent connecté
-- (auth.uid() = user_id) remplit sa tournée.
--
-- Retour arrière :
--   select cron.unschedule('controle_visites_libres');
--   drop trigger trg_visite_libre on public.visites;
--   puis recréer etapes_quota_du_jour et materialiser_routing_jour depuis
--   20261020110000 / 20261006101000 et recalculer les tournées à venir.
-- Idempotente.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Objectif de la tournée du jour
-- ---------------------------------------------------------------------------
alter table public.routings add column if not exists objectifs jsonb;
comment on column public.routings.objectifs is
  'Jour de visite libre : {"type":"visite_libre","quotas":{type de boutique: quota},"total":n,'
  '"realise":{type: PDV comptés},"nb_realise":n,"nb_visites":n}. NULL pour une tournée ordinaire.';

-- Le merchandiser choisit ses PDV ce jour-là (voir l'en-tête).
create or replace function public.jour_visite_libre(p_user_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles m
                 where m.id = p_user_id and m.employeur = 'atom' and m.role = 'merchandiser')
     and exists (select 1 from routing_quota_canal q
                 where q.jour_semaine = extract(dow from p_date)::int and q.quota > 0)
     and exists (select 1 from routing_mensuel r where r.merchandiser_id = p_user_id and r.actif)
     and not exists (select 1 from routing_mensuel r
                     where r.merchandiser_id = p_user_id and r.actif
                       and r.jour_semaine = extract(dow from p_date)::int
                       and r.semaine_du_mois = semaine_routing(p_date))
$$;

-- Objectif d'un jour de visite libre : les quotas par type de ce jour.
create or replace function public.objectifs_visite_libre(p_date date)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'type', 'visite_libre',
    'quotas', coalesce(jsonb_object_agg(q.canal, q.quota) filter (where q.quota > 0), '{}'::jsonb),
    'total', coalesce(sum(q.quota), 0),
    'realise', '{}'::jsonb,
    'nb_realise', 0,
    'nb_visites', 0)
  from routing_quota_canal q
  where q.jour_semaine = extract(dow from p_date)::int
$$;

-- ---------------------------------------------------------------------------
-- 2. Aucun PDV imposé un jour de visite libre
-- ---------------------------------------------------------------------------
create or replace function public.etapes_quota_du_jour(p_user_id uuid, p_date date)
returns table (pdv_id text, ordre integer, canal text, objectifs jsonb)
language plpgsql
set search_path = public
as $$
begin
  if jour_visite_libre(p_user_id, p_date) then
    return;
  end if;
  if exists (
    select 1 from routing_mensuel r
    join profiles m on m.id = r.merchandiser_id and m.employeur = 'atom'
    where r.merchandiser_id = p_user_id and r.actif
      and r.jour_semaine = extract(dow from p_date)::int
      and r.semaine_du_mois = semaine_routing(p_date)
      and r.latitude is not null and r.longitude is not null
  ) then
    return query select * from etapes_quota_atom_quartiers(p_user_id, p_date);
  else
    return query select * from etapes_quota_du_jour_avant_quartiers(p_user_id, p_date);
  end if;
end;
$$;

-- Comme avant (20261006101000), plus : un jour de visite libre crée sa
-- tournée même sans PDV, avec son objectif.
create or replace function public.materialiser_routing_jour(p_user_id uuid, p_date date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_routing_id uuid;
  v_template_id uuid;
  v_nb integer;
  v_libre boolean;
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

  insert into routings(user_id, date_routing, status, source, template_id, created_by, objectifs)
  values (p_user_id, p_date, 'pending', 'regle', v_template_id, p_user_id,
          case when v_libre then objectifs_visite_libre(p_date) end)
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
$$;

-- ---------------------------------------------------------------------------
-- 3. Les visites remplissent la tournée d'un jour de visite libre
-- ---------------------------------------------------------------------------
-- Résultat par type, recalculé depuis les PDV de la tournée. La tournée passe
-- « en cours » à la première visite, « terminée » quand chaque type a son quota.
create or replace function public.bilan_visite_libre(p_routing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_obj jsonb;
  v_realise jsonb;
  v_nb integer;
  v_nb_visites integer;
  v_complet boolean;
begin
  select objectifs into v_obj from routings where id = p_routing_id;
  if coalesce(v_obj->>'type', '') <> 'visite_libre' then
    return null;
  end if;

  select coalesce(jsonb_object_agg(x.canal, x.n), '{}'::jsonb), coalesce(sum(x.n), 0)
  into v_realise, v_nb
  from (
    select rp.objectifs->>'canal' as canal, count(*)::int as n
    from routing_pdv rp
    where rp.routing_id = p_routing_id and coalesce((rp.objectifs->>'compte')::boolean, false)
    group by 1
  ) x;
  select count(*) into v_nb_visites from routing_pdv rp where rp.routing_id = p_routing_id and rp.status = 'completed';
  v_complet := not exists (
    select 1 from jsonb_each_text(v_obj->'quotas') q
    where q.value::int > coalesce((v_realise->>q.key)::int, 0));

  v_obj := v_obj || jsonb_build_object('realise', v_realise, 'nb_realise', v_nb, 'nb_visites', v_nb_visites);
  update routings
  set objectifs = v_obj,
      status = case
        when status = 'cancelled' then status
        when v_complet and v_nb_visites > 0 then 'completed'
        when v_nb_visites > 0 then 'in_progress'
        else status end
  where id = p_routing_id;
  return v_obj;
end;
$$;

create or replace function public.visite_libre_apres_visite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
  v_routing record;
  v_canal text;
  v_debut date;
  v_fin date;
  v_hors_liste boolean;
  v_deja boolean;
  v_hors_quota boolean;
begin
  -- Mêmes gardes que pdv_gps_depuis_visite : pas les visites importées, et
  -- seulement la visite de l'agent connecté.
  if new.visite_id like 'ATOM-%' or new.pdv_id is null or new.user_id is null
     or auth.uid() is null or new.user_id is distinct from auth.uid() then
    return null;
  end if;

  -- Une erreur ici ne doit jamais empêcher la visite d'être enregistrée.
  begin
    v_date := (new.date_visite at time zone 'Africa/Abidjan')::date;

    select r.id, r.objectifs into v_routing
    from routings r
    where r.user_id = new.user_id and r.date_routing = v_date and r.status <> 'cancelled';
    if not found then
      if not jour_visite_libre(new.user_id, v_date) then
        return null;
      end if;
      perform materialiser_routing_jour(new.user_id, v_date);
      select r.id, r.objectifs into v_routing
      from routings r
      where r.user_id = new.user_id and r.date_routing = v_date and r.status <> 'cancelled';
      if not found then
        return null;
      end if;
    end if;
    if coalesce(v_routing.objectifs->>'type', '') <> 'visite_libre' then
      return null;
    end if;

    -- Deux visites synchronisées en même temps : une à la fois par tournée
    -- (ordre de passage et quotas).
    perform 1 from routings where id = v_routing.id for update;
    if exists (select 1 from routing_pdv rp where rp.routing_id = v_routing.id and rp.pdv_id = new.pdv_id) then
      return null;
    end if;

    select canal_atom(p.sous_categorie_pdv) into v_canal from pdv p where p.pdv_id = new.pdv_id;
    v_debut := date_trunc('month', v_date)::date;
    v_fin := (date_trunc('month', v_date) + interval '1 month - 1 day')::date;

    -- 1. Sa liste : PDV rangé chez lui, d'un distributeur de son routing.
    v_hors_liste := not exists (
      select 1 from pdv_quartier_tournee q
      join pdv p on p.pdv_id = q.pdv_id
      where q.pdv_id = new.pdv_id and q.merchandiser_id = new.user_id
        and exists (select 1 from routing_mensuel r
                    where r.merchandiser_id = new.user_id and r.actif
                      and r.distributeur is not distinct from p.distributor_name));
    -- 2. Une fois par mois : déjà visité avant, ou prévu dans une autre tournée du mois.
    v_deja := exists (
        select 1 from routing_pdv rp join routings rt on rt.id = rp.routing_id
        where rt.user_id = new.user_id and rt.date_routing between v_debut and v_fin
          and rt.status <> 'cancelled' and rt.id <> v_routing.id and rp.pdv_id = new.pdv_id)
      or exists (
        select 1 from visites v
        where v.user_id = new.user_id and v.pdv_id = new.pdv_id and v.id <> new.id
          and v.date_visite >= v_debut and v.date_visite < new.date_visite);
    -- 3. Quota de son type pas encore atteint.
    v_hors_quota := v_canal is null
      or coalesce((v_routing.objectifs->'quotas'->>v_canal)::int, 0) <= (
        select count(*) from routing_pdv rp
        where rp.routing_id = v_routing.id and rp.objectifs->>'canal' = v_canal
          and coalesce((rp.objectifs->>'compte')::boolean, false));

    -- Ordre des visites gardé : pas de réordonnancement au plus proche voisin
    -- (même verrou que reordonner_tournee_apres_insertion).
    perform set_config('friesland.tournee_ordonnee_' || replace(v_routing.id::text, '-', ''), '1', true);

    insert into routing_pdv (routing_id, pdv_id, position_order, objectifs, status, arrived_at, completed_at,
                             geofence_validated, geolocation_lat, geolocation_lng, precision_gps, visite_id)
    values (
      v_routing.id, new.pdv_id,
      coalesce((select max(rp.position_order) from routing_pdv rp where rp.routing_id = v_routing.id), 0) + 1,
      jsonb_build_object('visite_libre', true, 'canal', v_canal,
                         'compte', not v_deja and not v_hors_quota,
                         'hors_liste', v_hors_liste, 'deja_ce_mois', v_deja, 'hors_quota', v_hors_quota),
      'completed', new.date_visite, new.date_visite,
      coalesce(new.geofence_validated, false), new.geolocation_lat, new.geolocation_lng, new.precision_gps,
      new.visite_id);

    perform bilan_visite_libre(v_routing.id);
  exception when others then
    raise warning 'visite_libre_apres_visite % : %', new.visite_id, sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists trg_visite_libre on public.visites;
create trigger trg_visite_libre
  after insert on public.visites
  for each row execute function public.visite_libre_apres_visite();

-- ---------------------------------------------------------------------------
-- 4. Contrôle du soir : objectif non atteint → alerte aux responsables
-- ---------------------------------------------------------------------------
create table if not exists public.alerte_visite_libre (
  routing_id      uuid primary key references public.routings(id) on delete cascade,
  merchandiser_id uuid not null references public.profiles(id) on delete cascade,
  date_routing    date not null,
  objectifs       jsonb not null,
  manque          jsonb not null,
  cree_le         timestamptz not null default now(),
  notifie_le      timestamptz
);
comment on table public.alerte_visite_libre is
  'Jours de visite libre sous l''objectif, notés le soir par controler_visites_libres. '
  'manque = {type de boutique: PDV manquants}. notifie_le = e-mail envoyé.';
create index if not exists alerte_visite_libre_date_idx on public.alerte_visite_libre (date_routing);

alter table public.alerte_visite_libre enable row level security;
drop policy if exists alerte_visite_libre_lecture on public.alerte_visite_libre;
create policy alerte_visite_libre_lecture on public.alerte_visite_libre for select to authenticated
  using (public.est_admin_ou_superviseur() or merchandiser_id in (select public.merch_ids_agence()));

create or replace function public.controler_visites_libres(p_date date default current_date)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_nb integer;
  v_url text;
  v_token text;
begin
  if auth.uid() is not null and not public.est_admin_ou_superviseur() then
    raise exception 'controler_visites_libres : réservé aux administrateurs et superviseurs' using errcode = '42501';
  end if;

  with bilans as (
    select r.id, r.user_id, r.date_routing, bilan_visite_libre(r.id) as obj
    from routings r
    join profiles m on m.id = r.user_id and coalesce(m.is_active, true)
    where r.date_routing = p_date and r.status <> 'cancelled'
      and r.objectifs->>'type' = 'visite_libre'
  ),
  manques as (
    select b.id, b.user_id, b.date_routing, b.obj,
           (select jsonb_object_agg(q.key, q.value::int - coalesce((b.obj->'realise'->>q.key)::int, 0))
            from jsonb_each_text(b.obj->'quotas') q
            where q.value::int > coalesce((b.obj->'realise'->>q.key)::int, 0)) as manque
    from bilans b
  ),
  notees as (
    insert into alerte_visite_libre (routing_id, merchandiser_id, date_routing, objectifs, manque)
    select m.id, m.user_id, m.date_routing, m.obj, m.manque from manques m where m.manque is not null
    on conflict (routing_id) do update
      set objectifs = excluded.objectifs, manque = excluded.manque
      where alerte_visite_libre.notifie_le is null
    returning 1
  )
  select count(*) into v_nb from notees;

  -- Même fonction Edge et mêmes secrets Vault que l'e-mail de validation des
  -- tournées. Silencieux si les secrets ne sont pas posés.
  if v_nb > 0 then
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'edge_notifier_validation_url';
    select decrypted_secret into v_token from vault.decrypted_secrets where name = 'edge_notifier_validation_token';
    if v_url is not null and v_token is not null then
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-notifier-secret', v_token),
        body := jsonb_build_object('visite_libre', p_date),
        timeout_milliseconds := 5000
      );
    end if;
  end if;
  return v_nb;
end;
$$;

-- Droits : rien d'ouvert à anon ; les fonctions internes au serveur seulement.
revoke all on function public.jour_visite_libre(uuid, date) from public, anon;
grant execute on function public.jour_visite_libre(uuid, date) to authenticated, service_role;
revoke all on function public.objectifs_visite_libre(date) from public, anon;
grant execute on function public.objectifs_visite_libre(date) to authenticated, service_role;
revoke all on function public.bilan_visite_libre(uuid) from public, anon, authenticated;
grant execute on function public.bilan_visite_libre(uuid) to service_role;
revoke all on function public.visite_libre_apres_visite() from public, anon, authenticated;
revoke all on function public.controler_visites_libres(date) from public, anon;
grant execute on function public.controler_visites_libres(date) to authenticated, service_role;
grant execute on function public.etapes_quota_du_jour(uuid, date) to public, anon, authenticated, service_role;

-- 20 h à Abidjan (UTC+0), du lundi au samedi.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'controle_visites_libres') then
    perform cron.unschedule('controle_visites_libres');
  end if;
  perform cron.schedule('controle_visites_libres', '0 20 * * 1-6', 'select public.controler_visites_libres(current_date)');
end $$;

commit;

-- Après application, refaire les tournées à venir qui deviennent des jours de
-- visite libre (seulement celles pas commencées ; les autres jours ne bougent pas) :
--   with jours as (
--     select p.id, d::date as jour
--     from profiles p
--     cross join generate_series(current_date + 1, current_date + 9, interval '1 day') d
--     where p.employeur = 'atom' and p.role = 'merchandiser' and p.is_active
--       and jour_visite_libre(p.id, d::date)
--   ), supprimees as (
--     delete from routings r using jours j
--     where r.user_id = j.id and r.date_routing = j.jour and r.status = 'pending'
--       and r.objectifs is null
--       and not exists (select 1 from routing_pdv rp where rp.routing_id = r.id and rp.status <> 'pending')
--     returning r.id
--   )
--   select count(*) from supprimees;
--   select p.nom, materialiser_routings_periode(p.id, current_date + 1, current_date + 9)
--   from profiles p where p.employeur = 'atom' and p.role = 'merchandiser' and p.is_active;
