-- ============================================================================
-- 20261118150000_friesland_jours_feries.sql
-- Jours fériés : aucune tournée ce jour-là.
--
-- Demande de Jean Luc du 18/11/2026, après la génération des tournées Atom
-- jusqu'au 31/12 : le 25/12 avait une tournée ordinaire. Décision : un jour
-- férié, personne n'a de tournée (merchandisers Atom et Friesland).
--
--   1. jour_ferie : la liste, avec le 25/12/2026 et le 01/01/2027 pour
--      commencer. Les autres jours se rajoutent par une ligne (admin ou
--      superviseur) ; aucun n'est déduit d'un calendrier.
--   2. materialiser_routing_jour : même fonction que la 20261105190000, avec
--      un seul ajout : un jour férié, elle ne crée rien et rend null. C'est le
--      seul point de passage (cron de 3 h, recalcul, export du mois, ouverture
--      de l'application). Une tournée qui existe déjà est toujours rendue.
--   3. Les tournées déjà générées pour un jour férié à venir, pas commencées,
--      sont supprimées.
--
-- Ce jour-là l'application n'affiche pas de tournée ; une visite reste
-- possible et compte comme une visite hors tournée.
--
-- Rejouable : create ... if not exists, create or replace, on conflict.
-- ============================================================================
begin;

create table if not exists public.jour_ferie (
  jour     date primary key,
  libelle  text not null,
  cree_le  timestamptz not null default now()
);

comment on table public.jour_ferie is
  'Jours fériés : aucune tournée générée ce jour-là (materialiser_routing_jour).';

alter table public.jour_ferie enable row level security;

drop policy if exists jour_ferie_lecture on public.jour_ferie;
create policy jour_ferie_lecture on public.jour_ferie for select to authenticated
  using (true);

drop policy if exists jour_ferie_ecriture on public.jour_ferie;
create policy jour_ferie_ecriture on public.jour_ferie for all to authenticated
  using ((select public.role_actif_courant()) in ('admin', 'superviseur'))
  with check ((select public.role_actif_courant()) in ('admin', 'superviseur'));

grant select, insert, update, delete on public.jour_ferie to authenticated;

insert into public.jour_ferie (jour, libelle) values
  ('2026-12-25', 'Noël'),
  ('2027-01-01', 'Jour de l''an')
on conflict (jour) do nothing;

create or replace function public.est_jour_ferie(p_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from jour_ferie f where f.jour = p_date);
$$;

grant execute on function public.est_jour_ferie(date) to public, anon, authenticated, service_role;

-- Copie de la 20261105190000 ; seul ajout : le bloc « Jour férié ».
create or replace function public.materialiser_routing_jour(p_user_id uuid, p_date date)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  -- Jour férié (18/11/2026) : aucune tournée, pour personne. Une tournée déjà
  -- commencée ce jour-là a été rendue ci-dessus.
  if est_jour_ferie(p_date) then
    return null;
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
  -- un point de visite, plus les nouveaux PDV à recruter si la tournée est
  -- sous l'objectif (05/11/2026).
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
    v_objectifs := objectifs_a_trouver(p_date, coalesce(v_nb, 0));
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
$function$;

-- Tournées déjà générées pour un jour férié à venir : supprimées si rien n'y
-- a été fait (leurs étapes partent avec elles).
delete from public.routings r
using public.jour_ferie f
where r.date_routing = f.jour
  and r.date_routing > (now() at time zone 'Africa/Abidjan')::date
  and r.status = 'pending'
  and not exists (select 1 from public.routing_pdv rp where rp.routing_id = r.id and rp.status <> 'pending');

commit;
