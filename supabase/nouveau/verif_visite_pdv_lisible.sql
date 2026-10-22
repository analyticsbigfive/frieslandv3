-- ============================================================================
-- VÉRIFICATION de 20261022140000_friesland_visite_pdv_lisible.sql
-- Ne modifie rien : chaque bloc se termine par un RAISE qui annule tout et
-- affiche le résultat dans le message d'erreur.
--
-- 1. Mesure : visites faites avec l'app ces 60 derniers jours qui seraient
--    refusées, par rôle et employeur (PDV lus avec les règles d'aujourd'hui,
--    sans le choix B).
-- 2. Tests : la migration est recréée dans le bloc, puis on se connecte comme
--    Deheo (merchandiser Atom), un merchandiser Friesland, un admin, un
--    superviseur et la clé service (request.jwt.claims + set local role).
--    Avec le choix B (PDV déjà visités avant le contrôle, liste figée).
--    Résultat du 22/10/2026 : tous les cas OK (voir la PR).
-- 3. Tests du correctif 20261022141000 (date de la visite), même principe.
-- Les identifiants de comptes sont ceux de la production au 22/10/2026.
-- ============================================================================

-- 1. Mesure ------------------------------------------------------------------
do $$
declare
  u record;
  res jsonb;
  det jsonb;
begin
  create temp table m_vis on commit drop as
  select v.id, v.visite_id, v.user_id, v.pdv_id, v.date_visite,
         (v.date_visite at time zone 'Africa/Abidjan')::date as jour
  from visites v
  where v.date_visite >= current_date - 60 and v.pdv_id is not null and v.user_id is not null
    and v.visite_id not like 'ATOM-%';
  create temp table m_per (user_id uuid, pdv_id text) on commit drop;

  for u in select distinct user_id from m_vis loop
    perform set_config('request.jwt.claims', json_build_object('sub', u.user_id, 'role', 'authenticated')::text, true);
    insert into m_per select u.user_id, x from public.pdv_ids_perimetre() x
      where x in (select pdv_id from m_vis where user_id = u.user_id);
  end loop;
  perform set_config('request.jwt.claims', '', true);

  create temp table m_res on commit drop as
  select mv.*, pr.role, pr.employeur, pr.is_active, pr.nom,
    coalesce(pr.role in ('admin','superviseur') and pr.is_active, false) as exempt,
    exists (select 1 from m_per p where p.user_id = mv.user_id and p.pdv_id = mv.pdv_id) as a_perimetre,
    exists (select 1 from pdv p where p.pdv_id = mv.pdv_id and p.created_by = mv.user_id) as b_cree,
    (exists (select 1 from routings r join routing_pdv rp on rp.routing_id = r.id
             where r.user_id = mv.user_id and rp.pdv_id = mv.pdv_id
               and r.date_routing >= case when (pr.role = 'merchandiser' and pr.employeur = 'atom' and coalesce(pr.email,'') not like '%@friesland-test.ci') then current_date - 1 else current_date - 60 end)
     or (not (pr.role = 'merchandiser' and pr.employeur = 'atom' and coalesce(pr.email,'') not like '%@friesland-test.ci')
         and exists (select 1 from routing_templates t join routing_template_pdv tp on tp.template_id = t.id
                     where t.user_id = mv.user_id and t.is_active and tp.pdv_id = mv.pdv_id))) as c_tournee,
    (mv.jour >= current_date - 15 and exists (
       select 1 from routings r join routing_pdv rp on rp.routing_id = r.id
       where r.user_id = mv.user_id and rp.pdv_id = mv.pdv_id
         and r.date_routing between mv.jour - 1 and mv.jour)) as d_jour,
    exists (select 1 from visites v2 where v2.user_id = mv.user_id and v2.pdv_id = mv.pdv_id
            and v2.date_visite < mv.date_visite and v2.date_visite >= mv.date_visite - interval '60 days') as e_revisite
  from m_vis mv left join profiles pr on pr.id = mv.user_id;

  select jsonb_agg(x) into res from (
    select role, employeur, is_active, count(*) visites, count(distinct user_id) merchs,
      count(*) filter (where not exempt and not (a_perimetre or b_cree or c_tournee or d_jour)) refusees,
      count(*) filter (where not exempt and not (a_perimetre or b_cree or c_tournee)) refusees_sans_jour_de_visite,
      count(*) filter (where not exempt and not (a_perimetre or b_cree or c_tournee or d_jour) and e_revisite) dont_revisite
    from m_res group by 1,2,3 order by 1,2,3) x;

  select jsonb_agg(y) into det from (
    select nom, is_active, jour, count(*) n, string_agg(distinct pdv_id, ',') pdvs
    from m_res where not exempt and not (a_perimetre or b_cree or c_tournee or d_jour)
    group by 1,2,3 order by 3 desc, 1) y;

  raise exception 'MESURE %', jsonb_build_object('par_profil', res, 'detail', det);
end $$;

-- 2. Tests -------------------------------------------------------------------
do $test$
declare
  v_deheo uuid := '32c4977a-fd80-4c5a-b137-f10f18f174fc';
  v_assamoi uuid := '1f665fef-6b80-40c3-b2e9-b3bdbeb0d5f8'; -- ISMAEL KOUAKOU (Friesland)
  v_treich uuid := 'e256b890-5897-4ca2-8e72-f012e5a36f21';
  v_admin uuid := '0d6e7fa2-5945-4ca3-8e65-f1f6e17a0a9e';
  v_sup uuid := '4326e592-2c3f-43e0-8d16-b473e5ddbaa6';
  p_liste text; p_liste2 text; p_push text; p_etr text; p_etr2 text; p_etr3 text; p_etr4 text; p_etr5 text;
  p_fr text; p_treich text; p_cree text; p_deja text;
  u record; arr text[]; n_tot int := 0; detail text := '';
  r7 uuid; r20 uuid;
  n int; msg text; t0 timestamptz; ms numeric;
  res text[] := '{}';
begin
  -- 0. Migration (annulée avec le reste par le RAISE final).
  execute $mig$

-- ---------------------------------------------------------------------------
-- 1. PDV déjà visités avant le contrôle (liste figée)
-- ---------------------------------------------------------------------------
create table if not exists public.visite_pdv_deja_visites (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  pdv_id   text not null references public.pdv(pdv_id) on delete cascade,
  jusqu_au date not null,
  primary key (user_id, pdv_id)
);
comment on table public.visite_pdv_deja_visites is
  'PDV visités avant le contrôle des visites (22/10/2026) : encore visitables jusqu''à jusqu_au (dernière visite + 60 jours). Liste figée.';
alter table public.visite_pdv_deja_visites enable row level security;
drop policy if exists visite_pdv_deja_visites_lecture on public.visite_pdv_deja_visites;
create policy visite_pdv_deja_visites_lecture on public.visite_pdv_deja_visites for select to authenticated
  using (public.est_admin_ou_superviseur());

-- Mêmes visites que la branche visites de pdv_ids_tournee : 60 derniers jours,
-- sans les visites importées ATOM-… pour un merchandiser Atom. Rempli une
-- seule fois (table vide), pour qu'un nouveau passage ne l'allonge pas.
insert into public.visite_pdv_deja_visites (user_id, pdv_id, jusqu_au)
select v.user_id, v.pdv_id, max((v.date_visite at time zone 'Africa/Abidjan')::date) + 60
from public.visites v
join public.profiles pr on pr.id = v.user_id
where v.pdv_id is not null and v.date_visite >= current_date - 60
  and not (pr.role = 'merchandiser' and pr.employeur = 'atom'
           and coalesce(pr.email, '') not like '%@friesland-test.ci'
           and v.visite_id like 'ATOM-%')
  and not exists (select 1 from public.visite_pdv_deja_visites)
group by v.user_id, v.pdv_id;

-- ---------------------------------------------------------------------------
-- 2. Le contrôle
-- ---------------------------------------------------------------------------
-- Vrai si l'agent connecté peut enregistrer une visite du jour p_jour sur ce PDV.
create or replace function public.peut_visiter_pdv(p_pdv_id text, p_jour date)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_atom boolean;
begin
  if v_uid is null then
    return false;
  end if;
  -- Même définition que pdv_ids_tournee et pdv_ids_perimetre.
  select coalesce(pr.role = 'merchandiser' and pr.employeur = 'atom'
                  and coalesce(pr.email, '') not like '%@friesland-test.ci', false)
  into v_atom
  from profiles pr where pr.id = v_uid and pr.is_active = true;
  v_atom := coalesce(v_atom, false);

  -- Du moins cher au plus cher ; s'arrête au premier trouvé.
  return exists (select 1 from pdv p where p.pdv_id = p_pdv_id and p.created_by = v_uid)
    -- Déjà visité avant le contrôle (choix B).
    or exists (select 1 from visite_pdv_deja_visites d
               where d.user_id = v_uid and d.pdv_id = p_pdv_id
                 and d.jusqu_au >= least(current_date, p_jour))
    -- Sa tournée du jour de la visite (synchronisée en retard).
    or (p_jour >= current_date - 15 and exists (
          select 1 from routings r
          join routing_pdv rp on rp.routing_id = r.id
          where r.user_id = v_uid and rp.pdv_id = p_pdv_id
            and r.date_routing between p_jour - 1 and p_jour))
    -- Ses tournées, comme pdv_ids_tournee sans les visites.
    or exists (
          select 1 from routings r
          join routing_pdv rp on rp.routing_id = r.id
          where r.user_id = v_uid and rp.pdv_id = p_pdv_id
            and r.date_routing >= case when v_atom then current_date - 1 else current_date - 60 end)
    or (not v_atom and exists (
          select 1 from routing_templates t
          join routing_template_pdv tp on tp.template_id = t.id
          where t.user_id = v_uid and t.is_active and tp.pdv_id = p_pdv_id))
    -- Son périmètre (territoires, ou sa liste pour un merchandiser Atom).
    or exists (select 1 from public.pdv_ids_perimetre() x where x = p_pdv_id);
end;
$$;

create or replace function public.visite_pdv_lisible()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Clé service (imports, cron) ou visite sans PDV.
  if auth.uid() is null or new.pdv_id is null then
    return new;
  end if;
  -- Le PDV ne change pas (photos, statut, rejeu de la même visite).
  if tg_op = 'UPDATE' and new.pdv_id is not distinct from old.pdv_id then
    return new;
  end if;
  -- Rejeu d'une visite déjà reçue : l'upsert passera par la mise à jour,
  -- contrôlée ci-dessus si le PDV change, et par visites_update.
  if tg_op = 'INSERT' and exists (select 1 from visites v where v.visite_id = new.visite_id) then
    return new;
  end if;
  if public.role_actif_courant() in ('admin', 'superviseur') then
    return new;
  end if;

  if public.peut_visiter_pdv(new.pdv_id, (new.date_visite at time zone 'Africa/Abidjan')::date) then
    return new;
  end if;

  raise exception 'Ce PDV n''est pas dans vos PDV : la visite n''est pas enregistrée (PDV %).', new.pdv_id
    using errcode = 'insufficient_privilege',
          hint = 'Choisissez un PDV de votre liste, ou créez le PDV sur place.';
end;
$$;

revoke all on function public.peut_visiter_pdv(text, date) from public, anon, authenticated;
grant execute on function public.peut_visiter_pdv(text, date) to service_role;
revoke all on function public.visite_pdv_lisible() from public, anon, authenticated;

drop trigger if exists trg_visite_pdv_lisible on public.visites;
create trigger trg_visite_pdv_lisible
  before insert or update of pdv_id on public.visites
  for each row execute function public.visite_pdv_lisible();
  $mig$;

  -- Jeu de test, lu comme Deheo.
  perform set_config('request.jwt.claims', json_build_object('sub', v_deheo, 'role', 'authenticated')::text, true);
  select q.pdv_id into p_liste from pdv_quartier_tournee q join pdv p on p.pdv_id = q.pdv_id
  where q.merchandiser_id = v_deheo and canal_atom(p.sous_categorie_pdv) = 'Boutique'
    and q.pdv_id in (select pdv_ids_perimetre())
    and not exists (select 1 from routing_pdv rp join routings r on r.id = rp.routing_id where r.user_id = v_deheo and rp.pdv_id = q.pdv_id and r.date_routing >= date_trunc('month', current_date))
    and not exists (select 1 from visites v where v.user_id = v_deheo and v.pdv_id = q.pdv_id)
  order by q.pdv_id limit 1;
  select q.pdv_id into p_liste2 from pdv_quartier_tournee q join pdv p on p.pdv_id = q.pdv_id
  where q.merchandiser_id = v_deheo and canal_atom(p.sous_categorie_pdv) = 'Boutique' and q.pdv_id <> p_liste
    and q.pdv_id in (select pdv_ids_perimetre())
    and not exists (select 1 from routing_pdv rp join routings r on r.id = rp.routing_id where r.user_id = v_deheo and rp.pdv_id = q.pdv_id and r.date_routing >= date_trunc('month', current_date))
    and not exists (select 1 from visites v where v.user_id = v_deheo and v.pdv_id = q.pdv_id)
  order by q.pdv_id limit 1;
  select q.pdv_id into p_push from pdv_quartier_tournee q join pdv p on p.pdv_id = q.pdv_id
  where q.merchandiser_id = v_deheo and canal_atom(p.sous_categorie_pdv) = 'Pushcart'
    and q.pdv_id in (select pdv_ids_perimetre())
    and not exists (select 1 from routing_pdv rp join routings r on r.id = rp.routing_id where r.user_id = v_deheo and rp.pdv_id = q.pdv_id and r.date_routing >= date_trunc('month', current_date))
  order by q.pdv_id limit 1;
  -- PDV que Deheo ne voit pas (zone Yopougon, liste d'un autre ou d'aucun).
  select array_agg(p.pdv_id order by p.pdv_id) into res
  from (select p.pdv_id from pdv p
        where p.zone ilike 'YOPOUGON%' and coalesce(p.is_active, true)
          and p.created_by is distinct from v_deheo
          and p.pdv_id not in (select pdv_ids_perimetre())
          and p.pdv_id not in (select pdv_ids_tournee())
          and not exists (select 1 from routing_pdv rp join routings r on r.id = rp.routing_id where r.user_id = v_deheo and rp.pdv_id = p.pdv_id)
          and not exists (select 1 from visites v where v.user_id = v_deheo and v.pdv_id = p.pdv_id)
        order by p.pdv_id limit 5) p;
  p_etr := res[1]; p_etr2 := res[2]; p_etr3 := res[3]; p_etr4 := res[4]; p_etr5 := res[5];
  res := array[format('jeu : liste=%s liste2=%s pushcart=%s étrangers=%s,%s,%s,%s,%s', p_liste, p_liste2, p_push, p_etr, p_etr2, p_etr3, p_etr4, p_etr5)];

  perform set_config('request.jwt.claims', json_build_object('sub', v_assamoi, 'role', 'authenticated')::text, true);
  select x into p_fr from pdv_ids_perimetre() x
  where x not in (select pdv_ids_tournee()) and not exists (select 1 from pdv p where p.pdv_id = x and p.created_by = v_assamoi)
  order by x limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_treich, 'role', 'authenticated')::text, true);
  select x into p_treich from pdv_ids_perimetre() x
  where x not in (select pdv_ids_tournee()) and not exists (select 1 from pdv p where p.pdv_id = x and p.created_by = v_treich)
  order by x desc limit 1;
  select count(*) into n from pdv_ids_perimetre();
  res := res || format('jeu : friesland=%s treichville=%s (périmètre %s PDV)', p_fr, p_treich, n);
  if p_liste is null or p_liste2 is null or p_push is null or p_etr5 is null or p_fr is null or p_treich is null then
    raise exception 'jeu incomplet : %', res;
  end if;

  -- T0b. Choix B : aucun PDV affiché (lisible) à un merchandiser actif n'est refusé.
  select count(*), count(distinct user_id) into n, ms from visite_pdv_deja_visites;
  res := res || format('T0b liste figée : %s PDV déjà visités, %s agents', n, ms);
  for u in select id, nom from profiles where role = 'merchandiser' and is_active order by nom loop
    perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    arr := array(select pdv_id from pdv);
    execute 'reset role';
    select count(*) into n from unnest(arr) x
    where x not in (select pdv_ids_perimetre()) and not peut_visiter_pdv(x, current_date);
    n_tot := n_tot + n;
    if n > 0 then detail := detail || format(' %s=%s', u.nom, n); end if;
  end loop;
  res := res || format('T0b PDV affichés mais refusés, tous merchandisers actifs = %s (attendu 0)%s', n_tot, detail);
  -- PDV que Deheo a visité avant le contrôle, hors de sa liste et de sa tournée.
  perform set_config('request.jwt.claims', json_build_object('sub', v_deheo, 'role', 'authenticated')::text, true);
  select d.pdv_id into p_deja from visite_pdv_deja_visites d join pdv p on p.pdv_id = d.pdv_id
  where d.user_id = v_deheo and d.jusqu_au >= current_date
    and p.created_by is distinct from v_deheo
    and d.pdv_id not in (select pdv_ids_perimetre())
    and not exists (select 1 from routing_pdv rp join routings r on r.id = rp.routing_id
                    where r.user_id = v_deheo and rp.pdv_id = d.pdv_id and r.date_routing >= current_date - 1)
  order by d.pdv_id limit 1;
  res := res || format('jeu : déjà visité par Deheo avant le contrôle = %s', p_deja);
  if p_deja is null then raise exception 'jeu incomplet : %', res; end if;

  -- Tournées passées de Deheo (il y a 7 et 20 jours) avec un PDV qu'il ne voit pas.
  perform set_config('request.jwt.claims', '', true);
  select id into r7 from routings where user_id = v_deheo and date_routing = current_date - 7;
  if r7 is null then
    insert into routings (user_id, date_routing) values (v_deheo, current_date - 7) returning id into r7;
  end if;
  insert into routing_pdv (routing_id, pdv_id, position_order) values (r7, p_etr2, 99);
  select id into r20 from routings where user_id = v_deheo and date_routing = current_date - 20;
  if r20 is null then
    insert into routings (user_id, date_routing) values (v_deheo, current_date - 20) returning id into r20;
  end if;
  insert into routing_pdv (routing_id, pdv_id, position_order) values (r20, p_etr3, 99);

  -- T0. La faille : une visite (sans contrôle, ici en service) rend le PDV lisible.
  insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T0', p_etr4, v_deheo, now());
  perform set_config('request.jwt.claims', json_build_object('sub', v_deheo, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from pdv where pdv_id = p_etr4;
  res := res || format('T0 faille : visite posée sans contrôle → PDV lisible par Deheo = %s (attendu 1)', n);
  execute 'reset role';

  -- Comme Deheo (merchandiser Atom), RLS active.
  perform set_config('request.jwt.claims', json_build_object('sub', v_deheo, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- T1. PDV de sa liste, aujourd'hui.
  begin
    t0 := clock_timestamp();
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T1', p_liste, v_deheo, now());
    ms := round(extract(epoch from clock_timestamp() - t0) * 1000, 1);
    res := res || format('T1 OK : PDV de sa liste accepté (%s ms)', ms);
  exception when others then res := res || ('T1 ÉCHEC : ' || sqlerrm); end;

  -- T2. PDV qu'il ne voit pas : refusé, et toujours illisible.
  begin
    t0 := clock_timestamp();
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T2', p_etr, v_deheo, now());
    res := res || text 'T2 ÉCHEC : visite acceptée sur un PDV invisible';
  exception when insufficient_privilege then
    get stacked diagnostics msg = message_text;
    ms := round(extract(epoch from clock_timestamp() - t0) * 1000, 1);
    res := res || format('T2 OK : refusée 42501 « %s » (%s ms)', msg, ms);
  end;
  select count(*) into n from pdv where pdv_id = p_etr;
  res := res || format('T2 lisible après refus = %s (attendu 0)', n);

  -- T3. Hors ligne : visite du jour J-7 sur un PDV de sa tournée de J-7 (plus lisible aujourd'hui).
  begin
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T3', p_etr2, v_deheo, (current_date - 7) + time '10:00');
    res := res || text 'T3 OK : visite de J-7 synchronisée en retard, PDV de sa tournée de J-7 accepté';
  exception when others then res := res || ('T3 ÉCHEC : ' || sqlerrm); end;
  -- T3b. Même PDV daté d'aujourd'hui : refusé.
  begin
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T3b', p_etr2, v_deheo, now());
    res := res || text 'T3b ÉCHEC : accepté aujourd''hui';
  exception when insufficient_privilege then res := res || text 'T3b OK : même PDV daté d''aujourd''hui refusé'; end;
  -- T3c. Tournée de J-20 : au-delà de 15 jours, refusé.
  begin
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T3c', p_etr3, v_deheo, (current_date - 20) + time '10:00');
    res := res || text 'T3c ÉCHEC : visite antidatée à J-20 acceptée';
  exception when insufficient_privilege then res := res || text 'T3c OK : visite antidatée à J-20 refusée'; end;

  -- T4. PDV créé sur place puis visité (même synchro).
  begin
    p_cree := 'TEST-' || substr(md5(random()::text), 1, 8);
    insert into pdv (pdv_id, nom_pdv, created_by, sous_categorie_pdv) values (p_cree, 'Pushcart test', v_deheo, 'Pushcart');
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T4', p_cree, v_deheo, now());
    res := res || text 'T4 OK : PDV créé sur place puis visité accepté';
  exception when others then res := res || ('T4 ÉCHEC : ' || sqlerrm); end;

  -- T5. Rejeu (upsert sur visite_id) d'une visite déjà reçue alors que le PDV n'est plus lisible.
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T5', p_etr5, v_deheo, now() - interval '1 hour');
  perform set_config('request.jwt.claims', json_build_object('sub', v_deheo, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into visites (visite_id, pdv_id, user_id, date_visite, data, sync_status)
    values ('TEST-T5', p_etr5, v_deheo, now() - interval '1 hour', '{"rejeu":true}', 'synced')
    on conflict (visite_id) do update set pdv_id = excluded.pdv_id, user_id = excluded.user_id,
      date_visite = excluded.date_visite, data = excluded.data, sync_status = excluded.sync_status;
    res := res || text 'T5 OK : rejeu de la même visite accepté';
  exception when others then res := res || ('T5 ÉCHEC : ' || sqlerrm); end;
  -- T5b. Rejeu qui change le PDV vers un PDV invisible : refusé.
  begin
    insert into visites (visite_id, pdv_id, user_id, date_visite)
    values ('TEST-T5', p_etr, v_deheo, now())
    on conflict (visite_id) do update set pdv_id = excluded.pdv_id;
    res := res || text 'T5b ÉCHEC : upsert changeant le PDV accepté';
  exception when insufficient_privilege then res := res || text 'T5b OK : upsert qui change le PDV refusé'; end;

  -- T6. Photos ajoutées à cette visite (PDV invisible) : accepté. Changer le PDV de T1 : refusé.
  begin
    update visites set image_urls = array['https://x/test.jpg'] where visite_id = 'TEST-T5';
    get diagnostics n = row_count;
    res := res || format('T6 OK : photos rattachées (%s ligne)', n);
  exception when others then res := res || ('T6 ÉCHEC : ' || sqlerrm); end;
  begin
    update visites set pdv_id = p_etr where visite_id = 'TEST-T1';
    res := res || text 'T6b ÉCHEC : PDV d''une visite changé vers un PDV invisible';
  exception when insufficient_privilege then res := res || text 'T6b OK : changer le PDV d''une visite vers un PDV invisible refusé'; end;

  -- T7. Jour de visite libre (24/10) : PDV de sa liste, ajouté à la tournée.
  begin
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T7', p_liste2, v_deheo, timestamptz '2026-10-24 10:00+00');
    res := res || text 'T7 OK : visite libre acceptée';
  exception when others then res := res || ('T7 ÉCHEC : ' || sqlerrm); end;
  -- T8. Jour « à trouver » (23/10) : pushcart de sa liste, puis pushcart créé sur place.
  begin
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T8', p_push, v_deheo, timestamptz '2026-10-23 10:00+00');
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T8b', p_cree, v_deheo, timestamptz '2026-10-23 11:00+00');
    res := res || text 'T8 OK : pushcarts du 23/10 acceptés';
  exception when others then res := res || ('T8 ÉCHEC : ' || sqlerrm); end;
  execute 'reset role';
  select count(*) into n from routing_pdv rp join routings r on r.id = rp.routing_id
  where r.user_id = v_deheo and r.date_routing = date '2026-10-24' and rp.pdv_id = p_liste2 and rp.objectifs ? 'visite_libre';
  res := res || format('T7 étape ajoutée à la visite libre du 24/10 = %s (attendu 1)', n);
  select count(*) into n from routing_pdv rp join routings r on r.id = rp.routing_id
  where r.user_id = v_deheo and r.date_routing = date '2026-10-23' and rp.pdv_id in (p_push, p_cree) and rp.objectifs ? 'a_trouver';
  res := res || format('T8 étapes pushcart ajoutées au 23/10 = %s (attendu 2)', n);

  -- T13. Choix B : PDV visité avant le contrôle, hors liste et hors tournée : accepté.
  perform set_config('request.jwt.claims', json_build_object('sub', v_deheo, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T13', p_deja, v_deheo, now());
    res := res || text 'T13 OK : PDV déjà visité avant le contrôle, accepté';
  exception when others then res := res || ('T13 ÉCHEC : ' || sqlerrm); end;
  -- T13b. Délai dépassé (jusqu_au hier) : refusé, même s'il vient d'être visité.
  execute 'reset role';
  update visite_pdv_deja_visites set jusqu_au = current_date - 1 where user_id = v_deheo and pdv_id = p_deja;
  execute 'set local role authenticated';
  begin
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T13b', p_deja, v_deheo, now());
    res := res || text 'T13b ÉCHEC : accepté après le délai';
  exception when insufficient_privilege then res := res || text 'T13b OK : après le délai de 60 jours, refusé'; end;
  -- T13c. Visite posée après le contrôle (T0) : le PDV est affiché mais n'entre pas dans la liste figée.
  select count(*) into n from pdv where pdv_id = p_etr4;
  begin
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T13c', p_etr4, v_deheo, now());
    res := res || text 'T13c ÉCHEC : visite postérieure au contrôle a ouvert le PDV';
  exception when insufficient_privilege then res := res || format('T13c OK : PDV affiché (%s) par une visite postérieure, nouvelle visite refusée', n); end;
  execute 'reset role';

  -- T9. Merchandiser Friesland : son territoire oui, Yopougon non.
  perform set_config('request.jwt.claims', json_build_object('sub', v_assamoi, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T9', p_fr, v_assamoi, now());
    res := res || text 'T9 OK : Friesland, PDV de son territoire accepté';
  exception when others then res := res || ('T9 ÉCHEC : ' || sqlerrm); end;
  begin
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T9b', p_etr, v_assamoi, now());
    res := res || text 'T9b ÉCHEC : Friesland, PDV hors territoire accepté';
  exception when insufficient_privilege then res := res || text 'T9b OK : Friesland, PDV hors territoire refusé'; end;
  execute 'reset role';

  -- T10. Grand périmètre (Merchandiser Treichville) : durée du contrôle par le périmètre.
  perform set_config('request.jwt.claims', json_build_object('sub', v_treich, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    t0 := clock_timestamp();
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T10', p_treich, v_treich, now());
    ms := round(extract(epoch from clock_timestamp() - t0) * 1000, 1);
    res := res || format('T10 OK : grand périmètre accepté (%s ms)', ms);
  exception when others then res := res || ('T10 ÉCHEC : ' || sqlerrm); end;
  execute 'reset role';

  -- T11. Admin et superviseur : pas de contrôle.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T11', p_etr, v_admin, now());
    res := res || text 'T11 OK : admin accepté';
  exception when others then res := res || ('T11 ÉCHEC : ' || sqlerrm); end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  update profiles set role = 'superviseur' where id = v_sup;
  perform set_config('request.jwt.claims', json_build_object('sub', v_sup, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-T11b', p_etr, v_sup, now());
    res := res || text 'T11b OK : superviseur accepté';
  exception when others then res := res || ('T11b ÉCHEC : ' || sqlerrm); end;
  execute 'reset role';

  -- T12. Clé service (import ATOM-…) : pas de contrôle.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
  begin
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('ATOM-TEST-T12', p_etr, v_deheo, now());
    res := res || text 'T12 OK : import ATOM- par la clé service accepté';
  exception when others then res := res || ('T12 ÉCHEC : ' || sqlerrm); end;
  execute 'reset role';

  raise exception E'RESULTATS\n%', array_to_string(res, E'\n');
end
$test$;

-- 3. Tests du correctif sur la date (20261022141000) ----------------------
do $test$
declare
  v_deheo uuid := '32c4977a-fd80-4c5a-b137-f10f18f174fc';
  p_liste text; p_liste2 text; p_push text; p_etr text; p_deja text; r_auj uuid;
  u record; arr text[]; n int; n_tot int := 0; res text[] := '{}';
begin
  -- 0. Correctif (annulé avec le reste par le RAISE final).
  execute $mig$

create or replace function public.peut_visiter_pdv(p_pdv_id text, p_jour date)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_atom boolean;
begin
  if v_uid is null then
    return false;
  end if;
  -- Même définition que pdv_ids_tournee et pdv_ids_perimetre.
  select coalesce(pr.role = 'merchandiser' and pr.employeur = 'atom'
                  and coalesce(pr.email, '') not like '%@friesland-test.ci', false)
  into v_atom
  from profiles pr where pr.id = v_uid and pr.is_active = true;
  v_atom := coalesce(v_atom, false);

  -- Du moins cher au plus cher ; s'arrête au premier trouvé.
  return exists (select 1 from pdv p where p.pdv_id = p_pdv_id and p.created_by = v_uid)
    -- Déjà visité avant le contrôle (choix B) : délai pas dépassé, ou visite
    -- faite avant la fin du délai et synchronisée en retard (15 jours).
    or exists (select 1 from visite_pdv_deja_visites d
               where d.user_id = v_uid and d.pdv_id = p_pdv_id
                 and (d.jusqu_au >= current_date
                      or (p_jour >= current_date - 15 and d.jusqu_au >= p_jour)))
    -- Sa tournée du jour de la visite (synchronisée en retard).
    or (p_jour >= current_date - 15 and exists (
          select 1 from routings r
          join routing_pdv rp on rp.routing_id = r.id
          where r.user_id = v_uid and rp.pdv_id = p_pdv_id
            and r.date_routing between p_jour - 1 and p_jour))
    -- Ses tournées, comme pdv_ids_tournee sans les visites.
    or exists (
          select 1 from routings r
          join routing_pdv rp on rp.routing_id = r.id
          where r.user_id = v_uid and rp.pdv_id = p_pdv_id
            and r.date_routing >= case when v_atom then current_date - 1 else current_date - 60 end)
    or (not v_atom and exists (
          select 1 from routing_templates t
          join routing_template_pdv tp on tp.template_id = t.id
          where t.user_id = v_uid and t.is_active and tp.pdv_id = p_pdv_id))
    -- Son périmètre (territoires, ou sa liste pour un merchandiser Atom).
    or exists (select 1 from public.pdv_ids_perimetre() x where x = p_pdv_id);
end;
$$;

create or replace function public.visite_pdv_lisible()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Clé service (imports, cron) ou visite sans PDV.
  if auth.uid() is null or new.pdv_id is null then
    return new;
  end if;
  -- Ni le PDV ni la date ne changent (photos, statut, rejeu de la même visite).
  if tg_op = 'UPDATE' and new.pdv_id is not distinct from old.pdv_id
     and new.date_visite is not distinct from old.date_visite then
    return new;
  end if;
  -- Rejeu d'une visite déjà reçue : l'upsert passera par la mise à jour,
  -- contrôlée ci-dessus si le PDV ou la date change, et par visites_update.
  if tg_op = 'INSERT' and exists (select 1 from visites v where v.visite_id = new.visite_id) then
    return new;
  end if;
  if public.role_actif_courant() in ('admin', 'superviseur') then
    return new;
  end if;

  -- Datée dans le futur : le PDV resterait lisible jusqu'à cette date + 60 jours.
  if new.date_visite > now() + interval '1 day' then
    raise exception 'La date de la visite est dans le futur : la visite n''est pas enregistrée.'
      using errcode = 'insufficient_privilege',
            hint = 'Vérifiez la date et l''heure du téléphone.';
  end if;

  if public.peut_visiter_pdv(new.pdv_id, (new.date_visite at time zone 'Africa/Abidjan')::date) then
    return new;
  end if;

  raise exception 'Ce PDV n''est pas dans vos PDV : la visite n''est pas enregistrée (PDV %).', new.pdv_id
    using errcode = 'insufficient_privilege',
          hint = 'Choisissez un PDV de votre liste, ou créez le PDV sur place.';
end;
$$;

revoke all on function public.peut_visiter_pdv(text, date) from public, anon, authenticated;
grant execute on function public.peut_visiter_pdv(text, date) to service_role;
revoke all on function public.visite_pdv_lisible() from public, anon, authenticated;

drop trigger if exists trg_visite_pdv_lisible on public.visites;
create trigger trg_visite_pdv_lisible
  before insert or update of pdv_id, date_visite on public.visites
  for each row execute function public.visite_pdv_lisible();
  $mig$;

  -- T0b. Aucun PDV affiché à un merchandiser actif n'est refusé.
  for u in select id from profiles where role = 'merchandiser' and is_active loop
    perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    arr := array(select pdv_id from pdv);
    execute 'reset role';
    select count(*) into n from unnest(arr) x where x not in (select pdv_ids_perimetre()) and not peut_visiter_pdv(x, current_date);
    n_tot := n_tot + n;
  end loop;
  res := res || format('D0 PDV affichés mais refusés, tous merchandisers actifs = %s (attendu 0)', n_tot);

  -- Jeu, lu comme Deheo.
  perform set_config('request.jwt.claims', json_build_object('sub', v_deheo, 'role', 'authenticated')::text, true);
  select q.pdv_id into p_liste from pdv_quartier_tournee q join pdv p on p.pdv_id = q.pdv_id
  where q.merchandiser_id = v_deheo and canal_atom(p.sous_categorie_pdv) = 'Boutique' and q.pdv_id in (select pdv_ids_perimetre())
    and not exists (select 1 from routing_pdv rp join routings r on r.id = rp.routing_id where r.user_id = v_deheo and rp.pdv_id = q.pdv_id and r.date_routing >= date_trunc('month', current_date))
    and not exists (select 1 from visites v where v.user_id = v_deheo and v.pdv_id = q.pdv_id)
  order by q.pdv_id limit 1;
  select q.pdv_id into p_liste2 from pdv_quartier_tournee q join pdv p on p.pdv_id = q.pdv_id
  where q.merchandiser_id = v_deheo and canal_atom(p.sous_categorie_pdv) = 'Boutique' and q.pdv_id <> p_liste and q.pdv_id in (select pdv_ids_perimetre())
    and not exists (select 1 from routing_pdv rp join routings r on r.id = rp.routing_id where r.user_id = v_deheo and rp.pdv_id = q.pdv_id and r.date_routing >= date_trunc('month', current_date))
    and not exists (select 1 from visites v where v.user_id = v_deheo and v.pdv_id = q.pdv_id)
  order by q.pdv_id limit 1;
  select q.pdv_id into p_push from pdv_quartier_tournee q join pdv p on p.pdv_id = q.pdv_id
  where q.merchandiser_id = v_deheo and canal_atom(p.sous_categorie_pdv) = 'Pushcart' and q.pdv_id in (select pdv_ids_perimetre())
    and not exists (select 1 from routing_pdv rp join routings r on r.id = rp.routing_id where r.user_id = v_deheo and rp.pdv_id = q.pdv_id and r.date_routing >= date_trunc('month', current_date))
  order by q.pdv_id limit 1;
  select p.pdv_id into p_etr from pdv p where p.zone ilike 'YOPOUGON%' and p.pdv_id not in (select pdv_ids_perimetre())
    and p.pdv_id not in (select pdv_ids_tournee()) and not exists (select 1 from visite_pdv_deja_visites d where d.user_id = v_deheo and d.pdv_id = p.pdv_id)
    and not exists (select 1 from routing_pdv rp join routings r on r.id = rp.routing_id where r.user_id = v_deheo and rp.pdv_id = p.pdv_id)
  order by p.pdv_id limit 1;
  select d.pdv_id into p_deja from visite_pdv_deja_visites d join pdv p on p.pdv_id = d.pdv_id
  where d.user_id = v_deheo and p.created_by is distinct from v_deheo and d.pdv_id not in (select pdv_ids_perimetre())
    and not exists (select 1 from routing_pdv rp join routings r on r.id = rp.routing_id where r.user_id = v_deheo and rp.pdv_id = d.pdv_id and r.date_routing >= current_date - 20)
  order by d.pdv_id limit 1;
  res := res || format('jeu : liste=%s liste2=%s pushcart=%s étranger=%s déjà visité=%s', p_liste, p_liste2, p_push, p_etr, p_deja);
  if p_liste is null or p_liste2 is null or p_push is null or p_etr is null or p_deja is null then
    raise exception 'jeu incomplet : %', res;
  end if;

  -- Délai de p_deja dépassé hier ; tournée d'aujourd'hui mise en visite libre (comme le 24/10).
  perform set_config('request.jwt.claims', '', true);
  update visite_pdv_deja_visites set jusqu_au = current_date - 1 where user_id = v_deheo and pdv_id = p_deja;
  update routings r set objectifs = l.objectifs
  from routings l where r.user_id = v_deheo and r.date_routing = current_date
    and l.user_id = v_deheo and l.date_routing = date '2026-10-24';

  perform set_config('request.jwt.claims', json_build_object('sub', v_deheo, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- D1. Choix B, délai dépassé hier.
  begin insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-D1a', p_deja, v_deheo, now());
    res := res || text 'D1a ÉCHEC : délai dépassé, visite du jour acceptée';
  exception when insufficient_privilege then res := res || text 'D1a OK : délai dépassé, visite du jour refusée'; end;
  begin insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-D1b', p_deja, v_deheo, (current_date - 3) + time '10:00');
    res := res || text 'D1b OK : visite faite avant la fin du délai, synchronisée 3 jours après, acceptée';
  exception when others then res := res || ('D1b ÉCHEC : ' || sqlerrm); end;
  begin insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-D1c', p_deja, v_deheo, (current_date - 30) + time '10:00');
    res := res || text 'D1c ÉCHEC : visite antidatée de 30 jours acceptée';
  exception when insufficient_privilege then res := res || text 'D1c OK : visite antidatée de 30 jours refusée'; end;

  -- D2. Date dans le futur.
  begin insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-D2a', p_liste, v_deheo, now() + interval '3 days');
    res := res || text 'D2a ÉCHEC : visite datée dans 3 jours acceptée';
  exception when insufficient_privilege then res := res || ('D2a OK : visite datée dans 3 jours refusée « ' || sqlerrm || ' »'); end;
  begin insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-D2b', p_liste, v_deheo, now() + interval '2 hours');
    res := res || text 'D2b OK : heure du téléphone en avance de 2 h, acceptée';
  exception when others then res := res || ('D2b ÉCHEC : ' || sqlerrm); end;

  -- D3. Changer la date d'une visite.
  begin update visites set date_visite = now() + interval '10 days' where visite_id = 'TEST-D2b';
    res := res || text 'D3a ÉCHEC : date reportée de 10 jours acceptée';
  exception when insufficient_privilege then res := res || text 'D3a OK : date reportée de 10 jours refusée'; end;
  begin update visites set date_visite = now() - interval '1 day' where visite_id = 'TEST-D2b';
    res := res || text 'D3b OK : date changée à hier (PDV de sa liste) acceptée';
  exception when others then res := res || ('D3b ÉCHEC : ' || sqlerrm); end;
  begin update visites set date_visite = (current_date - 30) + time '10:00' where visite_id = 'TEST-D1b';
    res := res || text 'D3c ÉCHEC : visite déjà visitée antidatée de 30 jours acceptée';
  exception when insufficient_privilege then res := res || text 'D3c OK : antidater une visite hors délai refusé'; end;

  -- D4. Rejeu (même date) et photos : acceptés ; rejeu avec date future : refusé.
  begin
    insert into visites (visite_id, pdv_id, user_id, date_visite, data)
    select visite_id, pdv_id, user_id, date_visite, '{"rejeu":true}' from visites where visite_id = 'TEST-D1b'
    on conflict (visite_id) do update set pdv_id = excluded.pdv_id, date_visite = excluded.date_visite, data = excluded.data;
    update visites set image_urls = array['https://x/t.jpg'] where visite_id = 'TEST-D1b';
    res := res || text 'D4a OK : rejeu même date + photos acceptés (délai dépassé)';
  exception when others then res := res || ('D4a ÉCHEC : ' || sqlerrm); end;
  begin
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-D1b', p_deja, v_deheo, now() + interval '5 days')
    on conflict (visite_id) do update set date_visite = excluded.date_visite;
    res := res || text 'D4b ÉCHEC : rejeu avec date future accepté';
  exception when insufficient_privilege then res := res || text 'D4b OK : rejeu avec date future refusé'; end;

  -- D5. Non-régression : sa liste, PDV pas à lui, visite libre, pushcart.
  begin insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-D5a', p_liste, v_deheo, now());
    res := res || text 'D5a OK : PDV de sa liste accepté';
  exception when others then res := res || ('D5a ÉCHEC : ' || sqlerrm); end;
  begin insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-D5b', p_etr, v_deheo, now());
    res := res || text 'D5b ÉCHEC : PDV pas à lui accepté';
  exception when insufficient_privilege then res := res || text 'D5b OK : PDV pas à lui refusé'; end;
  begin insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-D5c', p_liste2, v_deheo, now());
    insert into visites (visite_id, pdv_id, user_id, date_visite) values ('TEST-D5d', p_push, v_deheo, timestamptz '2026-10-23 08:00+00');
    res := res || text 'D5c OK : visite libre (aujourd''hui) et pushcart (23/10) acceptés';
  exception when others then res := res || ('D5c ÉCHEC : ' || sqlerrm); end;
  execute 'reset role';
  select count(*) into n from routing_pdv rp join routings r on r.id = rp.routing_id
  where r.user_id = v_deheo and ((r.date_routing = current_date and rp.pdv_id = p_liste2 and rp.objectifs ? 'visite_libre')
                              or (r.date_routing = date '2026-10-23' and rp.pdv_id = p_push and rp.objectifs ? 'a_trouver'));
  res := res || format('D5 étapes ajoutées (visite libre + pushcart) = %s (attendu 2)', n);

  raise exception E'RESULTATS\n%', array_to_string(res, E'\n');
end
$test$;
