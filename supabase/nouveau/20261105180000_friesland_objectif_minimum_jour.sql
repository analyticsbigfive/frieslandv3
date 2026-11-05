-- ============================================================================
-- OBJECTIF MINIMUM DE 20 POINTS DE VENTE PAR JOUR (05/11/2026, Jean Luc)
--
-- « Pour atteindre les 20 PDV minimum par jour, inviter les merchandisers à
-- recruter des points de vente. » Jusqu'ici, l'objectif d'un jour Atom
-- (routing_quota_canal) faisait 20 du lundi au jeudi (18 PDV imposés +
-- 2 pushcarts à trouver), 15 le vendredi (14 + 1) et 10 le samedi (9 + 1).
--
-- Maintenant :
--   * paramètre objectif_jour_minimum (20 par défaut, Paramètres) ;
--   * objectifs_a_trouver : un jour où les quotas font moins que ce minimum,
--     la différence devient « Nouveaux PDV » à trouver (vendredi 5, samedi 10),
--     affichée par l'app comme les pushcarts (sans nouvelle version) ;
--   * visite_libre_apres_visite : une boutique créée et visitée le même jour
--     par le merchandiser remplit d'abord ce quota « Nouveaux PDV » (elle
--     compte dans l'objectif du jour sans le faire grossir) ; quota plein ou
--     absent (lundi–jeudi) : comme depuis 20261105160000, elle s'ajoute au
--     compteur (1 de plus en faits et en total). Un pushcart créé sur place
--     remplit d'abord le quota pushcart.
--   * Tournées déjà générées à partir d'aujourd'hui : objectifs du jour mis à
--     jour (vendredis et samedis). Les jours passés ne changent pas.
--
-- Appliquée le 05/11/2026 (18 vendredis et samedis mis à jour), puis CORRIGÉE
-- le même jour par 20261105190000 après réception du tableau du programme :
-- vendredi 15 et samedi 10 ; « Nouveaux PDV » seulement du lundi au jeudi
-- quand la tournée générée est sous 20.
-- ============================================================================
begin;

-- 1. Paramètre ---------------------------------------------------------------
insert into public.parametre_app (cle, portee, valeur, libelle, description, unite, min, max, ordre)
select 'objectif_jour_minimum', 'tous', 20,
       'Objectif minimum par jour',
       'Merchandisers d''agence (routing mensuel) : nombre minimum de points de vente à visiter par jour. Quand les quotas du jour font moins (vendredi, samedi), la différence s''affiche comme « Nouveaux PDV » à trouver : les boutiques créées et visitées sur place la remplissent. 0 : pas de minimum.',
       'PDV', 0, 60, 50
where not exists (select 1 from public.parametre_app where cle = 'objectif_jour_minimum' and portee = 'tous');

-- 2. Objectif du jour --------------------------------------------------------
create or replace function public.objectifs_a_trouver(p_date date)
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
  ), m as (
    select q.pushcart,
           case when q.tous > 0
                then greatest(0, coalesce(parametre_app_valeur('objectif_jour_minimum')::int, 0) - q.tous)
                else 0 end as nouveaux
    from q
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

-- 3. Visite d'une boutique créée sur place -----------------------------------
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
  v_nouveau_libre boolean;
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
    -- 3. Quota de son type pas encore atteint (types « à trouver » et visite libre).
    v_hors_quota := v_canal is null
      or coalesce((v_routing.objectifs->'quotas'->>v_canal)::int, 0) <= (
        select count(*) from routing_pdv rp
        where rp.routing_id = v_routing.id and rp.objectifs->>'canal' = v_canal
          and coalesce((rp.objectifs->>'compte')::boolean, false));
    -- 4. Quota « Nouveaux PDV » du jour (objectif minimum, 05/11) pas encore rempli.
    v_nouveau_libre := v_type = 'a_trouver' and v_cree_ce_jour
      and coalesce((v_routing.objectifs->'quotas'->>'Nouveaux PDV')::int, 0) > (
        select count(*) from routing_pdv rp
        where rp.routing_id = v_routing.id and rp.objectifs->>'canal' = 'Nouveaux PDV'
          and coalesce((rp.objectifs->>'compte')::boolean, false));

    if v_type = 'a_trouver' and v_cree_ce_jour and v_nouveau_libre
       and not (v_trouver and not v_hors_quota) then
      -- Boutique recrutée sur place : remplit l'objectif minimum du jour.
      v_objectifs := jsonb_build_object('a_trouver', true, 'canal', 'Nouveaux PDV', 'type_pdv', v_canal,
                                        'compte', true, 'cree_ce_jour', true,
                                        'hors_liste', v_hors_liste, 'deja_ce_mois', v_deja, 'hors_quota', false);
    elsif v_type = 'a_trouver' and not v_trouver then
      -- Boutique créée sur place, quota « Nouveaux PDV » plein ou absent : elle
      -- s'ajoute au compteur du jour, hors quotas « à trouver ».
      v_objectifs := jsonb_build_object('cree_ce_jour', true, 'canal', v_canal,
                                        'hors_liste', v_hors_liste, 'deja_ce_mois', v_deja);
    else
      v_objectifs := jsonb_build_object(case v_type when 'a_trouver' then 'a_trouver' else 'visite_libre' end, true,
                                        'canal', v_canal,
                                        'compte', not v_deja and not v_hors_quota,
                                        'hors_liste', v_hors_liste, 'deja_ce_mois', v_deja, 'hors_quota', v_hors_quota)
                     || case when v_cree_ce_jour then jsonb_build_object('cree_ce_jour', true) else '{}'::jsonb end;
    end if;

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

-- 4. Tournées déjà générées à partir d'aujourd'hui ----------------------------
create temporary table objectifs_maj on commit drop as
select r.id, objectifs_a_trouver(r.date_routing) as nouveau
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
