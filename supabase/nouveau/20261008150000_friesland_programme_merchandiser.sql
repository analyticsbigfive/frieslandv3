-- ============================================================================
-- PROGRAMME MERCHANDISER SOUTH / NORTH (ex-« Programme Atom »)
--
-- Réunion client du 08/10/2026 : « au lieu de Programme Atom, mettre Programme
-- merchandiser South, et de l'autre côté Programme merchandiser North », une
-- autre agence couvrant l'intérieur. Même calcul que programme_atom
-- (20261007120000), pour les merchandisers des agences « programme » d'une
-- direction (table agence) au lieu de employeur = 'atom'.
--
-- programme_atom(date) et v_programme_atom restent (lus par l'admin déployé
-- avant cette migration) : ils renvoient la direction South, c'est-à-dire
-- les mêmes lignes tant qu'Atom est la seule agence South.
--
-- La grille des quotas (routing_quota_canal) reste commune aux directions.
--
-- Idempotent.
-- ============================================================================
begin;

create or replace function public.programme_merchandiser(p_mois date default current_date, p_direction text default 'south')
returns table (
  user_id uuid, nom text, email text, employeur text, agence text, mois date,
  nb_portefeuille integer, nb_eligibles integer, nb_planifies integer,
  nb_visites integer, nb_perfect_store integer, objectif_mensuel integer, reste_a_visiter integer
)
language sql
stable
set search_path = public
as $$
  with agences as (
    select a.code, a.nom from agence a
    where a.programme and a.actif and (p_direction is null or a.direction = p_direction)
  ),
  regles as (
    select t.user_id, t.id as template_id
    from routing_templates t
    join profiles p on p.id = t.user_id
    where p.employeur in (select code from agences) and t.mode = 'quota' and coalesce(t.is_active, true)
  ),
  mois as (
    select date_trunc('month', coalesce(p_mois, current_date))::date as debut,
           (date_trunc('month', coalesce(p_mois, current_date)) + interval '1 month - 1 day')::date as fin
  ),
  portefeuille as (
    select r.user_id, count(distinct tp.pdv_id) as nb_portefeuille,
           count(distinct tp.pdv_id) filter (where canal_atom(p.sous_categorie_pdv) is not null) as nb_eligibles
    from regles r
    join routing_template_pdv tp on tp.template_id = r.template_id
    join pdv p on p.pdv_id = tp.pdv_id
    group by r.user_id
  ),
  -- Jours du mois où une règle quota s'applique : plusieurs règles le même
  -- jour ne cumulent pas (la grille s'applique une fois par jour).
  jours_actifs as (
    select u.user_id, g.jour::date as jour
    from (select distinct user_id from regles) u
    cross join mois m
    cross join lateral generate_series(m.debut, m.fin, interval '1 day') as g(jour)
    where exists (
      select 1 from routing_regles_du_jour(u.user_id, g.jour::date) r
      where r.mode = 'quota'
    )
  ),
  objectifs as (
    select j.user_id, sum(q.quota)::int as objectif_mensuel
    from jours_actifs j
    join routing_quota_canal q on q.jour_semaine = extract(dow from j.jour)::int
    group by j.user_id
  ),
  grille_mois as (
    select sum(q.quota)::int as objectif_mensuel
    from mois m
    cross join lateral generate_series(m.debut, m.fin, interval '1 day') as g(jour)
    join routing_quota_canal q on q.jour_semaine = extract(dow from g.jour)::int
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
    p.id, p.nom, p.email, p.employeur, ag.nom, m.debut,
    coalesce(pf.nb_portefeuille, 0)::int, coalesce(pf.nb_eligibles, 0)::int, coalesce(pl.nb_planifies, 0)::int,
    coalesce(vi.nb_visites, 0)::int, coalesce(vi.nb_perfect_store, 0)::int,
    coalesce(o.objectif_mensuel, gm.objectif_mensuel, 0),
    greatest(coalesce(o.objectif_mensuel, gm.objectif_mensuel, 0) - coalesce(vi.nb_visites, 0), 0)::int
  from profiles p
  join agences ag on ag.code = p.employeur
  cross join mois m
  cross join grille_mois gm
  left join portefeuille pf on pf.user_id = p.id
  left join objectifs o on o.user_id = p.id
  left join planifies pl on pl.user_id = p.id
  left join visitees vi on vi.user_id = p.id
  where p.role = 'merchandiser' and coalesce(p.is_active, true)
  order by p.nom
$$;

comment on function public.programme_merchandiser(date, text) is
  'Programme merchandiser d''un mois pour une direction (south, north ; null = toutes) : par merchandiser des agences « programme », portefeuille, éligibles, planifiés, visités, perfect store, objectif (grille des quotas × jours de tournée) et reste à visiter.';

grant execute on function public.programme_merchandiser(date, text) to authenticated;

-- Compatibilité : même signature et mêmes colonnes qu'avant (la vue
-- v_programme_atom en dépend et n'est pas recréée).
create or replace function public.programme_atom(p_mois date default current_date)
returns table (
  user_id uuid, nom text, email text, mois date,
  nb_portefeuille integer, nb_eligibles integer, nb_planifies integer,
  nb_visites integer, nb_perfect_store integer, objectif_mensuel integer, reste_a_visiter integer
)
language sql
stable
set search_path = public
as $$
  select x.user_id, x.nom, x.email, x.mois, x.nb_portefeuille, x.nb_eligibles, x.nb_planifies,
         x.nb_visites, x.nb_perfect_store, x.objectif_mensuel, x.reste_a_visiter
  from public.programme_merchandiser(p_mois, 'south') x
$$;

comment on function public.programme_atom(date) is
  'Ancien nom de programme_merchandiser(date, ''south'') (Programme merchandiser South), gardé pour compatibilité.';

commit;
