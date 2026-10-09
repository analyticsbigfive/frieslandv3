-- ============================================================================
-- ROUTING MENSUEL : LIEUX PAR COMMUNE, JOURNÉE COMPLÉTÉE PAR LE PORTEFEUILLE
--
-- À appliquer APRÈS 20261008130000 (routing mensuel), AVANT le déploiement du
-- front qui écrit ces colonnes.
--
-- 1. routing_mensuel.commune : la commune de la case (colonne « Commune » du
--    fichier de l'agence, 09/10/2026). Un quartier introuvable dans la
--    commune donne une case au niveau de la commune : le portefeuille du
--    merchandiser dans cette commune, jamais ailleurs (« Kennedy 2 » d'Abobo
--    était parti à Daloa).
--    routing_mensuel.lieux : les quartiers exacts de la case, « ZONE›QUARTIER »
--    (zone et quartier tels que dans les PDV). Source des règles quand l'admin
--    corrige une case ; zone / quartiers restent pour l'affichage.
-- 2. etapes_quota_du_jour : 3e source de candidats après la sous-zone du SSF,
--    les PDV des règles de REPLI (portefeuille) du merchandiser, d'abord ceux
--    des zones déjà retenues ce jour-là. Une case trop petite (Pangolin :
--    1 PDV ; Ananeraie : 2 restants dans le mois) est complétée au lieu de
--    donner une tournée vide ou de 2 PDV. Le reste de la fonction est
--    inchangé (définition de production du 09/10/2026).
--
-- Idempotent.
-- ============================================================================
begin;

alter table public.routing_mensuel add column if not exists commune text;
alter table public.routing_mensuel add column if not exists lieux text[] not null default '{}';

comment on column public.routing_mensuel.commune is
  'Commune de la case (fichier de l''agence). Sans lieu reconnu : la tournée prend le portefeuille du merchandiser dans cette commune.';
comment on column public.routing_mensuel.lieux is
  'Quartiers exacts de la case, « ZONE›QUARTIER » (libellés des PDV). Vide : niveau commune, sinon portefeuille.';

-- Cases existantes : leurs quartiers dans leur zone.
update public.routing_mensuel rm
set lieux = coalesce((
  select array_agg(distinct p.zone || '›' || p.quartier order by p.zone || '›' || p.quartier)
  from public.pdv p
  where p.zone = rm.zone and p.quartier = any (rm.quartiers)
), '{}')
where cardinality(rm.lieux) = 0 and rm.zone is not null and cardinality(rm.quartiers) > 0;

create or replace function public.etapes_quota_du_jour(p_user_id uuid, p_date date)
 returns table(pdv_id text, ordre integer, canal text, objectifs jsonb)
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_debut_mois date := date_trunc('month', p_date)::date;
  v_fin_mois   date := (date_trunc('month', p_date) + interval '1 month - 1 day')::date;
  v_dow        integer := extract(dow from p_date)::int;
  v_deficit    integer := 0;
  v_zones      text[];
  -- pas « r » : plpgsql substituerait la variable à l'alias r des requêtes.
  v_q record;
begin
  create temp table if not exists _candidats (
    pdv_id text, ordre integer, canal text, objectifs jsonb, pris boolean default false
  ) on commit drop;
  truncate _candidats;

  -- 1. Portefeuille des règles quota du jour.
  insert into _candidats (pdv_id, ordre, canal, objectifs)
  select distinct on (tp.pdv_id)
    tp.pdv_id,
    row_number() over (order by r.created_at, tp.position_order)::int,
    canal_atom(p.sous_categorie_pdv),
    coalesce(tp.objectifs, '{}'::jsonb)
  from routing_regles_du_jour(p_user_id, p_date) r
  join routing_template_pdv tp on tp.template_id = r.id
  join pdv p on p.pdv_id = tp.pdv_id
  where r.mode = 'quota'
    and coalesce(p.is_active, true)
    and canal_atom(p.sous_categorie_pdv) is not null
    and not exists (
      select 1 from routing_template_exception e
      where e.template_id = r.id and e.pdv_id = tp.pdv_id
        and p_date between e.date_debut and e.date_fin
    )
    and not exists (
      select 1
      from routing_pdv rp
      join routings rt on rt.id = rp.routing_id
      where rt.user_id = p_user_id
        and rt.date_routing between v_debut_mois and v_fin_mois
        and rt.status <> 'cancelled'
        and rp.pdv_id = tp.pdv_id
    )
    and not exists (
      select 1 from visites v
      where v.user_id = p_user_id
        and v.pdv_id = tp.pdv_id
        and v.date_visite >= v_debut_mois
        and v.date_visite < v_fin_mois + 1
    )
  order by tp.pdv_id, r.created_at, tp.position_order;

  -- 2. Sous-zone du SSF des règles du jour : PDV pas encore candidats, après
  --    le portefeuille (ordre ≥ 50000), regroupés par quartier.
  insert into _candidats (pdv_id, ordre, canal, objectifs)
  select distinct on (p.pdv_id)
    p.pdv_id,
    50000 + row_number() over (
      order by r.created_at, sq.zone, sq.quartier, p.geolocation_lat nulls last, p.geolocation_lng nulls last, p.pdv_id
    )::int,
    canal_atom(p.sous_categorie_pdv),
    jsonb_build_object('releve_stock', true, 'photos', true)
  from routing_regles_du_jour(p_user_id, p_date) r
  join ssf_quartier sq on sq.ssf_id = r.ssf_id
  join pdv p on p.zone = sq.zone and p.quartier = sq.quartier
  where r.mode = 'quota'
    and r.ssf_id is not null
    and coalesce(p.is_active, true)
    and canal_atom(p.sous_categorie_pdv) is not null
    and not exists (select 1 from _candidats c where c.pdv_id = p.pdv_id)
    and not exists (
      select 1 from routing_template_exception e
      where e.template_id = r.id and e.pdv_id = p.pdv_id
        and p_date between e.date_debut and e.date_fin
    )
    and not exists (
      select 1
      from routing_pdv rp
      join routings rt on rt.id = rp.routing_id
      where rt.user_id = p_user_id
        and rt.date_routing between v_debut_mois and v_fin_mois
        and rt.status <> 'cancelled'
        and rp.pdv_id = p.pdv_id
    )
    and not exists (
      select 1 from visites v
      where v.user_id = p_user_id
        and v.pdv_id = p.pdv_id
        and v.date_visite >= v_debut_mois
        and v.date_visite < v_fin_mois + 1
    )
  order by p.pdv_id, r.created_at;

  -- 3. Portefeuille (règles de repli) : complète une journée que la case et
  --    le SSF ne remplissent pas (ordre ≥ 100000), d'abord dans les zones déjà
  --    retenues ce jour-là. Sans case ce jour-là, la règle de repli est déjà
  --    la règle du jour : rien de plus n'est ajouté.
  select coalesce(array_agg(distinct x.zone), '{}') into v_zones
  from _candidats c join pdv x on x.pdv_id = c.pdv_id;

  insert into _candidats (pdv_id, ordre, canal, objectifs)
  select distinct on (p.pdv_id)
    p.pdv_id,
    100000 + row_number() over (
      order by (p.zone = any (v_zones)) desc, t.created_at, tp.position_order
    )::int,
    canal_atom(p.sous_categorie_pdv),
    coalesce(tp.objectifs, '{}'::jsonb)
  from routing_templates t
  join routing_template_pdv tp on tp.template_id = t.id
  join pdv p on p.pdv_id = tp.pdv_id
  where t.user_id = p_user_id
    and coalesce(t.is_active, true)
    and coalesce(t.repli, false)
    and t.mode = 'quota'
    and coalesce(t.days_of_week, array[t.day_of_week]) @> array[v_dow]
    and (t.date_debut is null or p_date >= t.date_debut)
    and (t.date_fin is null or p_date <= t.date_fin)
    and coalesce(p.is_active, true)
    and canal_atom(p.sous_categorie_pdv) is not null
    and not exists (select 1 from _candidats c where c.pdv_id = p.pdv_id)
    and not exists (
      select 1 from routing_template_exception e
      where e.template_id = t.id and (e.pdv_id = p.pdv_id or e.pdv_id is null)
        and p_date between e.date_debut and e.date_fin
    )
    and not exists (
      select 1
      from routing_pdv rp
      join routings rt on rt.id = rp.routing_id
      where rt.user_id = p_user_id
        and rt.date_routing between v_debut_mois and v_fin_mois
        and rt.status <> 'cancelled'
        and rp.pdv_id = p.pdv_id
    )
    and not exists (
      select 1 from visites v
      where v.user_id = p_user_id
        and v.pdv_id = p.pdv_id
        and v.date_visite >= v_debut_mois
        and v.date_visite < v_fin_mois + 1
    )
  order by p.pdv_id, t.created_at, tp.position_order;

  -- Quota par canal, dans l'ordre (case, sous-zone du SSF, puis portefeuille).
  for v_q in select q.canal, q.quota from routing_quota_canal q where q.jour_semaine = v_dow loop
    update _candidats c set pris = true
    where c.pdv_id in (
      select c2.pdv_id from _candidats c2
      where c2.canal = v_q.canal and not c2.pris
      order by c2.ordre limit v_q.quota
    );
    v_deficit := v_deficit + v_q.quota - (select count(*) from _candidats c3 where c3.canal = v_q.canal and c3.pris);
  end loop;

  -- Complément en boutiques (NB du client).
  if v_deficit > 0 then
    update _candidats c set pris = true
    where c.pdv_id in (
      select c2.pdv_id from _candidats c2
      where c2.canal = 'Boutique' and not c2.pris
      order by c2.ordre limit v_deficit
    );
  end if;

  return query
    select c.pdv_id, c.ordre, c.canal, c.objectifs
    from _candidats c where c.pris order by c.ordre;
end;
$function$;

commit;
