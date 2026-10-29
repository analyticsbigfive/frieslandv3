-- ============================================================================
-- 29/10/2026 — GPS obligatoire pour faire une visite (app 1.0.17)
--
-- En juillet, 407 PDV (397 créés par un même merchandiser) et des centaines
-- de visites ont été enregistrés sans position : la localisation des Galaxy
-- Tab A11 était coupée. Décision de Jean Luc : pas de position, pas de visite.
-- L'app 1.0.17 exige une position assez précise pour « Démarrer », ouvrir et
-- enregistrer une visite, et créer un PDV. Loin du repère du PDV, elle ne
-- bloque plus (« Hors zone ») : elle demande « Êtes-vous bien devant… ? » ;
-- « Oui » enregistre data.gps.confirmation = 'devant' dans la visite.
--
-- Cette migration (ajouts seulement, rien de renommé) :
--   1. gps_source accepte 'creation' (position prise à la création du PDV) et
--      'visite_validee' (visite confirmée « devant ») ; les deux valent repère,
--      comme 'terrain' et 'admin' (sinon la première visite écraserait en
--      silence la position prise à la création). Les pushcarts restent
--      'itinerant'. gps_maj_le / gps_maj_par / gps_precision_m servent de
--      « validé le / par / précision ».
--   2. visites.appareil_modele : modèle de la tablette (SM-X130 = Wi-Fi seul).
--   3. Paramètres terrain : distance_alerte_m (100 m) et
--      gps_deplacement_verif_m (500 m) ; « Précision GPS exigée » et
--      « Précision pour géolocaliser un PDV » passent à 50 m (30 m avant) :
--      sinon les visites entre 30 et 50 m démarreraient sans jamais fixer la
--      position des PDV de juillet. Une valeur déjà plus haute est gardée.
--   4. pdv_gps_depuis_visite : sur confirmation « devant », la position de la
--      visite remplace celle du PDV même repéré (historique, source
--      'visite_validee', seuil = précision exigée de la visite). Déclenché
--      aussi sur UPDATE (visite hors ligne rejouée), une seule fois par visite.
--   5. pdv_gps_admin : ne réécrit plus la source quand le déplacement vient
--      d'une visite ; une position tapée à la main par un agent terrain (app
--      1.0.15/1.0.16) est désormais gardée dans l'historique.
--   6. positions_a_verifier() / traiter_position_a_verifier() : onglet
--      Points de vente › Positions à vérifier (admin et superviseur).
--   7. Création de PDV sans doublon (demande du 29/10) : photo de la
--      devanture obligatoire dans l'app ; pdv_voisins() montre les PDV à
--      moins de doublon_rayon_m (30 m) avant de créer ; toute création par un
--      agent terrain près d'un PDV existant est gardée dans
--      pdv_doublon_possible (onglet Points de vente › Doublons possibles).
--
-- À APPLIQUER AVANT LA DIFFUSION DE L'APK 1.0.17 : l'app envoie
-- appareil_modele et gps_source = 'creation'. Sans risque pour les 1.0.15 et
-- 1.0.16 (elles n'envoient ni l'un ni l'autre). Idempotente.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Sources GPS
-- ---------------------------------------------------------------------------
alter table public.pdv drop constraint if exists pdv_gps_source_valide;
alter table public.pdv add constraint pdv_gps_source_valide check (
  gps_source is null or gps_source = any (array[
    'dms', 'dms-absent', 'dms-depot', 'terrain', 'admin', 'atom', 'atom-absent', 'atom-fichier', 'itinerant',
    'creation', 'visite_validee']));

-- Un pushcart ne garde jamais de repère, quelle que soit la source écrite.
create or replace function public.pdv_pushcart_itinerant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.gps_source in ('terrain', 'admin', 'creation', 'visite_validee') and canal_atom(new.sous_categorie_pdv) = 'Pushcart' then
    new.gps_source := 'itinerant';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Modèle de la tablette
-- ---------------------------------------------------------------------------
alter table public.visites add column if not exists appareil_modele text;
alter table public.visites drop constraint if exists visites_appareil_modele_longueur;
alter table public.visites add constraint visites_appareil_modele_longueur
  check (appareil_modele is null or char_length(appareil_modele) <= 120);
comment on column public.visites.appareil_modele is
  'Modèle de l''appareil (Device.getInfo().model), app 1.0.17. Galaxy Tab A11 : SM-X130 = Wi-Fi seul, sans puce GPS ; SM-X135 / SM-X133 = avec GPS.';

-- ---------------------------------------------------------------------------
-- 3. Paramètres terrain
-- ---------------------------------------------------------------------------
insert into public.parametre_app (cle, portee, valeur, libelle, description, unite, min, max, ordre) values
  ('distance_alerte_m', 'tous', 100, 'Distance d''alerte',
   'Au-delà de cette distance entre la tablette et la position enregistrée du point de vente, l''agent doit confirmer qu''il est devant (« Êtes-vous bien devant… ? »). « Oui » : sa position devient celle du point de vente. La distance ne bloque jamais la visite.', 'm', 20, 2000, 25),
  ('gps_deplacement_verif_m', 'tous', 500, 'Déplacement à vérifier',
   'Un point de vente déplacé de plus que cette distance par une visite apparaît dans Points de vente › Positions à vérifier.', 'm', 50, 20000, 35)
on conflict (cle, portee) do nothing;

update public.parametre_app
set valeur = 50,
    description = 'La visite (« Démarrer », formulaire de visite, création de PDV) attend une position au moins aussi précise, 20 secondes au plus ; sinon l''aide GPS de la tablette s''affiche. Pas de position, pas de visite.'
where cle = 'gps_precision_min_m' and portee = 'tous' and (valeur is null or valeur < 50);

update public.parametre_app
set valeur = 50
where cle = 'gps_precision_pdv_max_m' and portee = 'tous' and (valeur is null or valeur < 50);

-- ---------------------------------------------------------------------------
-- 4. Position du PDV depuis la visite
-- ---------------------------------------------------------------------------
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
  v_devant boolean := coalesce(new.data->'gps'->>'confirmation', '') = 'devant';
begin
  if new.visite_id like 'ATOM-%'
     or new.geolocation_lat is null or new.geolocation_lng is null
     or (new.geolocation_lat = 0 and new.geolocation_lng = 0)
     or new.precision_gps is null or new.precision_gps <= 0 then
    return new;
  end if;

  -- Visite rejouée (file hors ligne) : seulement si la position ou la
  -- confirmation change, et une seule fois par visite.
  if tg_op = 'UPDATE' then
    if new.geolocation_lat is not distinct from old.geolocation_lat
       and new.geolocation_lng is not distinct from old.geolocation_lng
       and new.precision_gps is not distinct from old.precision_gps
       and (new.data->'gps') is not distinct from (old.data->'gps') then
      return new;
    end if;
    if exists (select 1 from pdv_gps_historique h where h.visite_id = new.visite_id) then
      return new;
    end if;
  end if;

  -- Même garde que geolocaliser_pdv : la visite est celle de l'agent connecté,
  -- qui a le droit d'écrire sur le terrain, et le PDV est dans son périmètre.
  if auth.uid() is null or new.user_id is distinct from auth.uid()
     or not public.peut_ecrire_terrain()
     or not exists (select 1 from public.pdv_ids_perimetre() x where x = new.pdv_id) then
    return new;
  end if;

  -- Première visite : précision exigée pour géolocaliser un PDV. Confirmation
  -- « devant » : celle de la visite (la tablette l'a déjà attendue).
  v_prec_max := case when v_devant
    then coalesce(parametre_app_valeur('gps_precision_min_m'), 50)
    else coalesce(parametre_app_valeur('gps_precision_pdv_max_m'), 50) end;
  if new.precision_gps > v_prec_max then
    return new;
  end if;

  select pdv_id, geolocation_lat, geolocation_lng, gps_source
  into v_pdv
  from pdv where pdv_id = new.pdv_id;
  if not found then
    return new;
  end if;

  -- Déjà repéré : seule une confirmation « devant » le déplace.
  if v_pdv.gps_source in ('terrain', 'admin', 'creation', 'visite_validee')
     and v_pdv.geolocation_lat is not null and v_pdv.geolocation_lng is not null
     and not v_devant then
    return new;
  end if;

  if v_pdv.geolocation_lat is not null and v_pdv.geolocation_lng is not null then
    v_ecart := distance_m(v_pdv.geolocation_lat, v_pdv.geolocation_lng, new.geolocation_lat, new.geolocation_lng);
  end if;

  insert into pdv_gps_historique (pdv_id, ancien_lat, ancien_lng, ancienne_source, nouveau_lat, nouveau_lng,
                                  precision_m, ecart_m, visite_id, auteur)
  values (v_pdv.pdv_id, v_pdv.geolocation_lat, v_pdv.geolocation_lng, v_pdv.gps_source,
          new.geolocation_lat, new.geolocation_lng, new.precision_gps, round(v_ecart)::int, new.visite_id, new.user_id);

  -- L'historique est écrit : pdv_gps_admin ne doit ni le doubler ni passer la
  -- source à 'admin' (superviseur qui confirme deux fois « devant »).
  perform set_config('friesland.gps_historique_ecrit', '1', true);
  update pdv
  set geolocation_lat = new.geolocation_lat,
      geolocation_lng = new.geolocation_lng,
      gps_source = case when v_devant then 'visite_validee' else 'terrain' end,
      gps_precision_m = round(new.precision_gps)::int,
      gps_maj_par = new.user_id,
      gps_maj_le = now()
  where pdv_id = v_pdv.pdv_id;
  perform set_config('friesland.gps_historique_ecrit', '', true);

  return new;
end;
$$;

drop trigger if exists trg_pdv_gps_depuis_visite on public.visites;
create trigger trg_pdv_gps_depuis_visite
  after insert or update of geolocation_lat, geolocation_lng, precision_gps, data on public.visites
  for each row execute function public.pdv_gps_depuis_visite();

-- ---------------------------------------------------------------------------
-- 5. Position changée hors visite
-- ---------------------------------------------------------------------------
create or replace function public.pdv_gps_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean;
begin
  -- Déplacement écrit par pdv_gps_depuis_visite ou traiter_position_a_verifier
  -- (historique déjà fait) ; imports (service) ; source changée par la
  -- requête (geolocaliser_pdv, imports) : rien à faire ici.
  if coalesce(current_setting('friesland.gps_historique_ecrit', true), '') = '1'
     or auth.uid() is null
     or new.gps_source is distinct from old.gps_source
     or new.geolocation_lat is null or new.geolocation_lng is null then
    return new;
  end if;

  v_admin := public.est_admin_ou_superviseur();

  insert into pdv_gps_historique (pdv_id, ancien_lat, ancien_lng, ancienne_source, nouveau_lat, nouveau_lng,
                                  precision_m, ecart_m, visite_id, auteur)
  values (old.pdv_id, old.geolocation_lat, old.geolocation_lng, old.gps_source,
          new.geolocation_lat, new.geolocation_lng, null,
          case when old.geolocation_lat is not null and old.geolocation_lng is not null
               then round(distance_m(old.geolocation_lat, old.geolocation_lng, new.geolocation_lat, new.geolocation_lng))::int end,
          null, auth.uid());

  -- Admin ou superviseur (écran PDV de l'admin) : la position devient le
  -- repère. Agent terrain (saisie à la main, app 1.0.15/1.0.16) : seulement
  -- gardée dans l'historique, visible dans « Positions à vérifier ».
  if v_admin then
    new.gps_source := 'admin';
    new.gps_precision_m := null;
    new.gps_maj_par := auth.uid();
    new.gps_maj_le := now();
  end if;
  return new;
end;
$$;

revoke all on function public.pdv_gps_admin() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Positions à vérifier
-- ---------------------------------------------------------------------------
alter table public.pdv_gps_historique add column if not exists verifie_le timestamptz;
alter table public.pdv_gps_historique add column if not exists verifie_par uuid references public.profiles(id) on delete set null;
alter table public.pdv_gps_historique add column if not exists verifie_action text;
alter table public.pdv_gps_historique drop constraint if exists pdv_gps_historique_verifie_action;
alter table public.pdv_gps_historique add constraint pdv_gps_historique_verifie_action
  check (verifie_action is null or verifie_action in ('gardee', 'remise'));

-- Déplacements faits sur le terrain (visite, ou saisie à la main par un agent)
-- au-delà de « Déplacement à vérifier ». Les imports de fichiers (motif rangé
-- dans visite_id) et les corrections de l'admin n'y sont pas.
create or replace function public.positions_a_verifier(p_tout boolean default false, p_jours integer default 90)
returns table (
  id bigint,
  pdv_id text,
  nom_pdv text,
  zone text,
  quartier text,
  ancien_lat double precision,
  ancien_lng double precision,
  ancienne_source text,
  nouveau_lat double precision,
  nouveau_lng double precision,
  ecart_m integer,
  precision_m numeric,
  visite_id text,
  date_visite timestamptz,
  confirmation text,
  appareil_modele text,
  auteur_nom text,
  cree_le timestamptz,
  source_actuelle text,
  deplace_depuis boolean,
  verifie_le timestamptz,
  verifie_action text,
  verifie_par_nom text
)
language sql
stable
security definer
set search_path = public
as $$
  select h.id, h.pdv_id, p.nom_pdv, p.zone, p.quartier,
         h.ancien_lat, h.ancien_lng, h.ancienne_source, h.nouveau_lat, h.nouveau_lng,
         h.ecart_m, h.precision_m, h.visite_id, v.date_visite, v.data->'gps'->>'confirmation', v.appareil_modele,
         a.nom, h.cree_le, p.gps_source,
         (p.geolocation_lat is distinct from h.nouveau_lat or p.geolocation_lng is distinct from h.nouveau_lng),
         h.verifie_le, h.verifie_action, vp.nom
  from pdv_gps_historique h
  join pdv p on p.pdv_id = h.pdv_id
  left join visites v on v.visite_id = h.visite_id
  left join profiles a on a.id = h.auteur
  left join profiles vp on vp.id = h.verifie_par
  where public.est_admin_ou_superviseur()
    and h.ecart_m > coalesce(parametre_app_valeur('gps_deplacement_verif_m'), 500)
    and h.cree_le >= now() - make_interval(days => greatest(coalesce(p_jours, 90), 1))
    and (v.visite_id is not null
         or (h.visite_id is null and h.auteur is not null
             and not exists (select 1 from profiles x where x.id = h.auteur and x.role in ('admin', 'superviseur'))))
    and (p_tout or h.verifie_le is null)
  order by h.cree_le desc
  limit 1000
$$;

-- « Garder » : la position est juste. « Remettre » : retour à l'ancienne
-- position (et à son ancienne source), si le PDV n'a pas bougé depuis.
create or replace function public.traiter_position_a_verifier(p_id bigint, p_remettre boolean default false)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  h record;
  v_pdv record;
begin
  if not public.est_admin_ou_superviseur() then
    raise exception 'Réservé à l''administrateur et au superviseur';
  end if;

  select * into h from pdv_gps_historique where pdv_gps_historique.id = p_id for update;
  if not found then
    return false;
  end if;

  if p_remettre then
    if h.ancien_lat is null or h.ancien_lng is null then
      raise exception 'Pas d''ancienne position à remettre';
    end if;
    select pdv_id, geolocation_lat, geolocation_lng, gps_source into v_pdv
    from pdv where pdv.pdv_id = h.pdv_id for update;
    if v_pdv.geolocation_lat is distinct from h.nouveau_lat or v_pdv.geolocation_lng is distinct from h.nouveau_lng then
      raise exception 'Le point de vente a encore bougé depuis : corrigez sa position dans sa fiche';
    end if;
    insert into pdv_gps_historique (pdv_id, ancien_lat, ancien_lng, ancienne_source, nouveau_lat, nouveau_lng,
                                    precision_m, ecart_m, visite_id, auteur, verifie_le, verifie_par, verifie_action)
    values (h.pdv_id, h.nouveau_lat, h.nouveau_lng, v_pdv.gps_source, h.ancien_lat, h.ancien_lng,
            null, h.ecart_m, null, auth.uid(), now(), auth.uid(), 'remise');
    perform set_config('friesland.gps_historique_ecrit', '1', true);
    update pdv
    set geolocation_lat = h.ancien_lat,
        geolocation_lng = h.ancien_lng,
        gps_source = h.ancienne_source,
        gps_maj_par = auth.uid(),
        gps_maj_le = now()
    where pdv.pdv_id = h.pdv_id;
    perform set_config('friesland.gps_historique_ecrit', '', true);
  end if;

  update pdv_gps_historique
  set verifie_le = now(), verifie_par = auth.uid(), verifie_action = case when p_remettre then 'remise' else 'gardee' end
  where pdv_gps_historique.id = p_id;
  return true;
end;
$$;

revoke all on function public.positions_a_verifier(boolean, integer) from public, anon;
revoke all on function public.traiter_position_a_verifier(bigint, boolean) from public, anon;
grant execute on function public.positions_a_verifier(boolean, integer) to authenticated;
grant execute on function public.traiter_position_a_verifier(bigint, boolean) to authenticated;

comment on table public.pdv_gps_historique is
  'Positions de PDV remplacées : première visite terrain, visite confirmée « devant » (1.0.17), saisie terrain, correction admin. verifie_* : traité dans Points de vente › Positions à vérifier. Pour revenir en arrière : remettre ancien_lat/ancien_lng.';

-- ---------------------------------------------------------------------------
-- 7. Doublons à la création d'un PDV
-- ---------------------------------------------------------------------------
insert into public.parametre_app (cle, portee, valeur, libelle, description, unite, min, max, ordre) values
  ('doublon_rayon_m', 'tous', 30, 'Rayon des doublons',
   'À la création d''un point de vente, l''app montre ceux déjà enregistrés dans ce rayon, avec leur photo de devanture : l''agent choisit « C''est ce PDV » ou « C''est un nouveau PDV ». Les créations faites près d''un PDV existant vont dans Points de vente › Doublons possibles.', 'm', 5, 200, 45),
  ('doublon_nom_rayon_m', 'tous', 15, 'Rayon des doublons de nom',
   'Dans ce rayon, un point de vente au nom presque identique demande une confirmation explicite avant d''en créer un nouveau.', 'm', 5, 100, 46)
on conflict (cle, portee) do nothing;

-- Nom comparable (même règle que utils/doublonPdv.ts) : sans accents, casse,
-- ponctuation ni mots génériques (« Boutique chez Awa » = « Chez Awa »).
create or replace function public.nom_pdv_comparable(p text)
returns text
language sql
immutable
set search_path = public
as $$
  with base as (
    select trim(regexp_replace(lower(unaccent_safe(coalesce(p, ''))), '[^a-z0-9]+', ' ', 'g')) as n
  ), utile as (
    select n, trim(regexp_replace(regexp_replace(n,
      '\m(boutique|btq|superette|supermarche|kiosque|kiosk|magasin|alimentation|alim|ets|etablissement|etablissements|commerce|cave|depot|pushcart|tabletop|table|top|chez|le|la|les|de|du|des|et|l|d)\M', ' ', 'g'),
      ' +', ' ', 'g')) as u
    from base
  )
  select case when u = '' then n else u end from utile
$$;

-- PDV actifs autour d'une position, pour le contrôle avant création. Tous les
-- PDV, pas seulement ceux du périmètre : un doublon peut être chez un
-- collègue. Cloisonnement : un PDV hors du périmètre de l'agent ne montre que
-- son existence (ni identifiant, ni nom, ni quartier, ni photo, ni distance),
-- et le rayon est toujours « Rayon des doublons » (p_rayon est ignoré, gardé
-- pour la signature) : on ne peut pas situer un PDV d'un autre secteur mieux
-- qu'à ce rayon près.
create or replace function public.pdv_voisins(p_lat double precision, p_lng double precision, p_rayon integer default null)
returns table (pdv_id text, nom_pdv text, quartier text, image_url text, distance_m integer, dans_perimetre boolean)
language sql
stable
security definer
set search_path = public
as $$
  with param as (
    select least(greatest(coalesce(parametre_app_valeur('doublon_rayon_m'), 30), 5), 200)::double precision as max_m
  ), r as (
    select param.max_m as m from param
  ), proches as (
    select p.pdv_id, p.nom_pdv, p.quartier, p.image_url, p.created_by,
           distance_m(p_lat, p_lng, p.geolocation_lat, p.geolocation_lng) as d, r.m
    from pdv p, r
    where public.peut_creer_pdv()
      and p_lat between -90 and 90 and p_lng between -180 and 180
      and p.is_active is not false
      and p.geolocation_lat between p_lat - r.m / 111000.0 and p_lat + r.m / 111000.0
      and p.geolocation_lng between p_lng - r.m / (111000.0 * greatest(cos(radians(p_lat)), 0.01))
                                and p_lng + r.m / (111000.0 * greatest(cos(radians(p_lat)), 0.01))
  ), vus as (
    select x.*, (x.created_by = auth.uid() or x.pdv_id in (select y from public.pdv_ids_perimetre() y)) as dedans
    from proches x
    where x.d <= x.m
  )
  select case when v.dedans then v.pdv_id end,
         case when v.dedans then v.nom_pdv end,
         case when v.dedans then v.quartier end,
         case when v.dedans then v.image_url end,
         case when v.dedans then round(v.d)::int end,
         v.dedans
  from vus v
  order by v.dedans desc, case when v.dedans then v.d end
  limit 20
$$;

create table if not exists public.pdv_doublon_possible (
  id bigserial primary key,
  pdv_id text not null references public.pdv(pdv_id) on delete cascade,
  voisin_pdv_id text not null references public.pdv(pdv_id) on delete cascade,
  distance_m integer,
  similarite_nom numeric,
  cree_par uuid,
  cree_le timestamptz not null default now(),
  verifie_le timestamptz,
  verifie_par uuid references public.profiles(id) on delete set null,
  verifie_action text check (verifie_action is null or verifie_action in ('differents', 'doublon')),
  unique (pdv_id, voisin_pdv_id)
);
create index if not exists idx_pdv_doublon_possible_a_verifier on public.pdv_doublon_possible (cree_le desc) where verifie_le is null;
alter table public.pdv_doublon_possible enable row level security;
drop policy if exists pdv_doublon_possible_lecture_admin on public.pdv_doublon_possible;
create policy pdv_doublon_possible_lecture_admin on public.pdv_doublon_possible
  for select using (public.est_admin_ou_superviseur());
comment on table public.pdv_doublon_possible is
  'PDV créé par un agent terrain à moins de doublon_rayon_m d''un PDV existant (1.0.17) : l''agent a répondu « C''est un nouveau PDV », ou utilise une ancienne version de l''app. Traité dans Points de vente › Doublons possibles.';

-- Toute création par un agent terrain (merchandiser, commercial), quelle que
-- soit la version de l'app, hors ligne comprise (premier envoi = INSERT).
create or replace function public.pdv_doublon_a_la_creation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rayon double precision;
begin
  if new.geolocation_lat is null or new.geolocation_lng is null or auth.uid() is null
     or not exists (select 1 from profiles pr where pr.id = auth.uid() and pr.role in ('merchandiser', 'commercial')) then
    return null;
  end if;
  -- Une erreur ici ne doit jamais empêcher la création du PDV.
  begin
    v_rayon := coalesce(parametre_app_valeur('doublon_rayon_m'), 30);
    insert into pdv_doublon_possible (pdv_id, voisin_pdv_id, distance_m, similarite_nom, cree_par)
    select new.pdv_id, p.pdv_id,
           round(distance_m(new.geolocation_lat, new.geolocation_lng, p.geolocation_lat, p.geolocation_lng))::int,
           round(similarity(nom_pdv_comparable(new.nom_pdv), nom_pdv_comparable(p.nom_pdv))::numeric, 2),
           auth.uid()
    from pdv p
    where p.pdv_id <> new.pdv_id
      and p.is_active is not false
      and p.geolocation_lat between new.geolocation_lat - v_rayon / 111000.0 and new.geolocation_lat + v_rayon / 111000.0
      and p.geolocation_lng between new.geolocation_lng - v_rayon / (111000.0 * greatest(cos(radians(new.geolocation_lat)), 0.01))
                                and new.geolocation_lng + v_rayon / (111000.0 * greatest(cos(radians(new.geolocation_lat)), 0.01))
      and distance_m(new.geolocation_lat, new.geolocation_lng, p.geolocation_lat, p.geolocation_lng) <= v_rayon
    on conflict (pdv_id, voisin_pdv_id) do nothing;
  exception when others then
    raise warning 'pdv_doublon_a_la_creation % : %', new.pdv_id, sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists trg_pdv_doublon_creation on public.pdv;
create trigger trg_pdv_doublon_creation
  after insert on public.pdv
  for each row execute function public.pdv_doublon_a_la_creation();
revoke all on function public.pdv_doublon_a_la_creation() from public, anon, authenticated;

create or replace function public.doublons_possibles(p_tout boolean default false, p_jours integer default 90)
returns table (
  id bigint,
  pdv_id text,
  nom_pdv text,
  image_url text,
  zone text,
  quartier text,
  pdv_actif boolean,
  cree_le timestamptz,
  auteur_nom text,
  voisin_pdv_id text,
  voisin_nom text,
  voisin_image_url text,
  voisin_actif boolean,
  distance_m integer,
  similarite_nom numeric,
  verifie_le timestamptz,
  verifie_action text,
  verifie_par_nom text
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.pdv_id, n.nom_pdv, n.image_url, n.zone, n.quartier, n.is_active is not false,
         d.cree_le, a.nom, d.voisin_pdv_id, v.nom_pdv, v.image_url, v.is_active is not false,
         d.distance_m, d.similarite_nom, d.verifie_le, d.verifie_action, vp.nom
  from pdv_doublon_possible d
  join pdv n on n.pdv_id = d.pdv_id
  join pdv v on v.pdv_id = d.voisin_pdv_id
  left join profiles a on a.id = d.cree_par
  left join profiles vp on vp.id = d.verifie_par
  where public.est_admin_ou_superviseur()
    and d.cree_le >= now() - make_interval(days => greatest(coalesce(p_jours, 90), 1))
    and (p_tout or d.verifie_le is null)
  order by d.cree_le desc, d.similarite_nom desc nulls last
  limit 1000
$$;

-- « Deux PDV différents » : rien ne change. « Doublon » : le PDV créé est
-- désactivé (ses visites restent), le PDV existant reste la référence.
create or replace function public.traiter_doublon_possible(p_id bigint, p_doublon boolean default false)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
begin
  if not public.est_admin_ou_superviseur() then
    raise exception 'Réservé à l''administrateur et au superviseur';
  end if;
  select * into d from pdv_doublon_possible where pdv_doublon_possible.id = p_id for update;
  if not found then
    return false;
  end if;
  if p_doublon then
    update pdv set is_active = false where pdv.pdv_id = d.pdv_id;
  end if;
  update pdv_doublon_possible
  set verifie_le = now(), verifie_par = auth.uid(), verifie_action = case when p_doublon then 'doublon' else 'differents' end
  where pdv_doublon_possible.pdv_id = d.pdv_id
    and (pdv_doublon_possible.id = p_id or p_doublon);
  return true;
end;
$$;

revoke all on function public.pdv_voisins(double precision, double precision, integer) from public, anon;
revoke all on function public.doublons_possibles(boolean, integer) from public, anon;
revoke all on function public.traiter_doublon_possible(bigint, boolean) from public, anon;
grant execute on function public.pdv_voisins(double precision, double precision, integer) to authenticated;
grant execute on function public.doublons_possibles(boolean, integer) to authenticated;
grant execute on function public.traiter_doublon_possible(bigint, boolean) to authenticated;

commit;
