-- ============================================================================
-- VALIDATION DES TOURNÉES : CORRECTIFS DU 20/10/2026 (relecture avant envoi)
--   1. pdv.gps_source accepte « atom-fichier » (positions du fichier Atom) :
--      sans cela l'import des PDV Atom échouait en cours de route.
--   2. Recalcul des quartiers plus léger : tri sur une distance plane (exacte
--      à quelques mètres près sur Abidjan), distance exacte seulement pour le
--      point retenu ; le recalcul complet ne part que si une ligne de routing
--      d'un merchandiser Atom change (plus pour Friesland).
--   3. Code de la page publique vérifié en une seule instruction : le blocage
--      après 5 codes faux ne se contourne pas par des requêtes simultanées.
--   4. Mois de validation : ouverts ou modifiés par les admins / superviseurs
--      et l'agence Atom seulement ; supprimés par les admins / superviseurs.
-- Idempotente.
-- ============================================================================
begin;

-- 1. ---------------------------------------------------------------------------
alter table public.pdv drop constraint if exists pdv_gps_source_valide;
alter table public.pdv add constraint pdv_gps_source_valide check (
  gps_source is null or gps_source = any (array['dms', 'dms-absent', 'dms-depot', 'terrain', 'admin', 'atom', 'atom-absent', 'atom-fichier'])
);

-- 2. ---------------------------------------------------------------------------
create or replace function public.recalculer_quartiers_atom(p_pdv_ids text[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if p_pdv_ids is null then
    delete from pdv_quartier_tournee;
  else
    delete from pdv_quartier_tournee where pdv_id = any (p_pdv_ids);
  end if;

  with points as materialized (
    select r.merchandiser_id, r.latitude, r.longitude, r.distributeur
    from routing_mensuel r
    join profiles m on m.id = r.merchandiser_id and m.employeur = 'atom' and coalesce(m.is_active, true)
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
    -- distance plane en mètres (équirectangulaire, latitude d'Abidjan)
    order by round(sqrt(power((pt.latitude - p.geolocation_lat) * 110574, 2)
                      + power((pt.longitude - p.geolocation_lng) * 111320 * 0.9958, 2))),
             (pt.distributeur is distinct from p.distributor_name),
             pt.merchandiser_id
    limit 1
  ) x
  where coalesce(p.is_active, true)
    and p.geolocation_lat is not null and p.geolocation_lng is not null
    and not (p.geolocation_lat = 0 and p.geolocation_lng = 0)
    and (p_pdv_ids is null or p.pdv_id = any (p_pdv_ids));
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.quartiers_atom_apres_routing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from (
      select merchandiser_id from lignes_nouvelles
      union all
      select merchandiser_id from lignes_anciennes
    ) l
    join profiles m on m.id = l.merchandiser_id and m.employeur = 'atom'
  ) then
    perform recalculer_quartiers_atom(null);
  end if;
  return null;
end;
$$;

-- Les tables de transition imposent un déclencheur par type d'opération.
drop trigger if exists trg_quartiers_atom_routing on public.routing_mensuel;
drop trigger if exists trg_quartiers_atom_routing_ins on public.routing_mensuel;
drop trigger if exists trg_quartiers_atom_routing_upd on public.routing_mensuel;
drop trigger if exists trg_quartiers_atom_routing_del on public.routing_mensuel;

create or replace function public.quartiers_atom_apres_routing_ins()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from lignes_nouvelles l join profiles m on m.id = l.merchandiser_id and m.employeur = 'atom') then
    perform recalculer_quartiers_atom(null);
  end if;
  return null;
end;
$$;
create or replace function public.quartiers_atom_apres_routing_del()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from lignes_anciennes l join profiles m on m.id = l.merchandiser_id and m.employeur = 'atom') then
    perform recalculer_quartiers_atom(null);
  end if;
  return null;
end;
$$;

create trigger trg_quartiers_atom_routing_ins
  after insert on public.routing_mensuel
  referencing new table as lignes_nouvelles
  for each statement execute function public.quartiers_atom_apres_routing_ins();
create trigger trg_quartiers_atom_routing_upd
  after update on public.routing_mensuel
  referencing new table as lignes_nouvelles old table as lignes_anciennes
  for each statement execute function public.quartiers_atom_apres_routing();
create trigger trg_quartiers_atom_routing_del
  after delete on public.routing_mensuel
  referencing old table as lignes_anciennes
  for each statement execute function public.quartiers_atom_apres_routing_del();

-- 3. ---------------------------------------------------------------------------
-- Résultat : 'ok', 'faux:<essais restants>', 'bloque:<minutes>', 'inconnu'.
create or replace function public.verifier_code_validation(p_id uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  select m.id, m.code, m.essais_rates, m.bloque_jusqua, c.statut as statut_campagne
  into v
  from validation_tournee_merch m
  join validation_tournee_campagne c on c.id = m.campagne_id
  where m.id = p_id
  for update of m;
  if not found or v.statut_campagne <> 'ouverte' then
    return 'inconnu';
  end if;
  if v.bloque_jusqua is not null and v.bloque_jusqua > now() then
    return 'bloque:' || ceil(extract(epoch from (v.bloque_jusqua - now())) / 60)::int;
  end if;
  if v.code = p_code then
    update validation_tournee_merch set essais_rates = 0, bloque_jusqua = null where id = p_id;
    return 'ok';
  end if;
  if v.essais_rates + 1 >= 5 then
    update validation_tournee_merch set essais_rates = 0, bloque_jusqua = now() + interval '15 minutes' where id = p_id;
    return 'bloque:15';
  end if;
  update validation_tournee_merch set essais_rates = v.essais_rates + 1, bloque_jusqua = null where id = p_id;
  return 'faux:' || (5 - v.essais_rates - 1);
end;
$$;
revoke all on function public.verifier_code_validation(uuid, text) from public, anon, authenticated;
grant execute on function public.verifier_code_validation(uuid, text) to service_role;

-- 4. ---------------------------------------------------------------------------
drop policy if exists vt_campagne_ecriture on public.validation_tournee_campagne;
drop policy if exists vt_campagne_ajout on public.validation_tournee_campagne;
drop policy if exists vt_campagne_modif on public.validation_tournee_campagne;
drop policy if exists vt_campagne_suppression on public.validation_tournee_campagne;
create policy vt_campagne_ajout on public.validation_tournee_campagne for insert to authenticated
  with check (public.est_admin_ou_superviseur() or (select public.agence_courante()) = 'atom');
create policy vt_campagne_modif on public.validation_tournee_campagne for update to authenticated
  using (public.est_admin_ou_superviseur() or (select public.agence_courante()) = 'atom')
  with check (public.est_admin_ou_superviseur() or (select public.agence_courante()) = 'atom');
create policy vt_campagne_suppression on public.validation_tournee_campagne for delete to authenticated
  using (public.est_admin_ou_superviseur());

commit;
