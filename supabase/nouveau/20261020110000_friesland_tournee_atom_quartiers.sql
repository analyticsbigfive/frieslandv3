-- ============================================================================
-- TOURNÉES ATOM PAR QUARTIER (règle de Jean Luc du 20/10/2026)
--
-- À APPLIQUER SEULEMENT APRÈS :
--   1. 20261020100000_friesland_validation_tournee.sql ;
--   2. l'import des PDV Atom (node scripts/importer-pdv-atom.mjs --apply) ;
--   3. la relecture des chiffres par Jean Luc et son accord explicite.
-- Puis recalculer les tournées à venir des merchandisers Atom (fin du fichier).
--
-- Un jour Atom qui a une ligne de routing avec un point de visite :
--   - PDV possibles = PDV Atom du distributeur de la ligne, rangés chez ce
--     merchandiser : d'abord le quartier du point de visite, puis les
--     quartiers voisins du plus proche au plus loin (atom_pdv_possibles) ;
--   - on retire ceux déjà prévus ou visités ce mois-ci (une fois par mois) ;
--   - quotas par type (routing_quota_canal), un type manquant est remplacé par
--     des boutiques. Plus de rayon de 500 m ni de complément à 1,5 km, plus de
--     sous-zone SSF ni de portefeuille DMS pour ces jours-là.
-- Les autres jours (5e semaine, ligne sans point) et les autres merchandisers
-- gardent le calcul précédent, renommé etapes_quota_du_jour_avant_quartiers.
--
-- Retour arrière :
--   drop function public.etapes_quota_du_jour(uuid, date);
--   alter function public.etapes_quota_du_jour_avant_quartiers(uuid, date) rename to etapes_quota_du_jour;
-- Idempotente.
-- ============================================================================
begin;

do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'etapes_quota_du_jour_avant_quartiers') then
    alter function public.etapes_quota_du_jour(uuid, date) rename to etapes_quota_du_jour_avant_quartiers;
  end if;
end $$;

create or replace function public.etapes_quota_atom_quartiers(p_user_id uuid, p_date date)
returns table (pdv_id text, ordre integer, canal text, objectifs jsonb)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_debut date := date_trunc('month', p_date)::date;
  v_fin   date := (date_trunc('month', p_date) + interval '1 month - 1 day')::date;
  v_dow   integer := extract(dow from p_date)::int;
  v_ligne uuid;
  v_q record;
  v_pris integer;
  v_deficit integer := 0;
begin
  -- Même garde que plan_mensuel_atom : soi-même, admin / superviseur, ou
  -- l'agence pour ses merchandisers ; le cron et le serveur (auth.uid() nul) aussi.
  if auth.uid() is not null and auth.uid() <> p_user_id
     and not exists (select 1 from profiles me where me.id = auth.uid() and me.role in ('admin', 'superviseur'))
     and p_user_id not in (select merch_ids_agence()) then
    raise exception 'etapes_quota_atom_quartiers : accès refusé' using errcode = '42501';
  end if;

  select r.id into v_ligne
  from routing_mensuel r
  join profiles m on m.id = r.merchandiser_id and m.employeur = 'atom'
  where r.merchandiser_id = p_user_id and r.actif
    and r.jour_semaine = v_dow and r.semaine_du_mois = semaine_routing(p_date)
    and r.latitude is not null and r.longitude is not null
  limit 1;
  if v_ligne is null then
    return;
  end if;

  create temp table if not exists _cand_atom (
    pdv_id text, canal text, rang integer, pris boolean default false
  ) on commit drop;
  truncate _cand_atom;

  insert into _cand_atom (pdv_id, canal, rang)
  select c.pdv_id, c.canal, c.rang
  from atom_pdv_possibles(v_ligne) c
  where not exists (
      select 1 from routing_pdv rp join routings rt on rt.id = rp.routing_id
      where rt.user_id = p_user_id and rt.date_routing between v_debut and v_fin
        and rt.status <> 'cancelled' and rp.pdv_id = c.pdv_id)
    and not exists (
      select 1 from visites v
      where v.user_id = p_user_id and v.pdv_id = c.pdv_id
        and v.date_visite >= v_debut and v.date_visite < v_fin + 1);

  for v_q in select qc.canal, qc.quota from routing_quota_canal qc where qc.jour_semaine = v_dow loop
    update _cand_atom c set pris = true
    where c.pdv_id in (
      select c2.pdv_id from _cand_atom c2
      where c2.canal = v_q.canal and not c2.pris
      order by c2.rang limit v_q.quota);
    get diagnostics v_pris = row_count;
    v_deficit := v_deficit + v_q.quota - v_pris;
  end loop;

  -- Un type manquant est remplacé par des boutiques (NB du client).
  if v_deficit > 0 then
    update _cand_atom c set pris = true
    where c.pdv_id in (
      select c2.pdv_id from _cand_atom c2
      where c2.canal = 'Boutique' and not c2.pris
      order by c2.rang limit v_deficit);
  end if;

  return query
    select c.pdv_id, c.rang, c.canal, jsonb_build_object('releve_stock', true, 'photos', true)
    from _cand_atom c where c.pris order by c.rang;
end;
$$;

create or replace function public.etapes_quota_du_jour(p_user_id uuid, p_date date)
returns table (pdv_id text, ordre integer, canal text, objectifs jsonb)
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from routing_mensuel r
    join profiles m on m.id = r.merchandiser_id and m.employeur = 'atom'
    where r.merchandiser_id = p_user_id and r.actif
      and r.jour_semaine = extract(dow from p_date)::int
      and r.semaine_du_mois = semaine_routing(p_date)
      and r.latitude is not null and r.longitude is not null
  ) then
    return query select * from etapes_quota_atom_quartiers(p_user_id, p_date);
  else
    return query select * from etapes_quota_du_jour_avant_quartiers(p_user_id, p_date);
  end if;
end;
$$;

-- Droits : etapes_quota_du_jour garde ceux d'avant (exécutable par tous, en
-- droits de l'appelant) ; la sélection Atom lit atom_pdv_possibles, réservée
-- au serveur, donc elle s'exécute en droits du propriétaire.
revoke all on function public.etapes_quota_atom_quartiers(uuid, date) from public, anon;
grant execute on function public.etapes_quota_atom_quartiers(uuid, date) to authenticated, service_role;
grant execute on function public.etapes_quota_du_jour(uuid, date) to public, anon, authenticated, service_role;

commit;

-- Après application, recalculer les tournées à venir des merchandisers Atom :
--   select p.nom, recalculer_tournees_a_venir(p.id, 7)
--   from profiles p where p.employeur = 'atom' and p.role = 'merchandiser' and p.is_active;
