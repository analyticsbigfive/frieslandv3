-- ============================================================================
-- PROGRAMME ATOM : OBJECTIF MENSUEL CALCULÉ SUR LA GRILLE DES QUOTAS
--
-- v_programme_atom affichait un objectif fixe de 420 PDV/agent/mois. La grille
-- (routing_quota_canal) donne 105 PDV par semaine lundi → samedi : un mois de
-- 4 semaines pleines fait 420, mais octobre 2026 (5 jeudis, vendredis et
-- samedis) en fait 465. Décision du 06/10 : l'objectif suit la grille, jour
-- par jour, comme l'écran mobile « Mes objectifs » (utils/objectifsAtom.ts).
--
-- objectif_mensuel = somme, sur les jours du mois où au moins une règle
-- mode = 'quota' de l'agent s'applique (routing_regles_du_jour : active, jour
-- de semaine, dates de début / fin, pas suspendue en entier), du quota de la
-- grille pour ce jour de semaine. Un agent Atom sans règle quota a 0.
--
-- Mêmes colonnes qu'avant (types alignés : integer). Idempotent.
-- ============================================================================
begin;

drop view if exists public.v_programme_atom;
create view public.v_programme_atom with (security_invoker = true) as
with regles as (
  select t.user_id, t.id as template_id
  from routing_templates t
  join profiles p on p.id = t.user_id
  where p.employeur = 'atom' and t.mode = 'quota' and coalesce(t.is_active, true)
),
mois as (
  select date_trunc('month', current_date)::date as debut,
         (date_trunc('month', current_date) + interval '1 month - 1 day')::date as fin
),
portefeuille as (
  select r.user_id, count(distinct tp.pdv_id) as nb_portefeuille,
         count(distinct tp.pdv_id) filter (where canal_atom(p.sous_categorie_pdv) is not null) as nb_eligibles
  from regles r
  join routing_template_pdv tp on tp.template_id = r.template_id
  join pdv p on p.pdv_id = tp.pdv_id
  group by r.user_id
),
-- Jours du mois où une règle quota s'applique : plusieurs règles le même jour
-- ne cumulent pas (etapes_quota_du_jour applique la grille une fois par jour).
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
  p.id as user_id,
  p.nom,
  p.email,
  m.debut as mois,
  coalesce(pf.nb_portefeuille, 0) as nb_portefeuille,
  coalesce(pf.nb_eligibles, 0)    as nb_eligibles,
  coalesce(pl.nb_planifies, 0)    as nb_planifies,
  coalesce(vi.nb_visites, 0)      as nb_visites,
  coalesce(vi.nb_perfect_store, 0) as nb_perfect_store,
  coalesce(o.objectif_mensuel, 0) as objectif_mensuel,
  greatest(coalesce(o.objectif_mensuel, 0) - coalesce(vi.nb_visites, 0), 0)::int as reste_a_visiter
from profiles p
cross join mois m
left join portefeuille pf on pf.user_id = p.id
left join objectifs o on o.user_id = p.id
left join planifies pl on pl.user_id = p.id
left join visitees vi on vi.user_id = p.id
where p.employeur = 'atom' and p.role = 'merchandiser' and coalesce(p.is_active, true)
order by p.nom;

grant select on public.v_programme_atom to authenticated;

commit;
