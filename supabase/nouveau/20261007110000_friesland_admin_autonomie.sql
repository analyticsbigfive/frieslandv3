-- ============================================================================
-- ADMIN AUTONOME : réglages jusqu'ici réservés à l'éditeur SQL
--
-- Objectif client : toute donnée de l'application se gère depuis l'admin.
-- Cette migration ajoute les tables et fonctions derrière les nouveaux écrans :
--   1. v_quartiers_pdv : couples zone / quartier des PDV (choix des quartiers
--      d'une sous-zone SSF, Référentiels › Distribution › SSF ↔ Quartiers) ;
--   2. canal_atom_sous_categorie : canal de la grille Atom par sous-catégorie
--      de PDV, éditable (Référentiels › Application mobile › Canal Atom) ;
--      canal_atom() lit la table puis retombe sur la règle d'origine ;
--   3. alias_import : orthographes des fichiers d'import (merchandisers,
--      distributeurs, SSF) → référentiel (Admin › Imports terrain) ;
--   4. renommer_distributeur : renomme un distributeur et ses PDV / règles ;
--   5. recalculer_tournees_a_venir : régénère les tournées futures intactes
--      d'un merchandiser après un changement de règles, de quotas ou de
--      sous-zones (l'écran Maintenance appelle la fonction agent par agent :
--      chaque appel reste sous la limite de 8 s des requêtes de l'admin) ;
--   6. etat_taches_planifiees / modifier_horaire_tache / programmer_
--      rafraichissement_stats : suivi des tâches pg_cron (pré-génération des
--      tournées, statistiques) et rafraîchissement immédiat des statistiques.
--
-- Idempotent. Fonctions d'administration en security definer, gardées admin
-- (et superviseur pour les tournées).
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Couples zone / quartier présents dans les PDV
-- ---------------------------------------------------------------------------
drop view if exists public.v_quartiers_pdv;
create view public.v_quartiers_pdv with (security_invoker = true) as
select p.zone, p.quartier, count(*)::int as nb_pdv
from public.pdv p
where coalesce(p.is_active, true) and p.zone is not null and p.quartier is not null
group by p.zone, p.quartier;

comment on view public.v_quartiers_pdv is
  'Zones et quartiers tels qu''écrits dans les PDV actifs (libellés exacts utilisés par les sous-zones SSF), avec leur nombre de PDV.';

grant select on public.v_quartiers_pdv to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Canal Atom par sous-catégorie
-- ---------------------------------------------------------------------------
create table if not exists public.canal_atom_sous_categorie (
  sous_categorie text primary key,
  -- NULL = hors quota (grossiste, supermarché, pharmacie…).
  canal          text check (canal is null or canal in ('Superette', 'Boutique', 'Aboki & Kiosque', 'Pushcart', 'Porridge')),
  updated_at     timestamptz not null default now()
);

comment on table public.canal_atom_sous_categorie is
  'Canal de la grille de quotas Atom pour une sous-catégorie de PDV (pdv.sous_categorie_pdv). NULL = hors quota. Une sous-catégorie absente suit la règle par défaut de canal_atom().';

alter table public.canal_atom_sous_categorie enable row level security;
drop policy if exists canal_atom_sous_categorie_read on public.canal_atom_sous_categorie;
create policy canal_atom_sous_categorie_read on public.canal_atom_sous_categorie
  for select to authenticated using (true);
drop policy if exists canal_atom_sous_categorie_write on public.canal_atom_sous_categorie;
create policy canal_atom_sous_categorie_write on public.canal_atom_sous_categorie
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')));
grant select on public.canal_atom_sous_categorie to authenticated;
grant insert, update, delete on public.canal_atom_sous_categorie to authenticated;

-- Règle d'origine (20261006101000), conservée comme valeur par défaut.
create or replace function public.canal_atom_defaut(p_sous_categorie text)
returns text
language sql
immutable
as $$
  select case
    when p_sous_categorie is null then null
    when upper(p_sous_categorie) ~ 'PORRIDGE' then 'Porridge'
    when upper(p_sous_categorie) ~ 'PUSHCAR' then 'Pushcart'
    when upper(p_sous_categorie) ~ 'ABOKI|KIOS|TABLE TOP|TABLIER' then 'Aboki & Kiosque'
    when upper(p_sous_categorie) ~ 'SUPERETTE|MINIMARKET' then 'Superette'
    when upper(p_sous_categorie) ~ 'BOUTIQUE' then 'Boutique'
    else null
  end
$$;

-- Sous-catégories présentes aujourd'hui, avec leur canal par défaut : l'écran
-- les liste toutes et l'admin corrige au besoin.
insert into public.canal_atom_sous_categorie (sous_categorie, canal)
select distinct p.sous_categorie_pdv, public.canal_atom_defaut(p.sous_categorie_pdv)
from public.pdv p
where p.sous_categorie_pdv is not null and btrim(p.sous_categorie_pdv) <> ''
on conflict (sous_categorie) do nothing;

-- La table prime ; sinon la règle par défaut. STABLE (lit une table) : aucun
-- index ne repose sur canal_atom. Noms qualifiés et pas de SET : la fonction
-- reste intégrable dans les requêtes qui l'appellent ligne à ligne.
create or replace function public.canal_atom(p_sous_categorie text)
returns text
language sql
stable
as $$
  select case
    when exists (select 1 from public.canal_atom_sous_categorie c where c.sous_categorie = p_sous_categorie)
      then (select c.canal from public.canal_atom_sous_categorie c where c.sous_categorie = p_sous_categorie)
    else public.canal_atom_defaut(p_sous_categorie)
  end
$$;

comment on function public.canal_atom(text) is
  'Canal de la grille de quotas Atom d''une sous-catégorie PDV : réglage de canal_atom_sous_categorie (Référentiels › Application mobile › Canal Atom), sinon règle par défaut. NULL = hors quota.';

grant execute on function public.canal_atom(text) to authenticated, anon;
grant execute on function public.canal_atom_defaut(text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3. Alias des fichiers d'import
-- ---------------------------------------------------------------------------
create table if not exists public.alias_import (
  id          serial primary key,
  type        text not null check (type in ('merchandiser', 'distributeur', 'ssf')),
  -- Texte du fichier, comparé en MAJUSCULES sans accents ni ponctuation.
  motif       text not null,
  mode        text not null default 'exact' check (mode in ('exact', 'commence', 'contient')),
  -- merchandiser : e-mail du compte ; distributeur : nom du référentiel ;
  -- ssf : nom du référentiel SSF.
  cible       text not null,
  commentaire text,
  created_at  timestamptz not null default now(),
  unique (type, motif, mode)
);

comment on table public.alias_import is
  'Orthographes rencontrées dans les fichiers d''import (export Atom, DMS) → compte, distributeur ou SSF du référentiel. Lu par les imports de Admin › Imports terrain et par les scripts.';

alter table public.alias_import enable row level security;
drop policy if exists alias_import_read on public.alias_import;
create policy alias_import_read on public.alias_import
  for select to authenticated using (true);
drop policy if exists alias_import_write on public.alias_import;
create policy alias_import_write on public.alias_import
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')));
grant select on public.alias_import to authenticated;
grant insert, update, delete on public.alias_import to authenticated;
grant usage, select on sequence public.alias_import_id_seq to authenticated;

-- Reprise des tables codées en dur dans scripts/importer-routing-atom.mjs et
-- scripts/affecter-merch-dms.mjs.
insert into public.alias_import (type, motif, mode, cible, commentaire) values
  ('merchandiser', 'DEHO WILFRIED', 'exact', 'yopougonmerchtwo@gmail.com', 'Export Atom'),
  ('merchandiser', 'DEHEO WILFRIED', 'exact', 'yopougonmerchtwo@gmail.com', 'Deux comptes ; yopougontwo@ est l''ancien'),
  ('merchandiser', 'DIABATE', 'exact', 'cocodymerchtwo@gmail.com', 'Export Atom'),
  ('merchandiser', 'BERNADIN GUIHI', 'exact', 'cocodymerchtwo@gmail.com', 'Décision du 29/09 : reprend le compte de Cocody 2'),
  ('merchandiser', 'GUIHI BERNADIN', 'exact', 'cocodymerchtwo@gmail.com', 'Décision du 29/09 : reprend le compte de Cocody 2'),
  ('merchandiser', 'KOUADIO ATTOFE ANICET', 'exact', 'koumassimerchone@gmail.com', 'Export Atom'),
  ('merchandiser', 'KOUADIO ATTOFE GUY', 'exact', 'koumassimerchone@gmail.com', 'Export Atom'),
  ('merchandiser', 'MOUSTAPHA N DIAYE', 'exact', 'portbouetone@gmail.com', 'Export Atom'),
  ('merchandiser', 'SEREGONE CHADRAC', 'exact', 'abobomerchone@gmail.com', 'Export Atom'),
  ('merchandiser', 'ZOGBOLOU KEVIN', 'exact', 'yopougonone@gmail.com', 'Export Atom'),
  ('merchandiser', 'YAO VENANCE', 'exact', 'abobomerchtwo@gmail.com', 'Export Atom'),
  ('merchandiser', 'ABBE FREDERIC', 'exact', 'attecoubeone@gmail.com', 'Export Atom'),
  ('merchandiser', 'KOUAME HELLARION', 'exact', 'cocodyone@gmail.com', 'Export Atom'),
  ('merchandiser', 'AKEDAN JEAN YVES', 'exact', 'marcorytreichone@gmail.com', 'Export Atom'),
  ('merchandiser', 'METCH DIANE', 'exact', 'metch.diane@friesland-terrain.ci', 'Export Atom'),
  ('merchandiser', 'HIEN FILIPE', 'exact', 'hien.filipe@friesland-terrain.ci', 'Export Atom'),
  ('merchandiser', 'VITAL YOBOUET', 'exact', 'vital.yobouet@friesland-terrain.ci', 'Export Atom'),
  ('distributeur', 'BOUSSOURA', 'commence', 'BOUSSOURA SARL', null),
  ('distributeur', 'SODICO', 'commence', 'SODICOM-CI', null),
  ('distributeur', 'SODICI', 'commence', 'SODICOM-CI', null),
  ('distributeur', 'NIARE', 'contient', 'ETABLISSEMENT NIARE & FRERES', null),
  ('distributeur', 'NDA', 'exact', 'NOUVEAUX DISTRIBUTEURS ASSOCIES', null),
  ('distributeur', 'NOUVEAUX DISTRIBUTEURS', 'contient', 'NOUVEAUX DISTRIBUTEURS ASSOCIES', null),
  ('distributeur', 'SIDECOM', 'commence', 'SIDECOM', null),
  ('distributeur', 'PLAISIR', 'commence', 'PLAISIR BACHUSS', null),
  ('distributeur', 'DYNAMI', 'commence', 'DYNAMIS', null),
  ('distributeur', 'DINAMY', 'commence', 'DYNAMIS', null),
  ('distributeur', 'PRODISMA', 'commence', 'PRODISMA', null),
  ('distributeur', 'SDTP', 'commence', 'SDTP', null),
  ('distributeur', 'SDHPA', 'commence', 'SDHPA', null),
  ('distributeur', 'HIDJABE', 'contient', 'ETS HIDJABE', null),
  ('distributeur', 'PLAISIR BACCHUS', 'exact', 'PLAISIR BACHUSS', 'Export DMS'),
  ('distributeur', 'TAHIROU AMADOU', 'exact', 'TAHIROU', 'Export DMS'),
  ('distributeur', 'DYNAMYS', 'exact', 'DYNAMIS', 'Export DMS')
on conflict (type, motif, mode) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Renommer un distributeur
-- ---------------------------------------------------------------------------
create or replace function public.renommer_distributeur(p_id integer, p_nom text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ancien text;
  v_pdv integer;
  v_regles integer;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.is_active, true)) then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  p_nom := btrim(p_nom);
  if p_nom is null or p_nom = '' then
    raise exception 'Nom vide';
  end if;
  select nom into v_ancien from distributeur where id = p_id;
  if v_ancien is null then
    raise exception 'Distributeur % introuvable', p_id;
  end if;
  if exists (select 1 from distributeur where upper(nom) = upper(p_nom) and id <> p_id) then
    raise exception 'Un distributeur « % » existe déjà', p_nom;
  end if;

  update distributeur set nom = p_nom where id = p_id;
  -- Texte libre côté PDV et règles : même nom, casse indifférente.
  update pdv set distributor_name = p_nom where upper(distributor_name) = upper(v_ancien);
  get diagnostics v_pdv = row_count;
  update routing_templates set distributeur = p_nom where upper(distributeur) = upper(v_ancien);
  get diagnostics v_regles = row_count;
  -- L'ancien nom reste reconnu dans les imports.
  insert into alias_import (type, motif, mode, cible, commentaire)
  values ('distributeur', upper(v_ancien), 'exact', p_nom, 'Ancien nom (renommage)')
  on conflict (type, motif, mode) do update set cible = excluded.cible;

  return jsonb_build_object('ancien', v_ancien, 'nouveau', p_nom, 'pdv', v_pdv, 'regles', v_regles);
end;
$$;

revoke all on function public.renommer_distributeur(integer, text) from public, anon;
grant execute on function public.renommer_distributeur(integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Recalculer les tournées à venir
-- ---------------------------------------------------------------------------
/**
 * Après un changement de règles, de quotas ou de sous-zones : les tournées
 * FUTURES encore intactes (statut pending, toutes les étapes en attente) du
 * merchandiser sont supprimées puis régénérées sur p_jours jours à partir de
 * demain. Une tournée commencée n'est jamais touchée, celle du jour non plus
 * (l'agent a pu la consulter). Un appel par merchandiser (écran Maintenance,
 * Quotas Atom, imports) : chaque appel reste court.
 */
create or replace function public.recalculer_tournees_a_venir(p_user_id uuid, p_jours integer default 7)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supprimees integer := 0;
  v_creees integer := 0;
begin
  if auth.uid() is not null and not exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur') and coalesce(p.is_active, true)
  ) then
    raise exception 'Réservé aux administrateurs et superviseurs' using errcode = '42501';
  end if;
  p_jours := least(greatest(coalesce(p_jours, 7), 1), 31);

  with supprimees as (
    delete from routings r
    where r.user_id = p_user_id
      and r.date_routing > current_date
      and r.status = 'pending'
      and not exists (select 1 from routing_pdv rp where rp.routing_id = r.id and rp.status <> 'pending')
    returning r.id
  )
  select count(*) into v_supprimees from supprimees;

  v_creees := coalesce(materialiser_routings_periode(p_user_id, current_date + 1, current_date + p_jours), 0);

  return jsonb_build_object('supprimees', v_supprimees, 'creees', v_creees, 'du', current_date + 1, 'au', current_date + p_jours);
end;
$$;

revoke all on function public.recalculer_tournees_a_venir(uuid, integer) from public, anon;
grant execute on function public.recalculer_tournees_a_venir(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Tâches planifiées (pg_cron)
-- ---------------------------------------------------------------------------
create or replace function public.etat_taches_planifiees()
returns table (
  nom          text,
  horaire      text,
  active       boolean,
  dernier_debut timestamptz,
  derniere_fin  timestamptz,
  dernier_statut text,
  dernier_message text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.is_active, true)) then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  return query
    select j.jobname::text, j.schedule::text, j.active,
           d.start_time, d.end_time, d.status::text, left(d.return_message, 500)
    from cron.job j
    left join lateral (
      select rd.start_time, rd.end_time, rd.status, rd.return_message
      from cron.job_run_details rd
      where rd.jobid = j.jobid
      order by rd.start_time desc
      limit 1
    ) d on true
    where j.jobname in ('pregenerer_tournees', 'refresh_stats_dashboard')
    order by j.jobname;
end;
$$;

revoke all on function public.etat_taches_planifiees() from public, anon;
grant execute on function public.etat_taches_planifiees() to authenticated;

create or replace function public.modifier_horaire_tache(p_nom text, p_horaire text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commande text;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.is_active, true)) then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  if p_nom not in ('pregenerer_tournees', 'refresh_stats_dashboard') then
    raise exception 'Tâche non modifiable : %', p_nom;
  end if;
  -- Cinq champs cron (minute heure jour mois jour-semaine), heure UTC = heure d'Abidjan.
  if p_horaire !~ '^\s*(\S+\s+){4}\S+\s*$' or p_horaire ~ '[^0-9*/,\- ]' then
    raise exception 'Horaire invalide : « % » (format cron à 5 champs, ex. 0 3 * * *)', p_horaire;
  end if;
  select command into v_commande from cron.job where jobname = p_nom;
  if v_commande is null then
    raise exception 'Tâche % introuvable', p_nom;
  end if;
  -- Planifier un nom existant met à jour la tâche (pg_cron ≥ 1.3).
  perform cron.schedule(p_nom, btrim(p_horaire), v_commande);
end;
$$;

revoke all on function public.modifier_horaire_tache(text, text) from public, anon;
grant execute on function public.modifier_horaire_tache(text, text) to authenticated;

-- Le rafraîchissement des statistiques dure ~20 s : trop long pour une requête
-- de l'admin (limite de 8 s). On le confie à pg_cron pour un passage unique
-- dans les secondes qui suivent ; la tâche se retire elle-même en démarrant.
create or replace function public.programmer_rafraichissement_stats()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur') and coalesce(p.is_active, true)) then
    raise exception 'Réservé aux administrateurs et superviseurs' using errcode = '42501';
  end if;
  begin
    perform cron.schedule(
      'refresh_stats_ponctuel',
      '5 seconds',
      $cmd$select cron.unschedule('refresh_stats_ponctuel'); select public.refresh_stats_dashboard();$cmd$
    );
  exception when others then
    -- pg_cron sans intervalle en secondes (< 1.5) : à la prochaine minute.
    perform cron.schedule(
      'refresh_stats_ponctuel',
      '* * * * *',
      $cmd$select cron.unschedule('refresh_stats_ponctuel'); select public.refresh_stats_dashboard();$cmd$
    );
  end;
end;
$$;

revoke all on function public.programmer_rafraichissement_stats() from public, anon;
grant execute on function public.programmer_rafraichissement_stats() to authenticated;

commit;
