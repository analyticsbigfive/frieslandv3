-- Perfect Store › Agences (05/11/2026) : récap de l'atteinte du Perfect Store
-- par agence (employeur du merchandiser auteur de la visite), demandé en
-- réunion avec Friesland.
--
-- Mêmes filtres et même base de comptage que dashboard_perfect_store_filtre :
-- PDV distincts, dernière visite scorée de la période. Ici la dernière visite
-- est prise PAR AGENCE : un PDV vu par deux agences compte une fois dans
-- chacune. Sans double compte, la somme des agences retrouve la vue d'ensemble
-- (vérifié du 12/10 au 05/11 : 1 538 PDV évalués, 2 au standard, dispo 42,2 %).
--
-- L'agence vient de profiles.employeur de l'auteur (visites.user_id, ou
-- l'e-mail pour les visites d'avant le 31/08 sans user_id). Auteur introuvable
-- = ligne « Auteur inconnu ».
--
-- « PDV sans seuil » : dernière visite sans disponibilité calculable (type de
-- PDV sans seuil de disponibilité, ex. Superettes C). « Visites sans relevé » :
-- visites sans résultat Perfect Store (ni produits ni visibilité saisis).
--
-- SECURITY INVOKER : les règles d'accès de l'appelant s'appliquent.

create or replace function public.perfect_store_par_agence_filtre(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_date_debut date default null,
  p_date_fin date default null
)
returns table (
  agence_code text,
  agence_nom text,
  merchandisers integer,
  visites integer,
  pdv_visites integer,
  pdv_evalues integer,
  pdv_perfect_store integer,
  perfect_store_pct numeric,
  par_niveau jsonb,
  dispo_moyenne_pct numeric,
  visibilite_moyenne_pct numeric,
  score_moyen_pct numeric,
  pdv_sans_seuil integer,
  visites_sans_releve integer
)
language sql
stable
set search_path to 'public'
set work_mem to '16MB'
as $$
  with pdv_scope as (
    select p.pdv_id
    from pdv p
    where (p_territoire is null or p_territoire = '' or p.zone = p_territoire)
      and (p_area is null or p_area = '' or p.area_code = p_area or p.quartier = p_area)
      and (p_distributeur is null or p_distributeur = '' or p.distributor_name = p_distributeur)
      and (p_division is null or p_division = '' or exists (
            select 1
            from territoire t
            join sous_region sr on sr.code = t.sous_region_code
            join region rg on rg.code = sr.region_code
            where t.nom = p.zone and rg.nom_affichage = p_division))
  ),
  visites_scope as (
    select v.id, v.pdv_id, v.date_visite, coalesce(v.user_id, pe.id) as auteur_id
    from visites v
    left join lateral (
      select p2.id from profiles p2
      where v.user_id is null and v.email is not null and lower(p2.email) = lower(v.email)
      limit 1
    ) pe on true
    where v.date_visite >= coalesce(p_date_debut::timestamptz, '-infinity'::timestamptz)
      and v.date_visite < coalesce((p_date_fin + 1)::timestamptz, 'infinity'::timestamptz)
      and exists (select 1 from pdv_scope s where s.pdv_id = v.pdv_id)
  ),
  avec_agence as (
    select vs.*, coalesce(pr.employeur, '(inconnue)') as agence
    from visites_scope vs
    left join profiles pr on pr.id = vs.auteur_id
  ),
  scored as (
    select a.agence, a.pdv_id, a.date_visite, r.niveau, r.dispo_rayon, r.visibilite,
           r.score_global, r.calcule_le
    from resultat_perfect_store r
    join avec_agence a on a.id = r.visite_id
  ),
  dernier as (
    select distinct on (s.agence, s.pdv_id) s.*
    from scored s
    order by s.agence, s.pdv_id, s.date_visite desc, s.calcule_le desc
  ),
  agences as (
    select ag.code, ag.nom, ag.ordre
    from agence ag
    where ag.actif or exists (select 1 from avec_agence a where a.agence = ag.code)
    union all
    select '(inconnue)', 'Auteur inconnu', 9999
    where exists (select 1 from avec_agence a where a.agence = '(inconnue)')
  )
  select
    ag.code,
    ag.nom,
    (select count(distinct a.auteur_id) from avec_agence a where a.agence = ag.code)::int,
    (select count(*) from avec_agence a where a.agence = ag.code)::int,
    (select count(distinct a.pdv_id) from avec_agence a where a.agence = ag.code)::int,
    (select count(*) from dernier d where d.agence = ag.code)::int,
    (select count(*) filter (where d.niveau is not null) from dernier d where d.agence = ag.code)::int,
    (select round(100.0 * count(*) filter (where d.niveau is not null) / nullif(count(*), 0), 1)
       from dernier d where d.agence = ag.code),
    (select coalesce(jsonb_agg(jsonb_build_object('niveau', n.code, 'nb_pdv', (
        select count(*) from dernier d where d.agence = ag.code and d.niveau = n.code
      )) order by n.rang desc nulls last, n.code), '[]'::jsonb)
       from niveau_perfect_store n),
    (select round(avg(d.dispo_rayon), 1) from dernier d where d.agence = ag.code),
    (select round(avg(d.visibilite), 1) from dernier d where d.agence = ag.code),
    (select round(avg(d.score_global), 1) from dernier d where d.agence = ag.code),
    (select count(*) filter (where d.dispo_rayon is null) from dernier d where d.agence = ag.code)::int,
    (select count(*) from avec_agence a
      where a.agence = ag.code
        and not exists (select 1 from resultat_perfect_store r where r.visite_id = a.id))::int
  from agences ag
  order by ag.ordre, ag.nom;
$$;

comment on function public.perfect_store_par_agence_filtre(text, text, text, text, date, date) is
  'Perfect Store › Agences : par agence (employeur de l''auteur), PDV distincts, dernière visite scorée de la période par agence. Mêmes filtres que dashboard_perfect_store_filtre.';

grant execute on function public.perfect_store_par_agence_filtre(text, text, text, text, date, date) to authenticated;
