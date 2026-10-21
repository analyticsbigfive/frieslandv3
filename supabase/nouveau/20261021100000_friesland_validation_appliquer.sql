-- ============================================================================
-- VALIDATION DES TOURNÉES : APPLIQUER LES CORRECTIONS (21/10/2026)
-- Jusqu'ici, les retours des merchandisers restaient en lecture : l'admin les
-- cochait « traité » et corrigeait le routing à la main.
--
--   1. Le choix de l'admin pour chaque retour est enregistré à côté du retour :
--        validation_tournee_reponse.correction
--          { "action": "remplacer", "source_ligne_id": <ligne du même merch> }
--          { "action": "vider" }    jour laissé sans point de visite
--          { "action": "garder" }   rien à changer
--        validation_tournee_pdv_retour.correction   'fermer' | 'garder'
--        validation_tournee_merch.zones_retenues
--          { "zone_assignee": nom, "territoires": [noms], "quartiers": [noms] }
--          (territoires_assignes / quartiers_assignes sont en jsonb dans profiles)
--      Un retour sans choix n'est pas appliqué.
--   2. appliquer_validation_tournee(campagne, simuler) applique tous les choix
--      des fiches envoyées en une seule transaction, ou les simule (tout est
--      annulé, seul le compte rendu avant / après est renvoyé). Le vrai
--      passage est refusé tant qu'un merchandiser (hors comptes de test)
--      n'a pas envoyé sa fiche.
--      « remplacer » recopie le point de visite d'une autre ligne du même
--      merchandiser (nom, commune, quartiers, GPS, distributeur, secteur) ;
--      le SSF et le type d'engin restent ceux du jour. Toutes les lignes sont
--      modifiées en une instruction : un échange mercredi ↔ jeudi marche.
--   3. Journal avant / après de chaque écriture et annulation par lot.
--   4. Questions à trancher par campagne (colonne de droite de la page admin).
-- Idempotente.
-- ============================================================================
begin;

-- 1. ---------------------------------------------------------------------------
alter table public.validation_tournee_reponse add column if not exists correction jsonb;
alter table public.validation_tournee_reponse drop constraint if exists validation_tournee_reponse_correction_check;
alter table public.validation_tournee_reponse add constraint validation_tournee_reponse_correction_check
  check (correction is null or correction->>'action' in ('remplacer', 'vider', 'garder'));
comment on column public.validation_tournee_reponse.correction is
  'Choix de l''admin : {action: remplacer, source_ligne_id} | {action: vider} | {action: garder}. Nul = pas encore décidé.';

alter table public.validation_tournee_pdv_retour add column if not exists correction text;
alter table public.validation_tournee_pdv_retour drop constraint if exists validation_tournee_pdv_retour_correction_check;
alter table public.validation_tournee_pdv_retour add constraint validation_tournee_pdv_retour_correction_check
  check (correction is null or correction in ('fermer', 'garder'));

alter table public.validation_tournee_merch add column if not exists zones_retenues jsonb;
alter table public.validation_tournee_merch add column if not exists zones_appliquees_le timestamptz;
comment on column public.validation_tournee_merch.zones_retenues is
  'Zones retenues par l''admin pour le profil : {zone_assignee, territoires: [noms], quartiers: [noms]}. Nul = pas encore décidé.';

-- 3. ---------------------------------------------------------------------------
create table if not exists public.validation_tournee_application (
  id           uuid primary key default gen_random_uuid(),
  campagne_id  uuid not null references public.validation_tournee_campagne(id) on delete cascade,
  lot          uuid not null,
  table_cible  text not null check (table_cible in ('routing_mensuel', 'pdv', 'profiles')),
  cible_id     text not null,
  origine_id   uuid,            -- réponse, retour boutique ou fiche à l'origine
  avant        jsonb not null,
  apres        jsonb,
  applique_par uuid references public.profiles(id) on delete set null,
  applique_le  timestamptz not null default now(),
  annule_le    timestamptz
);
create index if not exists validation_tournee_application_lot_idx on public.validation_tournee_application (lot);

alter table public.validation_tournee_application enable row level security;
drop policy if exists vt_application_lecture on public.validation_tournee_application;
create policy vt_application_lecture on public.validation_tournee_application for select to authenticated
  using (public.est_admin_ou_superviseur());

-- 4. ---------------------------------------------------------------------------
create table if not exists public.validation_tournee_question (
  id              uuid primary key default gen_random_uuid(),
  campagne_id     uuid not null references public.validation_tournee_campagne(id) on delete cascade,
  merchandiser_id uuid references public.profiles(id) on delete set null,
  ordre           integer not null default 0,
  question        text not null,
  reponse         text,
  statut          text not null default 'ouverte' check (statut in ('ouverte', 'repondue')),
  cree_le         timestamptz not null default now(),
  repondu_le      timestamptz,
  repondu_par     uuid references public.profiles(id) on delete set null
);
alter table public.validation_tournee_question enable row level security;
drop policy if exists vt_question_acces on public.validation_tournee_question;
create policy vt_question_acces on public.validation_tournee_question for all to authenticated
  using (public.est_admin_ou_superviseur())
  with check (public.est_admin_ou_superviseur());

-- Les 6 questions de novembre 2026 (une seule fois).
insert into public.validation_tournee_question (campagne_id, merchandiser_id, ordre, question)
select c.id, m.id, q.ordre, q.question
from public.validation_tournee_campagne c
cross join (values
  (1, 'SEREGONE SCHADRACK', 'Anyama, semaine 2, vendredi : il demande de le retirer, sans commentaire, alors qu''il dit couvrir Anyama. Par quel point de visite le remplacer ?'),
  (2, 'ZOGBOLOU KEVIN', 'Il a coché Yopougon 3 et 4 (et décoché 1 et 2), mais ses « oui / non » disent l''inverse et son routing est dans le secteur Atom « Yopougon 1 & 2 ». On retient Yopougon 3 et 4 ? Faut-il changer son secteur Atom ?'),
  (3, 'ZOGBOLOU KEVIN', 'Zone industrielle, semaine 1, lundi : 3 boutiques « Madame Dosso » signalées fermées, à 200-400 m l''une de l''autre. Les fermer toutes, ou ce sont des doublons ?'),
  (4, null, 'Yao, Zogbolou et Seregone trouvent les PDV trop loin et demandent l''ordre d''enregistrement. Faut-il changer la façon de choisir les PDV du jour ?'),
  (5, null, 'Date d''application des corrections : dès que toutes les fiches sont envoyées (la fin d''octobre change aussi), ou le 1er novembre ?'),
  (6, null, 'Écran des zones : Zogbolou a répondu « oui / non » à l''inverse de ce qu''il a coché. Faut-il reformuler la question ?')
) as q(ordre, nom, question)
left join public.profiles m on m.nom = q.nom
where c.mois = date '2026-11-01'
  and not exists (select 1 from public.validation_tournee_question x where x.campagne_id = c.id);

-- 2. ---------------------------------------------------------------------------
-- Merchandisers dont la fiche n'est pas envoyée (hors comptes de test).
-- Droits de l'appelant : la RLS des fiches s'applique depuis la page.
create or replace function public.validation_fiches_manquantes(p_campagne uuid)
returns table (merchandiser_id uuid, nom text, statut text)
language sql
stable
set search_path = public
as $$
  select m.merchandiser_id, p.nom, m.statut
  from validation_tournee_merch m
  join profiles p on p.id = m.merchandiser_id
  where m.campagne_id = p_campagne
    and m.statut <> 'validee'
    and coalesce(p.email, '') not like '%@friesland-test.ci'
  order by p.nom
$$;

create or replace function public.appliquer_validation_tournee(p_campagne uuid, p_simuler boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot uuid := gen_random_uuid();
  v_par uuid := auth.uid();
  v_manquantes jsonb;
  v_merchs uuid[];
  v_res jsonb;
begin
  if auth.uid() is not null and not public.est_admin_ou_superviseur() then
    raise exception 'Réservé aux administrateurs et superviseurs' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(f.nom order by f.nom), '[]'::jsonb) into v_manquantes
  from validation_fiches_manquantes(p_campagne) f;
  if not p_simuler and jsonb_array_length(v_manquantes) > 0 then
    raise exception 'Fiches pas encore envoyées : %', (select string_agg(x, ', ') from jsonb_array_elements_text(v_manquantes) x)
      using errcode = 'VT409';
  end if;

  -- Ce qui est décidé et pas encore appliqué, sur les fiches envoyées.
  drop table if exists _vt_jours;
  create temp table _vt_jours on commit drop as
  select r.id as reponse_id, r.routing_mensuel_id as cible, m.merchandiser_id,
         r.correction->>'action' as action, nullif(r.correction->>'source_ligne_id', '')::uuid as source
  from validation_tournee_reponse r
  join validation_tournee_merch m on m.id = r.validation_merch_id
  where m.campagne_id = p_campagne and m.statut = 'validee'
    and not r.traite and r.decision <> 'ok'
    and r.correction->>'action' in ('remplacer', 'vider');
  -- Une source doit être une ligne active du même merchandiser.
  delete from _vt_jours j where j.action = 'remplacer' and not exists (
    select 1 from routing_mensuel s where s.id = j.source and s.merchandiser_id = j.merchandiser_id and s.actif);

  drop table if exists _vt_pdv;
  create temp table _vt_pdv on commit drop as
  select pr.id as retour_id, pr.pdv_id, m.merchandiser_id
  from validation_tournee_pdv_retour pr
  join validation_tournee_merch m on m.id = pr.validation_merch_id
  join pdv p on p.pdv_id = pr.pdv_id
  where m.campagne_id = p_campagne and m.statut = 'validee'
    and not pr.traite and pr.correction = 'fermer' and coalesce(p.is_active, true);

  drop table if exists _vt_zones;
  create temp table _vt_zones on commit drop as
  select m.id as fiche_id, m.merchandiser_id, m.zones_retenues as z
  from validation_tournee_merch m
  where m.campagne_id = p_campagne and m.statut = 'validee'
    and m.zones_retenues is not null and m.zones_appliquees_le is null;

  select array_agg(distinct x) into v_merchs from (
    select merchandiser_id x from _vt_jours union select merchandiser_id from _vt_pdv union select merchandiser_id from _vt_zones
  ) t;

  -- Photo « avant » : plan du mois de chaque merchandiser touché et quartier de chaque boutique.
  drop table if exists _vt_plan_avant;
  create temp table _vt_plan_avant on commit drop as
  select u.m as merchandiser_id, p.ligne_id, p.pdv_id
  from unnest(coalesce(v_merchs, '{}')) as u(m), lateral plan_mensuel_atom(u.m) p;
  drop table if exists _vt_quartier_avant;
  create temp table _vt_quartier_avant on commit drop as
  select pdv_id, merchandiser_id from pdv_quartier_tournee;

  begin
    -- Jours : journal, puis toutes les lignes en une instruction (échanges compris).
    insert into validation_tournee_application (campagne_id, lot, table_cible, cible_id, origine_id, avant, applique_par)
    select p_campagne, v_lot, 'routing_mensuel', rm.id::text, j.reponse_id, to_jsonb(rm), v_par
    from _vt_jours j join routing_mensuel rm on rm.id = j.cible;

    update routing_mensuel t set
      point_visite = s.point_visite, commune = s.commune, zone = s.zone, secteur = s.secteur,
      quartiers = s.quartiers, lieux = s.lieux, latitude = s.latitude, longitude = s.longitude,
      rayon_m = s.rayon_m, distributeur = s.distributeur, actif = true
    from _vt_jours j join routing_mensuel s on s.id = j.source
    where t.id = j.cible and j.action = 'remplacer';

    update routing_mensuel t set actif = false
    from _vt_jours j where t.id = j.cible and j.action = 'vider';

    -- Boutiques fermées.
    insert into validation_tournee_application (campagne_id, lot, table_cible, cible_id, origine_id, avant, applique_par)
    select p_campagne, v_lot, 'pdv', p.pdv_id, x.retour_id, jsonb_build_object('pdv_id', p.pdv_id, 'nom_pdv', p.nom_pdv, 'is_active', p.is_active), v_par
    from _vt_pdv x join pdv p on p.pdv_id = x.pdv_id;
    update pdv set is_active = false where pdv_id in (select pdv_id from _vt_pdv);

    -- Zones du profil.
    insert into validation_tournee_application (campagne_id, lot, table_cible, cible_id, origine_id, avant, applique_par)
    select p_campagne, v_lot, 'profiles', p.id::text, z.fiche_id,
           jsonb_build_object('zone_assignee', p.zone_assignee, 'territoires_assignes', p.territoires_assignes, 'quartiers_assignes', p.quartiers_assignes), v_par
    from _vt_zones z join profiles p on p.id = z.merchandiser_id;
    update profiles p set
      zone_assignee = coalesce(nullif(z.z->>'zone_assignee', ''), p.zone_assignee),
      territoires_assignes = coalesce(z.z->'territoires', p.territoires_assignes),
      quartiers_assignes = coalesce(z.z->'quartiers', p.quartiers_assignes)
    from _vt_zones z where p.id = z.merchandiser_id;

    -- État « après » dans le journal.
    update validation_tournee_application a set apres = case a.table_cible
        when 'routing_mensuel' then (select to_jsonb(rm) from routing_mensuel rm where rm.id::text = a.cible_id)
        when 'pdv' then (select jsonb_build_object('pdv_id', p.pdv_id, 'nom_pdv', p.nom_pdv, 'is_active', p.is_active) from pdv p where p.pdv_id = a.cible_id)
        else (select jsonb_build_object('zone_assignee', p.zone_assignee, 'territoires_assignes', p.territoires_assignes, 'quartiers_assignes', p.quartiers_assignes)
              from profiles p where p.id::text = a.cible_id)
      end
    where a.lot = v_lot;

    -- Traité seulement ce qui vient d'être écrit.
    update validation_tournee_reponse set traite = true, maj_le = now() where id in (select reponse_id from _vt_jours);
    update validation_tournee_pdv_retour set traite = true, maj_le = now() where id in (select retour_id from _vt_pdv);
    update validation_tournee_merch set zones_appliquees_le = now() where id in (select fiche_id from _vt_zones);
    update validation_tournee_zone set traite = true, maj_le = now() where validation_merch_id in (select fiche_id from _vt_zones);

    -- Compte rendu avant / après.
    drop table if exists _vt_plan_apres;
    create temp table _vt_plan_apres on commit drop as
    select u.m as merchandiser_id, p.ligne_id, p.pdv_id
    from unnest(coalesce(v_merchs, '{}')) as u(m), lateral plan_mensuel_atom(u.m) p;

    select jsonb_build_object(
      'lot', v_lot,
      'simulation', p_simuler,
      'fiches_manquantes', v_manquantes,
      'merchandisers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'merchandiser_id', u.m,
          'nom', pr.nom,
          'boutiques_avant', (select count(*) from _vt_plan_avant a where a.merchandiser_id = u.m),
          'boutiques_apres', (select count(*) from _vt_plan_apres a where a.merchandiser_id = u.m),
          'boutiques_changent_de_jour', (select count(*) from _vt_plan_avant a join _vt_plan_apres b
              on b.pdv_id = a.pdv_id and b.merchandiser_id = a.merchandiser_id
              join routing_mensuel la on la.id = a.ligne_id join routing_mensuel lb on lb.id = b.ligne_id
              where a.merchandiser_id = u.m and (la.semaine_du_mois, la.jour_semaine) <> (lb.semaine_du_mois, lb.jour_semaine)),
          'boutiques_sorties', (select count(*) from _vt_plan_avant a where a.merchandiser_id = u.m
              and not exists (select 1 from _vt_plan_apres b where b.merchandiser_id = u.m and b.pdv_id = a.pdv_id)),
          'boutiques_entrees', (select count(*) from _vt_plan_apres b where b.merchandiser_id = u.m
              and not exists (select 1 from _vt_plan_avant a where a.merchandiser_id = u.m and a.pdv_id = b.pdv_id)),
          'jours', coalesce((
            select jsonb_agg(jsonb_build_object(
              'semaine', (j.avant->>'semaine_du_mois')::int,
              'jour', (j.avant->>'jour_semaine')::int,
              'avant', j.avant->>'point_visite',
              'apres', case when (j.apres->>'actif')::boolean then j.apres->>'point_visite' end,
              'boutiques_avant', (select count(*) from _vt_plan_avant a where a.ligne_id::text = j.cible_id),
              'boutiques_apres', (select count(*) from _vt_plan_apres b where b.ligne_id::text = j.cible_id)
            ) order by (j.avant->>'semaine_du_mois')::int, (j.avant->>'jour_semaine')::int)
            from validation_tournee_application j
            where j.lot = v_lot and j.table_cible = 'routing_mensuel' and (j.avant->>'merchandiser_id')::uuid = u.m
          ), '[]'::jsonb),
          'zones', (select jsonb_build_object('avant', j.avant, 'apres', j.apres)
            from validation_tournee_application j
            where j.lot = v_lot and j.table_cible = 'profiles' and j.cible_id = u.m::text)
        ) order by pr.nom)
        from unnest(coalesce(v_merchs, '{}')) as u(m) join profiles pr on pr.id = u.m
      ), '[]'::jsonb),
      'boutiques_fermees', coalesce((
        select jsonb_agg(jsonb_build_object('pdv_id', j.cible_id, 'nom', j.avant->>'nom_pdv'))
        from validation_tournee_application j where j.lot = v_lot and j.table_cible = 'pdv'), '[]'::jsonb),
      -- Boutiques qui passent chez un autre merchandiser (point le plus proche).
      'boutiques_autre_merchandiser', coalesce((
        select jsonb_agg(jsonb_build_object('de', pa.nom, 'vers', pb.nom, 'boutiques', n))
        from (
          select a.merchandiser_id as de, b.merchandiser_id as vers, count(*) as n
          from _vt_quartier_avant a join pdv_quartier_tournee b on b.pdv_id = a.pdv_id
          where a.merchandiser_id <> b.merchandiser_id
          group by 1, 2
        ) t join profiles pa on pa.id = t.de join profiles pb on pb.id = t.vers), '[]'::jsonb)
    ) into v_res;

    if p_simuler then
      raise exception 'simulation' using errcode = 'VTSIM';
    end if;
  exception when sqlstate 'VTSIM' then
    null; -- simulation : toutes les écritures du bloc sont annulées, v_res reste.
  end;

  return v_res;
end;
$$;

-- Annuler un lot : remet chaque ligne dans son état « avant », et les retours en « à traiter ».
create or replace function public.annuler_application_validation(p_lot uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  j record;
  n integer := 0;
begin
  if auth.uid() is not null and not public.est_admin_ou_superviseur() then
    raise exception 'Réservé aux administrateurs et superviseurs' using errcode = '42501';
  end if;

  for j in select * from validation_tournee_application where lot = p_lot and annule_le is null order by applique_le desc loop
    if j.table_cible = 'routing_mensuel' then
      update routing_mensuel t set
        point_visite = x.point_visite, commune = x.commune, zone = x.zone, secteur = x.secteur,
        quartiers = x.quartiers, lieux = x.lieux, latitude = x.latitude, longitude = x.longitude,
        rayon_m = x.rayon_m, distributeur = x.distributeur, actif = x.actif
      from jsonb_populate_record(null::routing_mensuel, j.avant) x
      where t.id = x.id;
      update validation_tournee_reponse set traite = false where id = j.origine_id;
    elsif j.table_cible = 'pdv' then
      update pdv set is_active = (j.avant->>'is_active')::boolean where pdv_id = j.cible_id;
      update validation_tournee_pdv_retour set traite = false where id = j.origine_id;
    else
      update profiles set
        zone_assignee = j.avant->>'zone_assignee',
        territoires_assignes = j.avant->'territoires_assignes',
        quartiers_assignes = j.avant->'quartiers_assignes'
      where id::text = j.cible_id;
      update validation_tournee_merch set zones_appliquees_le = null where id = j.origine_id;
      update validation_tournee_zone set traite = false where validation_merch_id = j.origine_id;
    end if;
    update validation_tournee_application set annule_le = now() where id = j.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.validation_fiches_manquantes(uuid) from public, anon;
revoke all on function public.appliquer_validation_tournee(uuid, boolean) from public, anon, authenticated;
revoke all on function public.annuler_application_validation(uuid) from public, anon, authenticated;
grant execute on function public.validation_fiches_manquantes(uuid) to authenticated, service_role;
grant execute on function public.appliquer_validation_tournee(uuid, boolean) to service_role;
grant execute on function public.annuler_application_validation(uuid) to service_role;

commit;
