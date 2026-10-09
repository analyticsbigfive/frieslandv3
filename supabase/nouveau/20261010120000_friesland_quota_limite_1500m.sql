-- ============================================================================
-- TOURNÉES : COMPLÉMENTS LIMITÉS À 1,5 KM DU LIEU DU JOUR (décision du 09/10/2026)
--
-- Contrôle des tournées du 10 au 16/10 (import des points GPS) : 82 % des PDV
-- à moins de 500 m du point, mais 62 à plus de 1,5 km (jusqu'à 4 km). Presque
-- tous des canaux rares (pushcart, supérette, aboki, porridge) : pour remplir
-- le quota d'un canal, la tournée allait chercher le plus proche dans la
-- sous-zone du SSF (42) ou le portefeuille (20), même loin, au lieu d'une
-- boutique voisine.
--
-- Décision de l'utilisateur : au-delà de 1,5 km du lieu du jour, un PDV de la
-- sous-zone du SSF ou du portefeuille ne sert plus au quota d'un canal ; une
-- boutique proche le remplace (NB du client). Si le quota du jour n'est
-- toujours pas atteint, la tournée est complétée par les plus proches au-delà
-- de 1,5 km, boutiques d'abord : le quota reste atteint (NB du client).
-- Le lieu du jour = centre des PDV des règles du jour (point GPS de la case).
-- Les PDV des règles du jour ne sont jamais limités ; sans lieu connu (aucun
-- PDV géolocalisé dans les règles du jour), rien ne change.
--
-- Reprend 20261009140000 (complément au plus près). Idempotent.
-- ============================================================================
begin;

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
  v_reste      integer := 0;
  v_lat        double precision;
  v_lng        double precision;
  -- Distance maximale (m) d'un complément au lieu du jour.
  v_rayon_max  constant double precision := 1500;
  -- pas « r » : plpgsql substituerait la variable à l'alias r des requêtes.
  v_q record;
begin
  create temp table if not exists _candidats (
    pdv_id text, ordre integer, canal text, objectifs jsonb, pris boolean default false,
    dist double precision, loin boolean default false
  ) on commit drop;
  truncate _candidats;

  -- Lieu du jour : centre des PDV des règles du jour (même déjà visités).
  select avg(x.geolocation_lat), avg(x.geolocation_lng) into v_lat, v_lng
  from routing_regles_du_jour(p_user_id, p_date) r
  join routing_template_pdv tp on tp.template_id = r.id
  join pdv x on x.pdv_id = tp.pdv_id
  where not coalesce(r.repli, false)
    and x.geolocation_lat is not null and x.geolocation_lng is not null;

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
  insert into _candidats (pdv_id, ordre, canal, objectifs, dist)
  select distinct on (p.pdv_id)
    p.pdv_id,
    50000 + row_number() over (
      order by r.created_at, sq.zone, sq.quartier, p.geolocation_lat nulls last, p.geolocation_lng nulls last, p.pdv_id
    )::int,
    canal_atom(p.sous_categorie_pdv),
    jsonb_build_object('releve_stock', true, 'photos', true),
    case when v_lat is not null and p.geolocation_lat is not null and p.geolocation_lng is not null
      then sqrt(power((p.geolocation_lat - v_lat) * 110540, 2) + power((p.geolocation_lng - v_lng) * 111320 * cos(radians(v_lat)), 2)) end
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
  --    le SSF ne remplissent pas, AU PLUS PRÈS du lieu du jour (ordre ≥ 100000,
  --    du plus proche au plus loin). Sans case ce jour-là, la règle de repli
  --    est déjà la règle du jour : rien de plus n'est ajouté.
  insert into _candidats (pdv_id, ordre, canal, objectifs, dist)
  select distinct on (p.pdv_id)
    p.pdv_id,
    100000 + row_number() over (
      order by
        case when v_lat is null or p.geolocation_lat is null then 1 else 0 end,
        case when v_lat is null or p.geolocation_lat is null then 0
             else power(p.geolocation_lat - v_lat, 2) + power((p.geolocation_lng - v_lng) * cos(radians(v_lat)), 2) end,
        t.created_at, tp.position_order
    )::int,
    canal_atom(p.sous_categorie_pdv),
    coalesce(tp.objectifs, '{}'::jsonb),
    case when v_lat is not null and p.geolocation_lat is not null and p.geolocation_lng is not null
      then sqrt(power((p.geolocation_lat - v_lat) * 110540, 2) + power((p.geolocation_lng - v_lng) * 111320 * cos(radians(v_lat)), 2)) end
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

  -- Complément loin du lieu du jour (au-delà de 1,5 km, ou sans position) :
  -- seulement en dernier recours. Les PDV des règles du jour ne sont jamais loin.
  if v_lat is not null then
    update _candidats c set loin = true
    where c.ordre >= 50000 and (c.dist is null or c.dist > v_rayon_max);
  end if;

  -- Quota par canal, dans l'ordre (case, sous-zone du SSF, puis portefeuille le plus proche).
  for v_q in select q.canal, q.quota from routing_quota_canal q where q.jour_semaine = v_dow loop
    update _candidats c set pris = true
    where c.pdv_id in (
      select c2.pdv_id from _candidats c2
      where c2.canal = v_q.canal and not c2.pris and not c2.loin
      order by c2.ordre limit v_q.quota
    );
    v_deficit := v_deficit + v_q.quota - (select count(*) from _candidats c3 where c3.canal = v_q.canal and c3.pris);
  end loop;

  -- Complément en boutiques proches (NB du client).
  if v_deficit > 0 then
    update _candidats c set pris = true
    where c.pdv_id in (
      select c2.pdv_id from _candidats c2
      where c2.canal = 'Boutique' and not c2.pris and not c2.loin
      order by c2.ordre limit v_deficit
    );
  end if;

  -- Quota du jour toujours atteint (NB du client) : au besoin, les plus proches
  -- au-delà de 1,5 km, boutiques d'abord.
  v_reste := coalesce((select sum(q.quota) from routing_quota_canal q where q.jour_semaine = v_dow), 0)
           - (select count(*) from _candidats c where c.pris);
  if v_reste > 0 then
    update _candidats c set pris = true
    where c.pdv_id in (
      select c2.pdv_id from _candidats c2
      where not c2.pris and c2.loin
      order by (c2.canal <> 'Boutique'), c2.dist nulls last, c2.ordre
      limit v_reste
    );
  end if;

  return query
    select c.pdv_id, c.ordre, c.canal, c.objectifs
    from _candidats c where c.pris order by c.ordre;
end;
$function$;

commit;
