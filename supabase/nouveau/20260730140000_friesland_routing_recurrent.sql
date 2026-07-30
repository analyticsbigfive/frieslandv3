-- ============================================================================
-- ROUTING RÉCURRENT (réunion 23/07, tâche 4 — priorité n°1 du client)
--
-- Le routing était journalier : à recréer chaque jour, ou importé par CSV qui
-- écrasait l'existant. Le client veut une logique de RÈGLE, comme son DMS :
-- « ce PDV, ce merchandiser le visite chaque lundi », et ça se répète tout seul,
-- mois suivant compris, sans re-paramétrer.
--
-- CE QUI NE CHANGE PAS : l'app mobile écrit son avancement (statut, GPS,
-- geofence, visite_id) sur des lignes `routing_pdv` réelles. Une récurrence
-- purement virtuelle ne lui laisserait rien à écrire. Les règles restent donc
-- MATÉRIALISÉES en tournées concrètes ; c'est la matérialisation qui devient
-- automatique.
--
-- CE QUI CHANGE :
--   1. `routing_templates` devient une règle : plusieurs jours de semaine
--      (days_of_week), une fenêtre de validité, un territoire et un
--      distributeur propres (un merchandiser change de zone en cours de mois).
--   2. `routing_template_exception` permet de décocher un PDV — ou toute la
--      tournée — sur une période donnée, SANS supprimer la règle.
--   3. `materialiser_routing_jour` crée la tournée du jour si elle n'existe pas.
--      Idempotente : rappelée, elle rend la tournée existante sans jamais
--      écraser l'avancement terrain.
--
-- Idempotent. Additif : `day_of_week` est conservée (rendue nullable) et
-- recopiée dans `days_of_week`, aucune règle existante n'est perdue.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. La règle récurrente
-- ---------------------------------------------------------------------------
alter table routing_templates add column if not exists days_of_week integer[];
alter table routing_templates add column if not exists territoire text;
alter table routing_templates add column if not exists distributeur text;
alter table routing_templates add column if not exists date_debut date;
alter table routing_templates add column if not exists date_fin date;

comment on column routing_templates.days_of_week is
  'Jours de la semaine où la règle s''applique (0 = dimanche … 6 = samedi). Remplace day_of_week, conservée pour compatibilité.';
comment on column routing_templates.territoire is
  'Territoire couvert par CETTE règle. Un merchandiser peut avoir deux règles sur deux territoires le même mois.';
comment on column routing_templates.distributeur is
  'Distributeur rattaché à CETTE règle, pour la même raison.';
comment on column routing_templates.date_fin is
  'Fin de validité. NULL = la règle court indéfiniment — c''est le cas nominal demandé par le client.';

-- Reprise des règles existantes : le jour unique devient un tableau d'un jour.
update routing_templates
set days_of_week = array[day_of_week]
where days_of_week is null and day_of_week is not null;

-- day_of_week n'est plus obligatoire : les nouvelles règles n'écrivent que le tableau.
alter table routing_templates alter column day_of_week drop not null;

-- Filet : une règle sans aucun jour ne se déclencherait jamais et resterait
-- invisible pour l'admin qui l'a créée.
alter table routing_templates drop constraint if exists routing_templates_jours_non_vides;
alter table routing_templates add constraint routing_templates_jours_non_vides
  check (days_of_week is null or array_length(days_of_week, 1) > 0);

-- ---------------------------------------------------------------------------
-- 2. Les exceptions ponctuelles
-- ---------------------------------------------------------------------------
create table if not exists routing_template_exception (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references routing_templates(id) on delete cascade,
  -- NULL = toute la tournée est suspendue sur la période.
  -- Renseigné = ce PDV seul est retiré, le reste de la tournée est maintenu.
  pdv_id text references pdv(pdv_id) on delete cascade,
  date_debut date not null,
  date_fin date not null,
  motif text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (date_fin >= date_debut)
);

comment on table routing_template_exception is
  'Désactivation ponctuelle d''une règle de routing : « cette semaine, il ne visite pas ce PDV ». La règle reste intacte.';

create index if not exists idx_routing_exception_template on routing_template_exception(template_id, date_debut, date_fin);

alter table routing_template_exception enable row level security;
drop policy if exists routing_exception_read on routing_template_exception;
create policy routing_exception_read on routing_template_exception
  for select to authenticated using (true);
drop policy if exists routing_exception_write on routing_template_exception;
create policy routing_exception_write on routing_template_exception
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 3. Traçabilité : d'où vient une tournée ?
-- ---------------------------------------------------------------------------
alter table routings add column if not exists template_id uuid references routing_templates(id) on delete set null;
alter table routings add column if not exists source text not null default 'manuel';

comment on column routings.source is
  'manuel = créée à la main ou importée ; regle = matérialisée depuis une règle récurrente.';

-- ---------------------------------------------------------------------------
-- 4. Matérialisation
-- ---------------------------------------------------------------------------

-- Règles actives d'un merchandiser pour une date donnée.
create or replace function routing_regles_du_jour(p_user_id uuid, p_date date)
returns setof routing_templates
language sql stable
set search_path = public
as $$
  select t.*
  from routing_templates t
  where t.user_id = p_user_id
    and coalesce(t.is_active, true)
    -- extract(dow) : 0 = dimanche, même convention que JS getDay().
    and coalesce(t.days_of_week, array[t.day_of_week]) @> array[extract(dow from p_date)::int]
    and (t.date_debut is null or p_date >= t.date_debut)
    and (t.date_fin is null or p_date <= t.date_fin)
    -- Règle suspendue en entier sur cette date (exception sans pdv_id).
    and not exists (
      select 1 from routing_template_exception e
      where e.template_id = t.id
        and e.pdv_id is null
        and p_date between e.date_debut and e.date_fin
    );
$$;

/**
 * Crée la tournée du jour depuis les règles actives, ou rend celle qui existe.
 *
 * IDEMPOTENTE : si une tournée existe déjà pour (user, date), elle est renvoyée
 * telle quelle. Jamais de suppression, jamais d'écrasement — sinon un rappel de
 * la fonction en cours de journée effacerait l'avancement du merchandiser.
 *
 * Renvoie NULL si aucune règle ne s'applique ou si toutes les étapes sont
 * exclues par des exceptions : on ne crée pas de tournée vide.
 */
create or replace function materialiser_routing_jour(p_user_id uuid, p_date date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_routing_id uuid;
  v_template_id uuid;
  v_nb integer;
begin
  select id into v_routing_id
  from routings
  where user_id = p_user_id and date_routing = p_date
  limit 1;

  if v_routing_id is not null then
    return v_routing_id;
  end if;

  -- Étapes du jour : toutes les règles applicables, exceptions PDV retirées.
  -- Une tournée peut agréger plusieurs règles (deux territoires le même jour) ;
  -- on trace la première comme origine.
  select count(*), min(x.template_id::text)::uuid
  into v_nb, v_template_id
  from (
    select r.id as template_id
    from routing_regles_du_jour(p_user_id, p_date) r
    join routing_template_pdv tp on tp.template_id = r.id
    where not exists (
      select 1 from routing_template_exception e
      where e.template_id = r.id
        and e.pdv_id = tp.pdv_id
        and p_date between e.date_debut and e.date_fin
    )
  ) x;

  -- Aucune étape : on ne crée pas de tournée vide, le merchandiser verrait une
  -- journée « planifiée » sans contenu.
  if v_nb = 0 then
    return null;
  end if;

  insert into routings(user_id, date_routing, status, source, template_id, created_by)
  values (p_user_id, p_date, 'pending', 'regle', v_template_id, p_user_id)
  returning id into v_routing_id;

  -- distinct on (pdv_id) : un même PDV présent dans deux règles du même jour
  -- ne doit donner qu'une étape, sinon le merchandiser le visite deux fois.
  insert into routing_pdv(routing_id, pdv_id, position_order, objectifs, status)
  select v_routing_id, e.pdv_id, row_number() over (order by e.ordre), e.objectifs, 'pending'
  from (
    select distinct on (etape.pdv_id) etape.pdv_id, etape.objectifs, etape.ordre
    from (
      select
        tp.pdv_id,
        coalesce(tp.objectifs, '{}'::jsonb) as objectifs,
        row_number() over (order by r.created_at, tp.position_order) as ordre
      from routing_regles_du_jour(p_user_id, p_date) r
      join routing_template_pdv tp on tp.template_id = r.id
      where not exists (
        select 1 from routing_template_exception e2
        where e2.template_id = r.id
          and e2.pdv_id = tp.pdv_id
          and p_date between e2.date_debut and e2.date_fin
      )
    ) etape
    order by etape.pdv_id, etape.ordre
  ) e;

  return v_routing_id;
end;
$$;

/**
 * Pré-génération sur une fenêtre glissante (J → J+7 par défaut côté appel).
 *
 * C'est le chemin principal : l'app mobile est offline-first, un merchandiser
 * qui ouvre l'app sans réseau doit trouver une tournée DÉJÀ créée et mise en
 * cache. La matérialisation à l'ouverture ne sert que de rattrapage.
 */
create or replace function materialiser_routings_periode(
  p_user_id uuid,
  p_date_debut date,
  p_date_fin date
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jour date;
  v_cree integer := 0;
begin
  v_jour := p_date_debut;
  while v_jour <= p_date_fin loop
    if materialiser_routing_jour(p_user_id, v_jour) is not null then
      v_cree := v_cree + 1;
    end if;
    v_jour := v_jour + 1;
  end loop;
  return v_cree;
end;
$$;

grant execute on function materialiser_routing_jour(uuid, date) to authenticated;
grant execute on function materialiser_routings_periode(uuid, date, date) to authenticated;
grant execute on function routing_regles_du_jour(uuid, date) to authenticated;

commit;
