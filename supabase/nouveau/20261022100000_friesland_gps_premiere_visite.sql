-- ============================================================================
-- 22/10/2026 — Le PDV est repéré à la première visite, ensuite il ne bouge plus
--
-- Des merchandisers disent « même devant le PDV on met hors zone ». Depuis le
-- 19/10 (20261019120000), toute visite faite à plus de 300 m déplaçait le PDV
-- jusqu'à la tablette : un agent qui n'était pas sur place pouvait ramener le
-- PDV à lui (37 PDV déplacés ainsi par un même agent en 3 jours).
--
-- Décision de Jean Luc : seule la première visite d'un PDV passe sans contrôle.
--   1. PDV sans repère (gps_source dms, atom, atom-fichier, vide…) : la
--      première visite assez précise (gps_precision_pdv_max_m, 30 m) devient la
--      position du PDV, même tout près de l'ancienne et même s'il n'en avait
--      pas. gps_source = 'terrain', ancienne position dans pdv_gps_historique.
--   2. PDV repéré (gps_source 'terrain' ou 'admin') : une visite ne le déplace
--      plus jamais. L'app (1.0.15) contrôle la distance à ce repère.
--   3. Une position corrigée à la main par un admin ou un superviseur devient
--      le repère (gps_source = 'admin'), sans changer l'écran PDV de l'admin :
--      c'est le recours quand une première visite a été faite au mauvais
--      endroit. Les imports (service, auth.uid() nul) ne sont pas concernés.
-- Gardes inchangées : visites importées (ATOM-…) et visites insérées par le
-- service ignorées, agent connecté = auteur, droit terrain, PDV du périmètre.
-- Idempotent.
-- ============================================================================
begin;

-- 1 et 2. Visite terrain --------------------------------------------------------
create or replace function public.pdv_gps_depuis_visite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pdv record;
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
  if not found then
    return new;
  end if;

  -- Déjà repéré (première visite ou admin) : la visite ne le déplace plus.
  if v_pdv.gps_source in ('terrain', 'admin')
     and v_pdv.geolocation_lat is not null and v_pdv.geolocation_lng is not null then
    return new;
  end if;

  -- Première visite : sa position devient le repère du PDV.
  if v_pdv.geolocation_lat is not null and v_pdv.geolocation_lng is not null then
    v_ecart := distance_m(v_pdv.geolocation_lat, v_pdv.geolocation_lng, new.geolocation_lat, new.geolocation_lng);
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

-- 3. Position corrigée par un admin ou un superviseur ---------------------------
create or replace function public.pdv_gps_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Seulement un admin connecté qui change la position sans préciser la source
  -- (écran PDV de l'admin). Les visites, geolocaliser_pdv et les imports
  -- écrivent eux-mêmes gps_source et ne passent pas ici.
  if auth.uid() is null or not public.est_admin_ou_superviseur()
     or new.gps_source is distinct from old.gps_source
     or new.geolocation_lat is null or new.geolocation_lng is null then
    return new;
  end if;

  insert into pdv_gps_historique (pdv_id, ancien_lat, ancien_lng, ancienne_source, nouveau_lat, nouveau_lng,
                                  precision_m, ecart_m, visite_id, auteur)
  values (old.pdv_id, old.geolocation_lat, old.geolocation_lng, old.gps_source,
          new.geolocation_lat, new.geolocation_lng, null,
          case when old.geolocation_lat is not null and old.geolocation_lng is not null
               then round(distance_m(old.geolocation_lat, old.geolocation_lng, new.geolocation_lat, new.geolocation_lng))::int end,
          null, auth.uid());

  new.gps_source := 'admin';
  new.gps_precision_m := null;
  new.gps_maj_par := auth.uid();
  new.gps_maj_le := now();
  return new;
end;
$$;

drop trigger if exists trg_pdv_gps_admin on public.pdv;
create trigger trg_pdv_gps_admin
  before update of geolocation_lat, geolocation_lng on public.pdv
  for each row
  when (old.geolocation_lat is distinct from new.geolocation_lat
     or old.geolocation_lng is distinct from new.geolocation_lng)
  execute function public.pdv_gps_admin();

revoke all on function public.pdv_gps_admin() from public, anon, authenticated;

comment on table public.pdv_gps_historique is
  'Positions de PDV remplacées : première visite terrain (repère) ou correction par un admin (22/10/2026). Pour revenir en arrière : remettre ancien_lat/ancien_lng.';

commit;
