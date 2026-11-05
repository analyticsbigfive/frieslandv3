-- ============================================================================
-- LES BOUTIQUES CRÉÉES SUR PLACE COMPTENT DANS LA TOURNÉE DU JOUR
-- (décision de Jean Luc du 05/11/2026, après la plainte de Gui Stéphane)
--
-- Avant : un jour ordinaire (objectifs type « a_trouver »), seule la visite
-- d'un pushcart s'ajoutait à la tournée (PR #43). Une boutique créée et
-- visitée sur place ne comptait pas : le 04/11, Stéphane voyait 20/39 dans
-- « Calendrier des tournées » pour 22 visites (Hamed et Oumar créés ce jour).
--
-- Maintenant : la visite d'un PDV créé LE MÊME JOUR par le MÊME merchandiser
-- s'ajoute aussi à sa tournée, faite. Le compteur gagne 1 fait et 1 PDV
-- (20/39 → 22/41). Elle ne compte pas dans les quotas « à trouver » (le
-- quota pushcart ne compte que les pushcarts) : objectifs = cree_ce_jour,
-- sans « compte ». Les jours de visite libre ne changent pas (toute visite
-- s'ajoute déjà) ; un pushcart créé le jour même garde son chemin habituel.
--
-- Rattrapage du 01/11 au 05/11 : les visites de ce type sont ajoutées aux
-- tournées (table de suivi routing_pdv_cree_ce_jour_20261105).
--
-- Base : visite_libre_apres_visite() relevée en production le 05/11
-- (migrations 20261022100000 et 20261022120000).
--
-- Appliquée le 05/11/2026 par le MCP Supabase après une répétition annulée :
-- 23 lignes ajoutées (Gui Stéphane 02/11 +2, 03/11 +8, 04/11 +2 → 22/41 ;
-- Abbe Frederic 02/11 +8 ; Guihi Bernadin 04/11 +2, 05/11 +1). Essai annulé
-- d'une boutique créée puis visitée le jour même : ligne ajoutée, faite.
-- ============================================================================
begin;

create or replace function public.visite_libre_apres_visite()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_date date;
  v_routing record;
  v_type text;
  v_canal text;
  v_trouver boolean;
  v_cree_ce_jour boolean;
  v_debut date;
  v_fin date;
  v_hors_liste boolean;
  v_deja boolean;
  v_hors_quota boolean;
  v_objectifs jsonb;
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
    select canal_atom(p.sous_categorie_pdv),
           coalesce(p.created_by = new.user_id
                    and (p.created_at at time zone 'Africa/Abidjan')::date = v_date, false)
      into v_canal, v_cree_ce_jour
    from pdv p where p.pdv_id = new.pdv_id;
    v_cree_ce_jour := coalesce(v_cree_ce_jour, false);
    -- Un jour ordinaire : les types « à trouver » (pushcarts), et les
    -- boutiques créées le jour même par le merchandiser (05/11/2026).
    v_trouver := v_type = 'a_trouver' and v_canal is not null and (v_routing.objectifs->'quotas') ? v_canal;
    if v_type = 'a_trouver' and not v_trouver and not v_cree_ce_jour then
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

    if v_type = 'a_trouver' and not v_trouver then
      -- Boutique créée sur place un jour ordinaire : elle s'ajoute au compteur
      -- du jour, hors quotas « à trouver ».
      v_objectifs := jsonb_build_object('cree_ce_jour', true, 'canal', v_canal,
                                        'hors_liste', v_hors_liste, 'deja_ce_mois', v_deja);
    else
      -- 3. Quota de son type pas encore atteint.
      v_hors_quota := v_canal is null
        or coalesce((v_routing.objectifs->'quotas'->>v_canal)::int, 0) <= (
          select count(*) from routing_pdv rp
          where rp.routing_id = v_routing.id and rp.objectifs->>'canal' = v_canal
            and coalesce((rp.objectifs->>'compte')::boolean, false));
      v_objectifs := jsonb_build_object(case v_type when 'a_trouver' then 'a_trouver' else 'visite_libre' end, true,
                                        'canal', v_canal,
                                        'compte', not v_deja and not v_hors_quota,
                                        'hors_liste', v_hors_liste, 'deja_ce_mois', v_deja, 'hors_quota', v_hors_quota)
                     || case when v_cree_ce_jour then jsonb_build_object('cree_ce_jour', true) else '{}'::jsonb end;
    end if;

    -- Ordre gardé : en fin de liste, sans réordonner au plus proche voisin
    -- (même verrou que reordonner_tournee_apres_insertion).
    perform set_config('friesland.tournee_ordonnee_' || replace(v_routing.id::text, '-', ''), '1', true);

    insert into routing_pdv (routing_id, pdv_id, position_order, objectifs, status, arrived_at, completed_at,
                             geofence_validated, geolocation_lat, geolocation_lng, precision_gps, visite_id)
    values (
      v_routing.id, new.pdv_id,
      coalesce((select max(rp.position_order) from routing_pdv rp where rp.routing_id = v_routing.id), 0) + 1,
      v_objectifs,
      'completed', new.date_visite, new.date_visite,
      coalesce(new.geofence_validated, false), new.geolocation_lat, new.geolocation_lng, new.precision_gps,
      new.visite_id);

    perform bilan_visite_libre(v_routing.id);
  exception when others then
    raise warning 'visite_libre_apres_visite % : %', new.visite_id, sqlerrm;
  end;
  return null;
end;
$function$;

-- Rattrapage du 01/11 au 05/11 -------------------------------------------------
create table if not exists public.routing_pdv_cree_ce_jour_20261105 (
  routing_pdv_id uuid primary key,
  routing_id uuid not null,
  pdv_id text not null,
  visite_id text,
  ajoute_le timestamptz not null default now()
);
alter table public.routing_pdv_cree_ce_jour_20261105 enable row level security;
comment on table public.routing_pdv_cree_ce_jour_20261105 is
  'Boutiques créées et visitées le même jour, ajoutées aux tournées du 01/11 au 05/11/2026 (migration 20261105160000).';

do $rattrapage$
declare
  v record;
  v_id uuid;
  v_hors_liste boolean;
  v_deja boolean;
begin
  for v in
    select distinct on (r.id, vi.pdv_id)
           r.id as routing_id, vi.id as visite_uuid, vi.pdv_id, vi.user_id, vi.date_visite, vi.visite_id,
           vi.geofence_validated, vi.geolocation_lat, vi.geolocation_lng, vi.precision_gps,
           canal_atom(p.sous_categorie_pdv) as canal, r.date_routing
    from visites vi
    join pdv p on p.pdv_id = vi.pdv_id and p.created_by = vi.user_id
    join routings r on r.user_id = vi.user_id
      and r.date_routing = (vi.date_visite at time zone 'Africa/Abidjan')::date
      and r.status <> 'cancelled'
      and r.objectifs->>'type' = 'a_trouver'
    where vi.visite_id not like 'ATOM-%'
      and (vi.date_visite at time zone 'Africa/Abidjan')::date between '2026-11-01' and '2026-11-05'
      and (p.created_at at time zone 'Africa/Abidjan')::date = (vi.date_visite at time zone 'Africa/Abidjan')::date
      and not exists (select 1 from routing_pdv rp where rp.routing_id = r.id and rp.pdv_id = vi.pdv_id)
    order by r.id, vi.pdv_id, vi.date_visite
  loop
    v_hors_liste := not exists (
      select 1 from pdv_quartier_tournee q
      join pdv p on p.pdv_id = q.pdv_id
      where q.pdv_id = v.pdv_id and q.merchandiser_id = v.user_id
        and exists (select 1 from routing_mensuel rm
                    where rm.merchandiser_id = v.user_id and rm.actif
                      and rm.distributeur is not distinct from p.distributor_name));
    v_deja := exists (
        select 1 from routing_pdv rp join routings rt on rt.id = rp.routing_id
        where rt.user_id = v.user_id
          and rt.date_routing between date_trunc('month', v.date_routing)::date
                                  and (date_trunc('month', v.date_routing) + interval '1 month - 1 day')::date
          and rt.status <> 'cancelled' and rt.id <> v.routing_id and rp.pdv_id = v.pdv_id)
      or exists (
        select 1 from visites x
        where x.user_id = v.user_id and x.pdv_id = v.pdv_id and x.id <> v.visite_uuid
          and x.date_visite >= date_trunc('month', v.date_routing) and x.date_visite < v.date_visite);

    perform set_config('friesland.tournee_ordonnee_' || replace(v.routing_id::text, '-', ''), '1', true);

    insert into routing_pdv (routing_id, pdv_id, position_order, objectifs, status, arrived_at, completed_at,
                             geofence_validated, geolocation_lat, geolocation_lng, precision_gps, visite_id)
    values (
      v.routing_id, v.pdv_id,
      coalesce((select max(rp.position_order) from routing_pdv rp where rp.routing_id = v.routing_id), 0) + 1,
      jsonb_build_object('cree_ce_jour', true, 'canal', v.canal, 'hors_liste', v_hors_liste, 'deja_ce_mois', v_deja),
      'completed', v.date_visite, v.date_visite,
      coalesce(v.geofence_validated, false), v.geolocation_lat, v.geolocation_lng, v.precision_gps,
      v.visite_id)
    returning id into v_id;

    insert into routing_pdv_cree_ce_jour_20261105 (routing_pdv_id, routing_id, pdv_id, visite_id)
    values (v_id, v.routing_id, v.pdv_id, v.visite_id);
  end loop;

  -- Bilans des tournées touchées (nb_visites ne compte que les pushcarts
  -- trouvés : rien ne change pour les quotas).
  perform bilan_visite_libre(t.routing_id)
  from (select distinct routing_id from routing_pdv_cree_ce_jour_20261105) t;
end
$rattrapage$;

commit;
