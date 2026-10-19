-- PROPOSITION 2026-10-19 : règle de secours ABOBO 2 pour abobomerchtwo (Seregone Chadrac)
-- NON APPLIQUÉE. À relire, puis à coller dans Supabase › SQL Editor.
--
-- Constat
--   Les comptes Atom suivent les territoires : depuis le 16/10, abobomerchtwo = Seregone (ABOBO 2).
--   Sa règle de secours est encore « Portefeuille DMS — ETABLISSEMENT NIARE & FRERES »
--   (264 PDV, fichier DMS du 29/09) : l'ancien portefeuille de Yao, à Sogephia, Gagnoa gare
--   et Abobo centre (ABOBO 1). Elle sert :
--   - les jours sans case de routing (semaine 5 : 29, 30 et 31/10), où Seregone est
--     envoyé en ABOBO 1 ;
--   - le complément du quota les autres jours (PDV les plus proches du lieu du jour).
--
-- Proposition (ajouts seulement, rien n'est supprimé)
--   1. Nouvelle règle de secours « Portefeuille périmètre — ABOBO 2 », du lundi au samedi,
--      à partir du 20/10 : les PDV du secteur de sa fiche (quartiers de la fiche, dans ses
--      territoires), plus les PDV sans quartier de sa zone ABOBO 2. Ils sont rangés comme dans
--      scripts/tournees-perimetre.mjs (ordreGps) : chaîne du plus proche voisin depuis le PDV
--      le plus à l'ouest, les PDV sans GPS en fin de liste. Même forme que la règle de Yao
--      « Portefeuille périmètre — ABOBO 1 » (secours, quota, objectifs relevé + photos).
--   2. Exception sur la règle DMS NIARE à partir du 20/10 (sans date de fin réelle) : elle ne
--      sert plus, mais reste en base. Retour arrière : supprimer la nouvelle règle et l'exception.
--   3. Recalcul des tournées à venir de Seregone (à partir de demain, celles qui ne sont pas
--      commencées).
--
-- Garde-fous : rien n'est fait si la fiche n'est plus « SEREGONE SCHADRACK / abobomerchtwo /
-- ABOBO 2 », si une règle « Portefeuille périmètre » existe déjà pour ce compte, ou si la
-- règle DMS NIARE n'est pas la sienne. Collé deux fois, le script s'arrête au 2e passage.

do $$
declare
  v_user  constant uuid := 'c4f8d184-718a-4f45-8ac1-1e2a90e20da3';  -- abobomerchtwo = Seregone, ABOBO 2
  v_dms   constant uuid := '9128ab2e-00cb-480a-8fca-d99fdb94e351';  -- « Portefeuille DMS — ETABLISSEMENT NIARE & FRERES »
  v_debut constant date := '2026-10-20';
  p       profiles%rowtype;
  v_regle uuid;
  v_id    text;
  v_lat   double precision;
  v_lng   double precision;
  v_ordre integer := 0;
  v_nb    integer;
begin
  select * into p from profiles where id = v_user;
  if p.nom is distinct from 'SEREGONE SCHADRACK' or p.email is distinct from 'abobomerchtwo@gmail.com'
     or p.zone_assignee is distinct from 'ABOBO 2' then
    raise exception 'Fiche inattendue (% / % / %) : rien n''est fait', p.nom, p.email, p.zone_assignee;
  end if;
  if exists (select 1 from routing_templates where user_id = v_user and label like 'Portefeuille périmètre — %') then
    raise exception 'abobomerchtwo a déjà une règle « Portefeuille périmètre » : rien n''est fait';
  end if;
  if not exists (select 1 from routing_templates where id = v_dms and user_id = v_user and repli) then
    raise exception 'La règle DMS NIARE n''est pas la règle de secours d''abobomerchtwo : rien n''est fait';
  end if;

  -- 1a. PDV du secteur : quartiers de la fiche dans ses territoires (alias compris),
  --     plus les PDV sans quartier de sa zone ABOBO 2. Seuls les PDV d'un canal Atom
  --     comptent dans les quotas.
  create temp table _secours on commit drop as
  select x.pdv_id, x.quartier, x.geolocation_lat as lat, x.geolocation_lng as lng, null::integer as ordre
  from pdv x
  where coalesce(x.is_active, true)
    and canal_atom(x.sous_categorie_pdv) is not null
    and (
      (x.zone in (select territoires_etendus(array(select jsonb_array_elements_text(p.territoires_assignes))))
        and x.quartier in (select jsonb_array_elements_text(p.quartiers_assignes)))
      or (x.zone = p.zone_assignee and x.quartier is null)
    );
  select count(*) into v_nb from _secours;
  if v_nb = 0 then raise exception 'Secteur vide : rien n''est fait'; end if;

  -- 1b. Ordre de passage (miroir d'ordreGps) : départ du PDV le plus à l'ouest,
  --     puis toujours le plus proche des PDV restants.
  select s.pdv_id, s.lat, s.lng into v_id, v_lat, v_lng
  from _secours s
  where s.lat is not null and s.lng is not null and not (s.lat = 0 and s.lng = 0)
  order by s.lng, s.pdv_id limit 1;
  while v_id is not null loop
    v_ordre := v_ordre + 1;
    update _secours set ordre = v_ordre where pdv_id = v_id;
    v_id := null;
    select s.pdv_id, s.lat, s.lng into v_id, v_lat, v_lng
    from _secours s
    where s.ordre is null and s.lat is not null and s.lng is not null and not (s.lat = 0 and s.lng = 0)
    order by power((s.lat - v_lat) * 110540, 2) + power((s.lng - v_lng) * 111320 * cos(radians(v_lat)), 2), s.pdv_id
    limit 1;
  end loop;
  -- PDV sans GPS : en fin de liste, groupés par quartier.
  update _secours s set ordre = v_ordre + k.rn
  from (select pdv_id, row_number() over (order by quartier nulls last, pdv_id) as rn
        from _secours where ordre is null) k
  where s.pdv_id = k.pdv_id;

  -- 1c. La règle et ses PDV.
  insert into routing_templates (user_id, day_of_week, days_of_week, label, notes, is_active, mode, repli, date_debut, created_by)
  values (
    v_user, 1, array[1, 2, 3, 4, 5, 6], 'Portefeuille périmètre — ABOBO 2',
    format('Secours de Seregone (ABOBO 2) : PDV des quartiers de sa fiche et PDV sans quartier d''ABOBO 2 (%s PDV au %s). Remplace le portefeuille DMS NIARE, ancien portefeuille de Yao (ABOBO 1).', v_nb, current_date),
    true, 'quota', true, v_debut, null
  )
  returning id into v_regle;

  insert into routing_template_pdv (template_id, pdv_id, position_order, objectifs)
  select v_regle, s.pdv_id, s.ordre, '{"releve_stock": true, "photos": true}'::jsonb
  from _secours s;

  -- 2. La règle DMS NIARE ne sert plus à partir du 20/10 (exception sur toute la règle).
  insert into routing_template_exception (template_id, pdv_id, date_debut, date_fin, motif)
  values (v_dms, null, v_debut, '2099-12-31',
          'Ancien portefeuille DMS de Yao (ABOBO 1) : remplacé par « Portefeuille périmètre — ABOBO 2 » depuis la réaffectation du 16/10.');

  raise notice 'Règle % créée avec % PDV (% avec GPS), règle DMS NIARE écartée à partir du %.',
    v_regle, v_nb, v_ordre, v_debut;
end $$;

-- 3. Tournées de Seregone à partir de demain (pending, aucune étape traitée) : supprimées puis recréées.
select recalculer_tournees_a_venir('c4f8d184-718a-4f45-8ac1-1e2a90e20da3', 14) as seregone_abobomerchtwo;
