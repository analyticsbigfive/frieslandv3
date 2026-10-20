-- ============================================================================
-- PDV ATOM, QUARTIERS DES TOURNÉES ET VALIDATION PAR LES MERCHANDISERS (20/10/2026)
--
-- Décisions de Jean Luc du 20/10 (programme Bonnet Rouge, merchandisers Atom) :
--   1. Les PDV de référence sont ceux identifiés par Atom (export « Bonnet
--      Rouge », onglet PDV, GPS_Lat / GPS_Lng). Le DMS est ignoré pour Atom.
--      Liste dédiée : pdv_atom. On ne filtre PAS sur pdv.gps_source : le
--      trigger de visite du 19/10 la passe à « terrain ».
--   2. Quartier d'un PDV = le point de visite du routing le plus proche,
--      parmi ceux de TOUS les merchandisers Atom (un distributeur n'est pas
--      exclusif : Niare sert Yao et Seregone). À égalité (même point), la
--      ligne dont le distributeur est celui du PDV, puis le merchandiser au
--      plus petit identifiant : une boutique n'a qu'un merchandiser.
--   3. Un jour = les PDV du distributeur de la ligne dans le quartier de son
--      point, puis les quotas par type (routing_quota_canal), chaque PDV une
--      fois par mois, un type manquant remplacé par des boutiques.
--   4. Jour trop court : on complète avec le MÊME distributeur, chez le MÊME
--      merchandiser, dans le quartier voisin le plus proche (ex. Abatta :
--      0 boutique Plaisir Bachus → Abatta village à 0,3 km). Jamais un autre
--      distributeur.
--
-- Cette migration ne modifie PAS le moteur des tournées en service
-- (etapes_quota_du_jour) : c'est l'objet de 20261020110000, à appliquer
-- seulement après l'import des PDV Atom et l'accord de Jean Luc.
-- Idempotente.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Liste des PDV Atom
-- ---------------------------------------------------------------------------
create table if not exists public.pdv_atom (
  pdv_id     text primary key references public.pdv(pdv_id) on delete cascade,
  source_id  text,
  ajoute_le  timestamptz not null default now()
);
create index if not exists pdv_atom_source_idx on public.pdv_atom (source_id);
comment on table public.pdv_atom is
  'PDV identifiés par l''agence Atom (export Bonnet Rouge, 20/10/2026) : seuls PDV des tournées Atom. source_id = ID_PDV du fichier.';

-- Les PDV déjà importés d'Atom (visites du 06/10) en font partie.
insert into public.pdv_atom (pdv_id)
select p.pdv_id from public.pdv p
where p.gps_source in ('atom', 'atom-absent') or p.ajoute_par like 'import-atom-%'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. Quartier de chaque PDV Atom
-- ---------------------------------------------------------------------------
create table if not exists public.pdv_quartier_tournee (
  pdv_id          text primary key references public.pdv(pdv_id) on delete cascade,
  merchandiser_id uuid not null references public.profiles(id) on delete cascade,
  point_lat       double precision not null,
  point_lng       double precision not null,
  distance_m      integer not null,
  calcule_le      timestamptz not null default now()
);
create index if not exists pdv_quartier_tournee_merch_idx on public.pdv_quartier_tournee (merchandiser_id, point_lat, point_lng);
comment on table public.pdv_quartier_tournee is
  'Quartier d''un PDV Atom : point de visite du routing le plus proche parmi tous les merchandisers Atom (règle du 20/10/2026).';

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

  insert into pdv_quartier_tournee (pdv_id, merchandiser_id, point_lat, point_lng, distance_m, calcule_le)
  select p.pdv_id, x.merchandiser_id, x.latitude, x.longitude, round(x.d)::int, now()
  from pdv_atom a
  join pdv p on p.pdv_id = a.pdv_id
  cross join lateral (
    select r.merchandiser_id, r.latitude, r.longitude,
           distance_m(p.geolocation_lat, p.geolocation_lng, r.latitude, r.longitude) as d
    from routing_mensuel r
    join profiles m on m.id = r.merchandiser_id and m.employeur = 'atom' and coalesce(m.is_active, true)
    where r.actif and r.latitude is not null and r.longitude is not null
    order by round(distance_m(p.geolocation_lat, p.geolocation_lng, r.latitude, r.longitude)),
             (r.distributeur is distinct from p.distributor_name),
             r.merchandiser_id
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

-- Routing modifié : tous les quartiers bougent.
create or replace function public.quartiers_atom_apres_routing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform recalculer_quartiers_atom(null);
  return null;
end;
$$;
drop trigger if exists trg_quartiers_atom_routing on public.routing_mensuel;
create trigger trg_quartiers_atom_routing
  after insert or update or delete on public.routing_mensuel
  for each statement execute function public.quartiers_atom_apres_routing();

-- Un PDV Atom bouge, change de distributeur, est désactivé : lui seul.
create or replace function public.quartier_atom_apres_pdv()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from pdv_atom a where a.pdv_id = new.pdv_id) then
    perform recalculer_quartiers_atom(array[new.pdv_id]);
  end if;
  return null;
end;
$$;
drop trigger if exists trg_quartier_atom_pdv on public.pdv;
create trigger trg_quartier_atom_pdv
  after update of geolocation_lat, geolocation_lng, distributor_name, is_active on public.pdv
  for each row
  when (old.geolocation_lat is distinct from new.geolocation_lat
     or old.geolocation_lng is distinct from new.geolocation_lng
     or old.distributor_name is distinct from new.distributor_name
     or old.is_active is distinct from new.is_active)
  execute function public.quartier_atom_apres_pdv();

-- Un PDV entre dans la liste Atom.
create or replace function public.quartier_atom_apres_ajout()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform recalculer_quartiers_atom(array[new.pdv_id]);
  return null;
end;
$$;
drop trigger if exists trg_quartier_atom_ajout on public.pdv_atom;
create trigger trg_quartier_atom_ajout
  after insert on public.pdv_atom
  for each row execute function public.quartier_atom_apres_ajout();

-- Un PDV créé dans l'app par un compte Atom entre dans la liste.
create or replace function public.pdv_atom_depuis_creation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null
     and exists (select 1 from profiles m where m.id = new.created_by and m.employeur = 'atom') then
    insert into pdv_atom (pdv_id) values (new.pdv_id) on conflict do nothing;
  end if;
  return null;
end;
$$;
drop trigger if exists trg_pdv_atom_creation on public.pdv;
create trigger trg_pdv_atom_creation
  after insert on public.pdv
  for each row execute function public.pdv_atom_depuis_creation();

insert into public.pdv_atom (pdv_id)
select p.pdv_id from public.pdv p
join public.profiles m on m.id = p.created_by and m.employeur = 'atom'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. PDV possibles pour une ligne du routing, et plan du mois
-- ---------------------------------------------------------------------------
-- Tous les PDV du distributeur de la ligne rangés chez son merchandiser :
-- d'abord ceux du quartier du point de visite, puis ceux des quartiers
-- voisins, du plus proche au plus loin du point (règle du 20/10).
create or replace function public.atom_pdv_possibles(p_ligne uuid)
returns table (pdv_id text, nom_pdv text, canal text, quartier_voisin boolean, distance_point_m integer,
               latitude double precision, longitude double precision, rang integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.pdv_id, p.nom_pdv, canal_atom(p.sous_categorie_pdv),
         not (q.point_lat = l.latitude and q.point_lng = l.longitude),
         round(distance_m(l.latitude, l.longitude, p.geolocation_lat, p.geolocation_lng))::int,
         p.geolocation_lat, p.geolocation_lng,
         row_number() over (
           order by (q.point_lat = l.latitude and q.point_lng = l.longitude) desc,
                    distance_m(l.latitude, l.longitude, p.geolocation_lat, p.geolocation_lng), p.pdv_id
         )::int
  from routing_mensuel l
  join pdv_quartier_tournee q on q.merchandiser_id = l.merchandiser_id
  join pdv p on p.pdv_id = q.pdv_id
  where l.id = p_ligne
    and l.latitude is not null and l.longitude is not null
    and coalesce(p.is_active, true)
    and p.distributor_name is not distinct from l.distributeur
    and canal_atom(p.sous_categorie_pdv) is not null
$$;

-- Plan du mois d'un merchandiser : ses jours dans l'ordre (semaine 1 lundi →
-- semaine 4 samedi), quotas par type, chaque PDV une seule fois, un type
-- manquant remplacé par des boutiques. Sert aux pages de validation ; le
-- moteur des tournées applique la même règle jour par jour.
create or replace function public.plan_mensuel_atom(p_user uuid)
returns table (ligne_id uuid, semaine integer, jour integer, pdv_id text, nom_pdv text, canal text,
               quartier_voisin boolean, distance_point_m integer, latitude double precision, longitude double precision, ordre integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  l record;
  q record;
  v_pris integer;
  v_deficit integer;
begin
  if auth.uid() is not null and not exists (
       select 1 from profiles me where me.id = auth.uid() and me.role in ('admin', 'superviseur'))
     and p_user not in (select merch_ids_agence()) then
    raise exception 'plan_mensuel_atom : accès refusé' using errcode = '42501';
  end if;

  create temp table if not exists _plan_atom (
    ligne_id uuid, semaine integer, jour integer, pdv_id text, nom_pdv text, canal text,
    quartier_voisin boolean, distance_point_m integer, latitude double precision, longitude double precision, ordre integer
  ) on commit drop;
  truncate _plan_atom;

  for l in
    select r.id, r.semaine_du_mois, r.jour_semaine from routing_mensuel r
    where r.merchandiser_id = p_user and r.actif
    order by r.semaine_du_mois, r.jour_semaine
  loop
    create temp table if not exists _possibles (like _plan_atom, rang integer) on commit drop;
    truncate _possibles;
    insert into _possibles
    select l.id, l.semaine_du_mois, l.jour_semaine, c.pdv_id, c.nom_pdv, c.canal, c.quartier_voisin, c.distance_point_m,
           c.latitude, c.longitude, 0, c.rang
    from atom_pdv_possibles(l.id) c
    where not exists (select 1 from _plan_atom x where x.pdv_id = c.pdv_id);

    v_deficit := 0;
    for q in select qc.canal, qc.quota from routing_quota_canal qc where qc.jour_semaine = l.jour_semaine loop
      insert into _plan_atom
      select s.ligne_id, s.semaine, s.jour, s.pdv_id, s.nom_pdv, s.canal, s.quartier_voisin, s.distance_point_m, s.latitude, s.longitude, s.rang
      from _possibles s where s.canal = q.canal order by s.rang limit q.quota;
      get diagnostics v_pris = row_count;
      v_deficit := v_deficit + q.quota - v_pris;
    end loop;
    if v_deficit > 0 then
      insert into _plan_atom
      select s.ligne_id, s.semaine, s.jour, s.pdv_id, s.nom_pdv, s.canal, s.quartier_voisin, s.distance_point_m, s.latitude, s.longitude, s.rang
      from _possibles s
      where s.canal = 'Boutique' and not exists (select 1 from _plan_atom x where x.pdv_id = s.pdv_id)
      order by s.rang limit v_deficit;
    end if;
  end loop;

  return query select * from _plan_atom order by semaine, jour, ordre;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Positions venues du fichier Atom (import), avec historique
-- ---------------------------------------------------------------------------
create or replace function public.appliquer_gps_pdv(p_lignes jsonb, p_motif text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  x record;
  v record;
begin
  for x in select * from jsonb_to_recordset(p_lignes) as t(pdv_id text, lat double precision, lng double precision, source text) loop
    select pdv_id, geolocation_lat, geolocation_lng, gps_source into v from pdv where pdv_id = x.pdv_id;
    continue when not found or x.lat is null or x.lng is null;
    insert into pdv_gps_historique (pdv_id, ancien_lat, ancien_lng, ancienne_source, nouveau_lat, nouveau_lng, ecart_m, visite_id)
    values (v.pdv_id, v.geolocation_lat, v.geolocation_lng, v.gps_source, x.lat, x.lng,
            case when v.geolocation_lat is not null then round(distance_m(v.geolocation_lat, v.geolocation_lng, x.lat, x.lng))::int end,
            left(p_motif, 200));
    update pdv set geolocation_lat = x.lat, geolocation_lng = x.lng, gps_source = coalesce(x.source, 'atom-fichier'), gps_maj_le = now()
    where pdv_id = x.pdv_id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Validation des tournées par les merchandisers
-- ---------------------------------------------------------------------------
create table if not exists public.validation_tournee_campagne (
  id         uuid primary key default gen_random_uuid(),
  mois       date not null unique check (mois = date_trunc('month', mois)::date),
  libelle    text not null,
  statut     text not null default 'ouverte' check (statut in ('ouverte', 'fermee')),
  cree_par   uuid references public.profiles(id) on delete set null,
  cree_le    timestamptz not null default now()
);

create table if not exists public.validation_tournee_merch (
  id                uuid primary key default gen_random_uuid(),
  campagne_id       uuid not null references public.validation_tournee_campagne(id) on delete cascade,
  merchandiser_id   uuid not null references public.profiles(id) on delete cascade,
  code              text not null check (code ~ '^[0-9]{4}$'),
  statut            text not null default 'a_faire' check (statut in ('a_faire', 'en_cours', 'validee')),
  nom_saisi         text,
  remarque          text,
  valide_le         timestamptz,
  derniere_activite timestamptz,
  essais_rates      integer not null default 0,
  bloque_jusqua     timestamptz,
  unique (campagne_id, merchandiser_id)
);

create table if not exists public.validation_tournee_reponse (
  id                  uuid primary key default gen_random_uuid(),
  validation_merch_id uuid not null references public.validation_tournee_merch(id) on delete cascade,
  routing_mensuel_id  uuid not null references public.routing_mensuel(id) on delete cascade,
  decision            text not null check (decision in ('ok', 'modifier', 'retirer')),
  commentaire         text,
  traite              boolean not null default false,
  maj_le              timestamptz not null default now(),
  unique (validation_merch_id, routing_mensuel_id)
);

create table if not exists public.validation_tournee_pdv_retour (
  id                  uuid primary key default gen_random_uuid(),
  validation_merch_id uuid not null references public.validation_tournee_merch(id) on delete cascade,
  pdv_id              text not null references public.pdv(pdv_id) on delete cascade,
  routing_mensuel_id  uuid references public.routing_mensuel(id) on delete set null,
  motif               text not null check (motif in ('pas_ma_tournee', 'position_fausse', 'ferme')),
  commentaire         text,
  traite              boolean not null default false,
  maj_le              timestamptz not null default now(),
  unique (validation_merch_id, pdv_id)
);

-- ---------------------------------------------------------------------------
-- 6. Droits : rien sans connexion (la page publique passe par le serveur).
--    Admin et superviseur : tout ; agence : ses merchandisers.
-- ---------------------------------------------------------------------------
alter table public.pdv_atom enable row level security;
alter table public.pdv_quartier_tournee enable row level security;
alter table public.validation_tournee_campagne enable row level security;
alter table public.validation_tournee_merch enable row level security;
alter table public.validation_tournee_reponse enable row level security;
alter table public.validation_tournee_pdv_retour enable row level security;

create or replace function public.est_admin_ou_superviseur()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur'))
$$;

drop policy if exists pdv_atom_lecture on public.pdv_atom;
create policy pdv_atom_lecture on public.pdv_atom for select to authenticated
  using (public.est_admin_ou_superviseur() or (select public.agence_courante()) = 'atom');

drop policy if exists pdv_quartier_lecture on public.pdv_quartier_tournee;
create policy pdv_quartier_lecture on public.pdv_quartier_tournee for select to authenticated
  using (public.est_admin_ou_superviseur() or merchandiser_id in (select public.merch_ids_agence()));

drop policy if exists vt_campagne_lecture on public.validation_tournee_campagne;
create policy vt_campagne_lecture on public.validation_tournee_campagne for select to authenticated
  using (public.est_admin_ou_superviseur() or (select public.agence_courante()) is not null);
drop policy if exists vt_campagne_ecriture on public.validation_tournee_campagne;
create policy vt_campagne_ecriture on public.validation_tournee_campagne for all to authenticated
  using (public.est_admin_ou_superviseur() or (select public.agence_courante()) is not null)
  with check (public.est_admin_ou_superviseur() or (select public.agence_courante()) is not null);

drop policy if exists vt_merch_acces on public.validation_tournee_merch;
create policy vt_merch_acces on public.validation_tournee_merch for all to authenticated
  using (public.est_admin_ou_superviseur() or merchandiser_id in (select public.merch_ids_agence()))
  with check (public.est_admin_ou_superviseur() or merchandiser_id in (select public.merch_ids_agence()));

drop policy if exists vt_reponse_acces on public.validation_tournee_reponse;
create policy vt_reponse_acces on public.validation_tournee_reponse for all to authenticated
  using (public.est_admin_ou_superviseur() or validation_merch_id in (
    select v.id from public.validation_tournee_merch v where v.merchandiser_id in (select public.merch_ids_agence())))
  with check (public.est_admin_ou_superviseur() or validation_merch_id in (
    select v.id from public.validation_tournee_merch v where v.merchandiser_id in (select public.merch_ids_agence())));

drop policy if exists vt_pdv_retour_acces on public.validation_tournee_pdv_retour;
create policy vt_pdv_retour_acces on public.validation_tournee_pdv_retour for all to authenticated
  using (public.est_admin_ou_superviseur() or validation_merch_id in (
    select v.id from public.validation_tournee_merch v where v.merchandiser_id in (select public.merch_ids_agence())))
  with check (public.est_admin_ou_superviseur() or validation_merch_id in (
    select v.id from public.validation_tournee_merch v where v.merchandiser_id in (select public.merch_ids_agence())));

-- Recalcul et positions : serveur seulement (triggers, import, route admin).
revoke all on function public.recalculer_quartiers_atom(text[]) from public, anon, authenticated;
revoke all on function public.appliquer_gps_pdv(jsonb, text) from public, anon, authenticated;
revoke all on function public.atom_pdv_possibles(uuid) from public, anon, authenticated;
revoke all on function public.plan_mensuel_atom(uuid) from public, anon;
revoke all on function public.est_admin_ou_superviseur() from public, anon;
grant execute on function public.recalculer_quartiers_atom(text[]) to service_role;
grant execute on function public.atom_pdv_possibles(uuid) to service_role;
grant execute on function public.plan_mensuel_atom(uuid) to authenticated;
grant execute on function public.est_admin_ou_superviseur() to authenticated;
grant execute on function public.appliquer_gps_pdv(jsonb, text) to service_role;

commit;

-- Premier calcul des quartiers (hors transaction : quelques secondes).
select public.recalculer_quartiers_atom(null);
