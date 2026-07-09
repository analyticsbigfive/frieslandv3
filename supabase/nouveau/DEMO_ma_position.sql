-- ============================================================================
-- DÉMO Perfect Store à MA POSITION — 6 PDV (1 par niveau + 2 non conformes)
-- Position : 5.295018750961232 , -3.9966371828709666 (Abidjan, R. Roger Abinader)
--
-- À COLLER DANS LE SQL EDITOR SUPABASE. Ré-exécutable (idempotent).
-- N'efface QUE les PDV démo (préfixe DEMO-PS-) — pas les vrais PDV.
-- Affecte les 6 PDV à TOUS les utilisateurs via leur tournée du jour.
-- ============================================================================
begin;

-- 1) Nettoyage des PDV démo existants (visites + résultats + routing cascadent)
delete from visites where pdv_id like 'DEMO-PS-%';
delete from pdv     where pdv_id like 'DEMO-PS-%';

-- 2) Les 6 PDV à ta position (décalages ~50 m pour ne pas se superposer)
insert into pdv(pdv_id, nom_pdv, canal, categorie_pdv, sous_categorie_pdv, region, zone, secteur,
                geolocation_lat, geolocation_lng, rayon_geofence, is_active) values
 ('DEMO-PS-001','⭐ Démo FLAGSHIP',      'General trade','Point de vente détail','Boutique A','Abidjan','Démo','Démo',5.2950188,-3.9966372,300,true),
 ('DEMO-PS-002','🥈 Démo VIP',           'General trade','Point de vente détail','Boutique B','Abidjan','Démo','Démo',5.2954688,-3.9966372,300,true),
 ('DEMO-PS-003','🥉 Démo CORE',          'General trade','Point de vente détail','Boutique C','Abidjan','Démo','Démo',5.2950188,-3.9961872,300,true),
 ('DEMO-PS-004','✅ Démo BASIC',         'General trade','Point de vente détail','Kiosk A',   'Abidjan','Démo','Démo',5.2954688,-3.9961872,300,true),
 ('DEMO-PS-005','❌ Démo NON CONFORME 1','General trade','Point de vente détail','Boutique C','Abidjan','Démo','Démo',5.2945688,-3.9966372,300,true),
 ('DEMO-PS-006','❌ Démo NON CONFORME 2','General trade','Point de vente détail','Boutique A','Abidjan','Démo','Démo',5.2950188,-3.9970872,300,true);

-- 3) Visites craftées -> chaque niveau (le trigger recalcule le score)
--    Stock 999 = disponible partout ; les booléens visibilité pilotent le niveau.
insert into visites(visite_id, pdv_id, date_visite, commercial, email, data, sync_status) values

-- FLAGSHIP : stock complet + TOUS les standards visibilité/promo
('DEMO-PS-V1','DEMO-PS-001',now(),'Démo','demo@friesland.test', jsonb_build_object(
  'produits', jsonb_build_object(
    'evap', jsonb_build_object('quantites', jsonb_build_object('br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
    'imp',  jsonb_build_object('quantites', jsonb_build_object('br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
    'scm',  jsonb_build_object('quantites', jsonb_build_object('br_1kg',999,'pearl_1kg',999))),
  'visibilite', jsonb_build_object('promotion_applicable',true,'standards', jsonb_build_object(
    'affiche',true,'fleche',true,'guirlande',true,'sign_board',true,'panneau_privilege',true,'full_branding',true,
    'reglette',true,'maison_br',true,'hanger',true,'wobler',true,'presentoir',true,'tg',true,'plaque_br',true,'merchandising',true,
    'standard',true,'hotesses',true,'degustation',true))), 'synced'),

-- VIP : stock complet, mais full_branding + plaque_br absents (exigés en Flagship, optionnels en VIP)
('DEMO-PS-V2','DEMO-PS-002',now(),'Démo','demo@friesland.test', jsonb_build_object(
  'produits', jsonb_build_object(
    'evap', jsonb_build_object('quantites', jsonb_build_object('br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
    'imp',  jsonb_build_object('quantites', jsonb_build_object('br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
    'scm',  jsonb_build_object('quantites', jsonb_build_object('br_1kg',999,'pearl_1kg',999))),
  'visibilite', jsonb_build_object('promotion_applicable',true,'standards', jsonb_build_object(
    'affiche',true,'fleche',true,'guirlande',true,'sign_board',true,'panneau_privilege',true,'full_branding',false,
    'reglette',true,'maison_br',true,'hanger',true,'wobler',true,'presentoir',true,'tg',true,'plaque_br',false,'merchandising',true,
    'standard',true,'hotesses',true,'degustation',true))), 'synced'),

-- CORE : stock complet, visibilité limitée au requis Core, promo non applicable
('DEMO-PS-V3','DEMO-PS-003',now(),'Démo','demo@friesland.test', jsonb_build_object(
  'produits', jsonb_build_object(
    'evap', jsonb_build_object('quantites', jsonb_build_object('br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
    'imp',  jsonb_build_object('quantites', jsonb_build_object('br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
    'scm',  jsonb_build_object('quantites', jsonb_build_object('br_1kg',999,'pearl_1kg',999))),
  'visibilite', jsonb_build_object('promotion_applicable',false,'standards', jsonb_build_object(
    'affiche',true,'fleche',true,'guirlande',true,'sign_board',true,'panneau_privilege',false,'full_branding',false,
    'reglette',true,'maison_br',true,'hanger',true,'wobler',true,'presentoir',false,'tg',false,'plaque_br',false,'merchandising',true,
    'standard',true,'hotesses',false,'degustation',false))), 'synced'),

-- BASIC : Kiosque, stock des réfs à seuil Kiosque, aucune visibilité (Basic n'exige rien)
('DEMO-PS-V4','DEMO-PS-004',now(),'Démo','demo@friesland.test', jsonb_build_object(
  'produits', jsonb_build_object(
    'evap', jsonb_build_object('quantites', jsonb_build_object('pearl_400g',999)),
    'imp',  jsonb_build_object('quantites', jsonb_build_object()),
    'scm',  jsonb_build_object('quantites', jsonb_build_object('pearl_1kg',999))),
  'visibilite', jsonb_build_object('promotion_applicable',false,'standards', jsonb_build_object(
    'affiche',false,'thermos',false,'verre',false,'carafe',false,'maison_br',false,'chasuble',false,'full_branding',false,'promotion',false))), 'synced'),

-- NON CONFORME 1 : rien en stock, rien en visibilité
('DEMO-PS-V5','DEMO-PS-005',now(),'Démo','demo@friesland.test', jsonb_build_object(
  'produits', jsonb_build_object(
    'evap', jsonb_build_object('quantites', jsonb_build_object()),
    'imp',  jsonb_build_object('quantites', jsonb_build_object()),
    'scm',  jsonb_build_object('quantites', jsonb_build_object())),
  'visibilite', jsonb_build_object('promotion_applicable',false,'standards', jsonb_build_object(
    'affiche',false,'fleche',false,'guirlande',false,'sign_board',false,'panneau_privilege',false,'full_branding',false,
    'reglette',false,'maison_br',false,'hanger',false,'wobler',false,'presentoir',false,'tg',false,'plaque_br',false,'merchandising',false))), 'synced'),

-- NON CONFORME 2 : stock complet MAIS aucune visibilité (Boutique -> échoue même Basic)
('DEMO-PS-V6','DEMO-PS-006',now(),'Démo','demo@friesland.test', jsonb_build_object(
  'produits', jsonb_build_object(
    'evap', jsonb_build_object('quantites', jsonb_build_object('br_gold',999,'br_160g',999,'brb_160g',999,'br_400g',999,'brb_400g',999,'pearl_400g',999)),
    'imp',  jsonb_build_object('quantites', jsonb_build_object('br_20g',999,'brd_15g',999,'br_375g',999,'br_900g',999,'br_2_5kg',999,'brd_350g',999,'br_400g',999)),
    'scm',  jsonb_build_object('quantites', jsonb_build_object('br_1kg',999,'pearl_1kg',999))),
  'visibilite', jsonb_build_object('promotion_applicable',false,'standards', jsonb_build_object(
    'affiche',false,'fleche',false,'guirlande',false,'sign_board',false,'panneau_privilege',false,'full_branding',false,
    'reglette',false,'maison_br',false,'hanger',false,'wobler',false,'presentoir',false,'tg',false,'plaque_br',false,'merchandising',false))), 'synced');

-- 4) Affecter les 6 PDV à TOUS les utilisateurs (tournée du jour). Ignoré si routing absent.
do $$
declare u record; r_id uuid;
begin
  if to_regclass('public.routings') is null or to_regclass('public.routing_pdv') is null then
    raise notice 'Tables routing absentes -> PDV visibles via la carte / dashboards admin, pas via tournée.';
  else
    for u in select id from public.profiles loop
      insert into public.routings(user_id, date_routing, status)
        values (u.id, current_date, 'pending')
        on conflict (user_id, date_routing) do nothing;
      select id into r_id from public.routings where user_id=u.id and date_routing=current_date;
      insert into public.routing_pdv(routing_id, pdv_id, position_order, status)
        select r_id, p.pdv_id, row_number() over (order by p.pdv_id), 'pending'
        from public.pdv p where p.pdv_id like 'DEMO-PS-%'
        on conflict (routing_id, pdv_id) do nothing;
    end loop;
  end if;
end $$;

-- 5) Recalcul explicite des 6 visites démo
select calculer_perfect_store(id,'taux_vente') from visites where pdv_id like 'DEMO-PS-%';

commit;

-- Contrôle : niveau attendu par PDV
-- select p.nom_pdv, r.niveau, r.dispo_rayon, r.visibilite
-- from resultat_perfect_store r join visites v on v.id=r.visite_id join pdv p on p.pdv_id=v.pdv_id
-- where p.pdv_id like 'DEMO-PS-%' order by p.pdv_id;
