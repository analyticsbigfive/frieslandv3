-- ============================================================================
-- PUSHCARTS ITINÉRANTS (22/10/2026, accord du superviseur)
--
-- Friesland : « les pushcarts sont itinérants, donc difficiles à géolocaliser
-- dans une zone ». Deux problèmes :
--   · depuis 20261022100000_friesland_gps_premiere_visite (app 1.0.15), la
--     première visite fixe la position d'un PDV et la suivante doit se faire à
--     moins de 300 m : un pushcart qui a bougé ne pouvait plus être visité ;
--   · la tournée imposait des pushcarts par leur nom, parfois à 3 km du point
--     de visite (Deheo, 22/10 : 2 pushcarts vers Toit rouge).
--
-- 1. Pas de position fixe. Un pushcart (canal_atom = 'Pushcart') n'est jamais
--    « repéré » : sa source GPS est 'itinerant' (ni 'terrain' ni 'admin'),
--    donc l'app ne bloque jamais sa visite, et chaque visite assez précise
--    met sa position à jour (pdv_gps_depuis_visite, historique gardé).
-- 2. Pas de pushcart imposé. Les jours avec un point de visite, la tournée ne
--    tire plus de pushcart (le quota n'est pas non plus remplacé par des
--    boutiques) ; l'objectif du jour porte « Pushcart 2 » (1 le vendredi et le
--    samedi) dans routings.objectifs (type 'a_trouver'). Tout pushcart visité
--    ce jour-là s'ajoute à la tournée comme PDV fait et compte, mêmes
--    exceptions que la visite libre (déjà vu ce mois-ci, quota atteint).
-- 3. Les jours de visite libre ne changent pas (les pushcarts y comptent déjà).
--
-- Après application : recalculer les tournées à venir des merchandisers Atom
-- (fin du fichier). Idempotente.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Position itinérante
-- ---------------------------------------------------------------------------
alter table public.pdv drop constraint if exists pdv_gps_source_valide;
alter table public.pdv add constraint pdv_gps_source_valide check (
  gps_source is null or gps_source = any (array[
    'dms', 'dms-absent', 'dms-depot', 'terrain', 'admin', 'atom', 'atom-absent', 'atom-fichier', 'itinerant']));

-- Un pushcart ne garde jamais de repère : la première visite (pdv_gps_depuis_visite)
-- ou un admin (pdv_gps_admin, qui passe avant dans l'ordre alphabétique) écrit
-- 'terrain' / 'admin', on le remplace par 'itinerant'. Pas de « update of » :
-- la source peut être changée par un autre déclencheur, pas par la requête.
create or replace function public.pdv_pushcart_itinerant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.gps_source in ('terrain', 'admin') and canal_atom(new.sous_categorie_pdv) = 'Pushcart' then
    new.gps_source := 'itinerant';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pdv_pushcart_itinerant on public.pdv;
create trigger trg_pdv_pushcart_itinerant
  before insert or update on public.pdv
  for each row execute function public.pdv_pushcart_itinerant();

update public.pdv set gps_source = 'itinerant'
where gps_source in ('terrain', 'admin') and canal_atom(sous_categorie_pdv) = 'Pushcart';

-- ---------------------------------------------------------------------------
-- 2. Pas de pushcart imposé : objectif « à trouver »
-- ---------------------------------------------------------------------------
-- Comme 20261020110000, sans le quota Pushcart (ni boutiques en remplacement).
create or replace function public.etapes_quota_atom_quartiers(p_user_id uuid, p_date date)
returns table (pdv_id text, ordre integer, canal text, objectifs jsonb)
language plpgsql
security definer
set search_path = public
as $$
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

  create temp table if not exists _cand_atom (
    pdv_id text, canal text, rang integer, pris boolean default false
  ) on commit drop;
  truncate _cand_atom;

  insert into _cand_atom (pdv_id, canal, rang)
  select c.pdv_id, c.canal, c.rang
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
  for v_q in select qc.canal, qc.quota from routing_quota_canal qc
             where qc.jour_semaine = v_dow and qc.canal <> 'Pushcart' loop
    update _cand_atom c set pris = true
    where c.pdv_id in (
      select c2.pdv_id from _cand_atom c2
      where c2.canal = v_q.canal and not c2.pris
      order by c2.rang limit v_q.quota);
    get diagnostics v_pris = row_count;
    v_deficit := v_deficit + v_q.quota - v_pris;
  end loop;

  -- Un type manquant est remplacé par des boutiques (NB du client).
  if v_deficit > 0 then
    update _cand_atom c set pris = true
    where c.pdv_id in (
      select c2.pdv_id from _cand_atom c2
      where c2.canal = 'Boutique' and not c2.pris
      order by c2.rang limit v_deficit);
  end if;

  return query
    select c.pdv_id, c.rang, c.canal, jsonb_build_object('releve_stock', true, 'photos', true)
    from _cand_atom c where c.pris order by c.rang;
end;
$$;

-- Objectif d'un jour avec point de visite : les pushcarts à trouver ce jour-là.
create or replace function public.objectifs_a_trouver(p_date date)
returns jsonb
language sql
stable
set search_path = public
as $$
  select case when coalesce(sum(q.quota), 0) > 0 then jsonb_build_object(
    'type', 'a_trouver',
    'quotas', jsonb_object_agg(q.canal, q.quota),
    'total', sum(q.quota),
    'realise', '{}'::jsonb,
    'nb_realise', 0,
    'nb_visites', 0) end
  from routing_quota_canal q
  where q.jour_semaine = extract(dow from p_date)::int and q.canal = 'Pushcart' and q.quota > 0
$$;

-- Comme 20261022100000_friesland_visite_libre, plus : un jour Atom avec un
-- point de visite reçoit l'objectif « à trouver ».
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
  -- un point de visite (celui que suit etapes_quota_atom_quartiers).
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
    v_objectifs := objectifs_a_trouver(p_date);
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
$$;

-- ---------------------------------------------------------------------------
-- 3. Les pushcarts visités remplissent l'objectif du jour
-- ---------------------------------------------------------------------------
-- Comme 20261022100000_friesland_visite_libre, pour les deux objectifs. Le
-- statut de la tournée ne bouge que pour la visite libre (sinon l'app le tient).
create or replace function public.bilan_visite_libre(p_routing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_obj jsonb;
  v_type text;
  v_realise jsonb;
  v_nb integer;
  v_nb_visites integer;
  v_complet boolean;
begin
  select objectifs into v_obj from routings where id = p_routing_id;
  v_type := coalesce(v_obj->>'type', '');
  if v_type not in ('visite_libre', 'a_trouver') then
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
  -- Visites ajoutées par ce mécanisme : toutes un jour de visite libre, seulement
  -- les pushcarts trouvés un jour ordinaire.
  select count(*) into v_nb_visites from routing_pdv rp
  where rp.routing_id = p_routing_id and rp.status = 'completed'
    and (v_type = 'visite_libre' or coalesce((rp.objectifs->>'a_trouver')::boolean, false));
  v_complet := not exists (
    select 1 from jsonb_each_text(v_obj->'quotas') q
    where q.value::int > coalesce((v_realise->>q.key)::int, 0));

  v_obj := v_obj || jsonb_build_object('realise', v_realise, 'nb_realise', v_nb, 'nb_visites', v_nb_visites);
  update routings
  set objectifs = v_obj,
      status = case
        when v_type <> 'visite_libre' or status = 'cancelled' then status
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
  v_type text;
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
      -- Seul un jour de visite libre se crée depuis une visite (pas de PDV
      -- imposé à recalculer pour un jour passé).
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

    v_type := coalesce(v_routing.objectifs->>'type', '');
    if v_type not in ('visite_libre', 'a_trouver') then
      return null;
    end if;
    select canal_atom(p.sous_categorie_pdv) into v_canal from pdv p where p.pdv_id = new.pdv_id;
    -- Un jour ordinaire, seuls les types « à trouver » (pushcarts) s'ajoutent.
    if v_type = 'a_trouver' and (v_canal is null or not (v_routing.objectifs->'quotas') ? v_canal) then
      return null;
    end if;

    -- Deux visites synchronisées en même temps : une à la fois par tournée
    -- (ordre de passage et quotas).
    perform 1 from routings where id = v_routing.id for update;
    if exists (select 1 from routing_pdv rp where rp.routing_id = v_routing.id and rp.pdv_id = new.pdv_id) then
      return null;
    end if;

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

    -- Ordre gardé : en fin de liste, sans réordonner au plus proche voisin
    -- (même verrou que reordonner_tournee_apres_insertion).
    perform set_config('friesland.tournee_ordonnee_' || replace(v_routing.id::text, '-', ''), '1', true);

    insert into routing_pdv (routing_id, pdv_id, position_order, objectifs, status, arrived_at, completed_at,
                             geofence_validated, geolocation_lat, geolocation_lng, precision_gps, visite_id)
    values (
      v_routing.id, new.pdv_id,
      coalesce((select max(rp.position_order) from routing_pdv rp where rp.routing_id = v_routing.id), 0) + 1,
      jsonb_build_object(case v_type when 'a_trouver' then 'a_trouver' else 'visite_libre' end, true,
                         'canal', v_canal,
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

-- Droits : comme les fonctions qu'elles remplacent.
revoke all on function public.pdv_pushcart_itinerant() from public, anon, authenticated;
revoke all on function public.etapes_quota_atom_quartiers(uuid, date) from public, anon;
grant execute on function public.etapes_quota_atom_quartiers(uuid, date) to authenticated, service_role;
revoke all on function public.objectifs_a_trouver(date) from public, anon;
grant execute on function public.objectifs_a_trouver(date) to authenticated, service_role;
revoke all on function public.bilan_visite_libre(uuid) from public, anon, authenticated;
grant execute on function public.bilan_visite_libre(uuid) to service_role;
revoke all on function public.visite_libre_apres_visite() from public, anon, authenticated;

commit;

-- Après application, refaire les tournées à venir pas commencées des
-- merchandisers Atom (les pushcarts imposés en sortent, l'objectif est posé) :
--   select p.nom, recalculer_tournees_a_venir(p.id, 9)
--   from profiles p where p.employeur = 'atom' and p.role = 'merchandiser' and p.is_active;
