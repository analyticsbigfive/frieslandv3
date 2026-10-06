-- ============================================================================
-- PARAMÈTRES TERRAIN réglables depuis l'admin
--
-- Jusqu'ici figés dans l'APK (nuxt.config.ts + .env au moment du build : un
-- changement demandait une nouvelle version de l'app), dans le SQL (30 m dans
-- geolocaliser_pdv, 420 dans v_programme_atom) ou dans le code (objectif de
-- 10 visites par jour). Désormais une table, éditable dans Référentiels ›
-- Application mobile › Paramètres terrain, lue par l'app 1.0.12 au lancement
-- et au retour au premier plan (cache hors ligne).
--
-- Valeurs initiales = celles des téléphones en 1.0.10 (le .env du build fixait
-- le geofence à 300 m, pas les 200 m de nuxt.config.ts).
--
-- Portée : « tous », ou propre à un employeur (« friesland », « atom ») qui
-- prime alors pour ses utilisateurs. Valeur vide = non définie (ex. objectif
-- Atom : la taille de la tournée du jour).
--
-- Idempotent. Ne change rien pour l'app 1.0.10 (elle ne lit pas la table) sauf
-- geolocaliser_pdv, qui lit sa précision ici (même valeur : 30 m).
-- Ajoute aussi à version_app la dernière version publiée (version_code_dispo).
-- ============================================================================
begin;

create table if not exists public.parametre_app (
  cle         text not null,
  portee      text not null default 'tous' check (portee in ('tous', 'friesland', 'atom')),
  valeur      numeric,
  libelle     text not null,
  description text,
  unite       text,
  min         numeric,
  max         numeric,
  ordre       integer not null default 100,
  updated_at  timestamptz not null default now(),
  primary key (cle, portee),
  constraint parametre_app_bornes check (
    valeur is null or ((min is null or valeur >= min) and (max is null or valeur <= max))
  )
);

comment on table public.parametre_app is
  'Paramètres terrain de l''app (geofence, précision GPS, suivi de tournée, objectifs). Une valeur de portée employeur prime sur « tous ». Lus par l''app au lancement.';

drop trigger if exists trg_parametre_app_updated_at on public.parametre_app;
create trigger trg_parametre_app_updated_at
  before update on public.parametre_app
  for each row execute function update_routing_updated_at();

alter table public.parametre_app enable row level security;
drop policy if exists parametre_app_read on public.parametre_app;
create policy parametre_app_read on public.parametre_app
  for select to authenticated using (true);
drop policy if exists parametre_app_write on public.parametre_app;
create policy parametre_app_write on public.parametre_app
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.is_active, true)))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.is_active, true)));
grant select on public.parametre_app to authenticated;
grant insert, update, delete on public.parametre_app to authenticated;

insert into public.parametre_app (cle, portee, valeur, libelle, description, unite, min, max, ordre) values
  ('geofence_rayon_m', 'tous', 300, 'Rayon de geofence par défaut',
   'Distance maximale entre l''agent et le PDV pour enregistrer une visite ; rayon donné aux PDV créés sur le terrain et aux PDV sans rayon. Un PDV peut avoir son propre rayon (fiche PDV).', 'm', 50, 2000, 10),
  ('gps_precision_min_m', 'tous', 10, 'Précision GPS exigée',
   'Au-delà, la position est jugée trop imprécise pour démarrer une visite (l''agent voit la précision obtenue).', 'm', 5, 200, 20),
  ('gps_precision_pdv_max_m', 'tous', 30, 'Précision pour géolocaliser un PDV',
   'Précision maximale acceptée pour enregistrer depuis le terrain la position d''un PDV qui n''en a pas.', 'm', 5, 200, 30),
  ('gps_precision_tournee_max_m', 'tous', 50, 'Précision des points de trajet',
   'Les points du suivi de tournée moins précis sont ignorés.', 'm', 10, 500, 40),
  ('tracking_intervalle_s', 'tous', 120, 'Intervalle du suivi de tournée',
   'Temps entre deux relevés de position pendant une tournée (autonomie de la batterie contre finesse du trajet). Pris en compte au prochain démarrage de tournée.', 's', 15, 900, 50),
  ('tracking_distance_m', 'tous', 15, 'Distance minimale entre deux points',
   'Un point plus proche du précédent n''est pas enregistré.', 'm', 0, 500, 60),
  ('tracking_envoi_s', 'tous', 300, 'Envoi des points de trajet',
   'Fréquence d''envoi groupé des points au serveur.', 's', 60, 3600, 70),
  ('tracking_lot_max', 'tous', 200, 'Points par envoi',
   'Nombre maximal de points envoyés en une fois.', 'points', 10, 1000, 80),
  ('objectif_visites_jour', 'tous', 10, 'Objectif de visites par jour',
   'Affiché sur l''accueil de l''app. Vide = taille de la tournée du jour.', 'visites', 1, 100, 90),
  ('objectif_visites_jour', 'atom', null, 'Objectif de visites par jour (Atom)',
   'Vide : l''objectif est le nombre de PDV de la tournée du jour (quotas Atom).', 'visites', 1, 100, 91),
  ('atom_objectif_mensuel', 'atom', 420, 'Objectif mensuel Atom',
   'PDV distincts à visiter par merchandiser Atom et par mois (Programme Atom).', 'PDV', 1, 5000, 100)
on conflict (cle, portee) do nothing;

-- Valeur effective d'un paramètre : celle de la portée demandée, sinon « tous ».
create or replace function public.parametre_app_valeur(p_cle text, p_portee text default 'tous')
returns numeric
language sql
stable
as $$
  select pa.valeur
  from public.parametre_app pa
  where pa.cle = p_cle and pa.portee in (coalesce(p_portee, 'tous'), 'tous')
  order by (pa.portee = 'tous')
  limit 1
$$;

grant execute on function public.parametre_app_valeur(text, text) to authenticated, service_role;

-- Paramètres de l'utilisateur connecté (portée de son employeur, sinon « tous »).
create or replace function public.parametres_app()
returns table (cle text, valeur numeric)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (pa.cle) pa.cle, pa.valeur
  from parametre_app pa
  left join profiles p on p.id = auth.uid()
  where pa.portee = 'tous' or pa.portee = coalesce(p.employeur, 'friesland')
  order by pa.cle, (pa.portee = 'tous')
$$;

revoke all on function public.parametres_app() from public, anon;
grant execute on function public.parametres_app() to authenticated;

-- ---------------------------------------------------------------------------
-- geolocaliser_pdv : précision lue dans les paramètres (30 m par défaut).
-- ---------------------------------------------------------------------------
create or replace function public.geolocaliser_pdv(
  p_pdv_id text,
  p_lat double precision,
  p_lng double precision,
  p_precision integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
  v_max numeric := coalesce(parametre_app_valeur('gps_precision_pdv_max_m'), 30);
begin
  if not public.peut_ecrire_terrain() then
    return false;
  end if;
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180
     or (p_lat = 0 and p_lng = 0) then
    return false;
  end if;
  if p_precision is null or p_precision < 0 or p_precision > v_max then
    return false;
  end if;
  if not exists (select 1 from public.pdv_ids_perimetre() x where x = p_pdv_id) then
    return false;
  end if;

  update public.pdv
  set geolocation_lat = p_lat,
      geolocation_lng = p_lng,
      gps_source = 'terrain',
      gps_precision_m = p_precision,
      gps_maj_par = auth.uid(),
      gps_maj_le = now()
  where pdv_id = p_pdv_id
    and (geolocation_lat is null or geolocation_lng is null);

  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

revoke all on function public.geolocaliser_pdv(text, double precision, double precision, integer) from public, anon;
grant execute on function public.geolocaliser_pdv(text, double precision, double precision, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Programme Atom : pour un mois donné, objectif lu dans les paramètres.
-- ---------------------------------------------------------------------------
-- security invoker (défaut) : la RLS de profiles / routings / visites
-- s'applique au lecteur (un merchandiser ne voit que ses lignes).
create or replace function public.programme_atom(p_mois date default current_date)
returns table (
  user_id uuid, nom text, email text, mois date,
  nb_portefeuille bigint, nb_eligibles bigint, nb_planifies bigint,
  nb_visites bigint, nb_perfect_store bigint, objectif_mensuel numeric, reste_a_visiter numeric
)
language sql
stable
set search_path = public
as $$
  with regles as (
    select t.user_id, t.id as template_id
    from routing_templates t
    join profiles p on p.id = t.user_id
    where p.employeur = 'atom' and t.mode = 'quota' and coalesce(t.is_active, true)
  ),
  mois as (
    select date_trunc('month', coalesce(p_mois, current_date))::date as debut,
           (date_trunc('month', coalesce(p_mois, current_date)) + interval '1 month - 1 day')::date as fin
  ),
  objectif as (
    select coalesce(parametre_app_valeur('atom_objectif_mensuel', 'atom'), 420) as valeur
  ),
  portefeuille as (
    select r.user_id, count(distinct tp.pdv_id) as nb_portefeuille,
           count(distinct tp.pdv_id) filter (where canal_atom(p.sous_categorie_pdv) is not null) as nb_eligibles
    from regles r
    join routing_template_pdv tp on tp.template_id = r.template_id
    join pdv p on p.pdv_id = tp.pdv_id
    group by r.user_id
  ),
  planifies as (
    select rt.user_id, count(distinct rp.pdv_id) as nb_planifies
    from routings rt
    join routing_pdv rp on rp.routing_id = rt.id
    cross join mois m
    where rt.date_routing between m.debut and m.fin and rt.status <> 'cancelled'
    group by rt.user_id
  ),
  visitees as (
    select v.user_id,
           count(distinct v.pdv_id) as nb_visites,
           count(distinct v.pdv_id) filter (where rps.niveau is not null and rps.niveau <> 'aucun') as nb_perfect_store
    from visites v
    cross join mois m
    left join resultat_perfect_store rps on rps.visite_id = v.id
    where v.date_visite >= m.debut and v.date_visite < m.fin + 1
    group by v.user_id
  )
  select
    p.id, p.nom, p.email, m.debut,
    coalesce(pf.nb_portefeuille, 0), coalesce(pf.nb_eligibles, 0), coalesce(pl.nb_planifies, 0),
    coalesce(vi.nb_visites, 0), coalesce(vi.nb_perfect_store, 0),
    o.valeur, greatest(o.valeur - coalesce(vi.nb_visites, 0), 0)
  from profiles p
  cross join mois m
  cross join objectif o
  left join portefeuille pf on pf.user_id = p.id
  left join planifies pl on pl.user_id = p.id
  left join visitees vi on vi.user_id = p.id
  where p.employeur = 'atom' and p.role = 'merchandiser' and coalesce(p.is_active, true)
  order by p.nom
$$;

comment on function public.programme_atom(date) is
  'Programme Atom d''un mois : par merchandiser, portefeuille, PDV éligibles, planifiés, visités, en perfect store, objectif (paramètre atom_objectif_mensuel) et reste à visiter.';

grant execute on function public.programme_atom(date) to authenticated;

-- La vue garde ses colonnes (mois en cours), branchée sur la fonction.
drop view if exists public.v_programme_atom;
create view public.v_programme_atom with (security_invoker = true) as
select * from public.programme_atom(current_date);

grant select on public.v_programme_atom to authenticated;

-- ---------------------------------------------------------------------------
-- Version de l'app : dernière version publiée (Référentiels › Publier une
-- version). L'app 1.0.12+ propose la mise à jour sans bloquer tant que la
-- version minimale (version_code_min) n'est pas relevée.
-- ---------------------------------------------------------------------------
alter table public.version_app add column if not exists version_code_dispo integer;
alter table public.version_app add column if not exists version_nom_dispo text;

comment on column public.version_app.version_code_dispo is
  'versionCode de la dernière version publiée (APK direct). Au-dessus de la version installée, l''app propose la mise à jour sans bloquer.';

commit;
