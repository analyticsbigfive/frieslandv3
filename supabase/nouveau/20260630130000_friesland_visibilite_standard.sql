-- ============================================================================
-- Migration 5/6 : STANDARDS DE VISIBILITÉ  (onglets BOUTIQUE, SUPERETTE,
--                 TABLE TOP, PUSHCART, PORRIDGE, KIOSQUE ET ABOKI)
-- Brique manquante, nécessaire pour noter le pilier Visibilité du Perfect Store.
-- ATTENTION : la source mélange des cellules fusionnées et la distinction
-- optionnel/obligatoire n'est PAS encore tranchée par Friesland.
-- => Ce seed est PROVISOIRE, à valider. La structure, elle, est définitive.
-- ============================================================================
begin;

-- Catalogue des éléments de visibilité / promotion, par segment de PDV
create table if not exists element_visibilite (
  id        bigint generated always as identity primary key,
  segment   text not null check (segment in
              ('boutique','superette','table_top','pushcart','porridge','kiosque_aboki')),
  code      text,
  nom       text not null,
  pilier    text not null check (pilier in ('visibilite','promotion')),
  emplacement text,
  optionnel boolean not null default false,   -- true = ne compte pas dans la note
  unique (segment, nom)
);
alter table element_visibilite add column if not exists code text;
alter table element_visibilite add column if not exists emplacement text;
-- Une exécution antérieure peut avoir déjà posé ces contraintes. Le seed
-- renseigne code/emplacement dans l'étape suivante : on les relâche donc
-- temporairement pour rendre la migration entièrement rejouable.
alter table element_visibilite alter column code drop not null;
alter table element_visibilite alter column emplacement drop not null;

-- Une première ébauche de standard_visibilite utilisait un schéma incompatible.
-- La présence de "segment" seule ne suffit pas : certaines versions intermédiaires
-- n'avaient pas encore niveau_perfect_store, element_visibilite_id ou requis.
-- On archive toute version incomplète sous un nom unique, sans perdre ses données,
-- puis on installe le modèle Big Five. Ce bloc reste sûr si la migration est rejouée.
do $$
declare
  v_colonnes_attendues integer;
  v_archive_name text;
begin
  if to_regclass('public.standard_visibilite') is not null then
    select count(*)
      into v_colonnes_attendues
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'standard_visibilite'
      and column_name in (
        'segment',
        'niveau_perfect_store',
        'element_visibilite_id',
        'requis'
      );

    if v_colonnes_attendues <> 4 then
      v_archive_name := 'standard_visibilite_legacy_'
        || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
        || '_'
        || pg_backend_pid();
      execute format(
        'alter table public.standard_visibilite rename to %I',
        v_archive_name
      );
    end if;
  end if;
end $$;

-- Standard : quel élément est requis à quel niveau de Perfect Store
create table if not exists standard_visibilite (
  segment              text not null,
  niveau_perfect_store text not null check (niveau_perfect_store in
                         ('flagship','vip','core','basic')),
  element_visibilite_id bigint not null references element_visibilite(id) on delete cascade,
  requis               boolean not null default false,
  primary key (niveau_perfect_store, element_visibilite_id)
);

insert into element_visibilite(segment,nom,pilier,optionnel) values
  ('boutique','Affiche','visibilite',false),
  ('boutique','Flèche','visibilite',false),
  ('boutique','Guirlande','visibilite',true),
  ('boutique','sign board','visibilite',false),
  ('boutique','Panneau privilège','visibilite',false),
  ('boutique','Full branding','visibilite',false),
  ('boutique','Reglette','visibilite',false),
  ('boutique','Maison BR','visibilite',false),
  ('boutique','Hanger','visibilite',false),
  ('boutique','Wobler','visibilite',false),
  ('boutique','Présentoire','visibilite',false),
  ('boutique','TG','visibilite',false),
  ('boutique','Plaque BR','visibilite',true),
  ('boutique','Merchandising','visibilite',false),
  ('boutique','Standard','promotion',false),
  ('boutique','Hotesses','promotion',false),
  ('boutique','Dégustation','promotion',false),
  ('superette','Affiche','visibilite',true),
  ('superette','Flèche (Entrée et sortie)','visibilite',false),
  ('superette','sign board lumineux','visibilite',true),
  ('superette','Panneau privilège lumineux','visibilite',true),
  ('superette','Reglette','visibilite',false),
  ('superette','Espace BR','visibilite',false),
  ('superette','Wobler rayon','visibilite',false),
  ('superette','Présentoire','visibilite',false),
  ('superette','TG','visibilite',false),
  ('superette','Plaque BR','visibilite',true),
  ('superette','Merchandising','visibilite',false),
  ('superette','Standard','promotion',false),
  ('superette','Hotesses','promotion',false),
  ('superette','Dégustation','promotion',false),
  ('table_top','PARASOLS','visibilite',false),
  ('table_top','NAPPE','visibilite',false),
  ('table_top','HANGER','visibilite',false),
  ('table_top','TABLIER','visibilite',true),
  ('table_top','Promotion','promotion',false),
  ('pushcart','AFFICHE','visibilite',false),
  ('pushcart','THERMOS','visibilite',false),
  ('pushcart','VERRE JETABLE','visibilite',false),
  ('pushcart','CHASUBLE','visibilite',false),
  ('pushcart','FULL BRANDING','visibilite',false),
  ('pushcart','Promotion','promotion',false),
  ('porridge','PARASOLS','visibilite',false),
  ('porridge','NAPPE','visibilite',false),
  ('porridge','HANGER','visibilite',false),
  ('porridge','VERRE JETABLE','visibilite',false),
  ('porridge','TABLIER','visibilite',false),
  ('porridge','STANDARD','promotion',false),
  ('porridge','DEGUSTATION','promotion',false),
  ('kiosque_aboki','AFFICHE','visibilite',false),
  ('kiosque_aboki','THERMOS','visibilite',false),
  ('kiosque_aboki','VERRE','visibilite',false),
  ('kiosque_aboki','CARAFE','visibilite',false),
  ('kiosque_aboki','MAISON BR','visibilite',false),
  ('kiosque_aboki','CHASUBLE','visibilite',false),
  ('kiosque_aboki','FULL BRANDING','visibilite',false),
  ('kiosque_aboki','Promotion','promotion',false)
on conflict (segment,nom) do update set
  pilier = excluded.pilier,
  optionnel = excluded.optionnel;

-- Identifiants stables écrits dans visites.data.visibilite.standards + emplacement.
update element_visibilite e
set code = v.code, emplacement = v.emplacement
from (values
  ('boutique','Affiche','affiche','exterieure'),
  ('boutique','Flèche','fleche','exterieure'),
  ('boutique','Guirlande','guirlande','exterieure'),
  ('boutique','sign board','sign_board','exterieure'),
  ('boutique','Panneau privilège','panneau_privilege','exterieure'),
  ('boutique','Full branding','full_branding','exterieure'),
  ('boutique','Reglette','reglette','interieure'),
  ('boutique','Maison BR','maison_br','interieure'),
  ('boutique','Hanger','hanger','interieure'),
  ('boutique','Wobler','wobler','interieure'),
  ('boutique','Présentoire','presentoir','interieure'),
  ('boutique','TG','tg','interieure'),
  ('boutique','Plaque BR','plaque_br','interieure'),
  ('boutique','Merchandising','merchandising','interieure'),
  ('boutique','Standard','standard','promotion'),
  ('boutique','Hotesses','hotesses','promotion'),
  ('boutique','Dégustation','degustation','promotion'),
  ('superette','Affiche','affiche','exterieure'),
  ('superette','Flèche (Entrée et sortie)','fleche','exterieure'),
  ('superette','sign board lumineux','sign_board','exterieure'),
  ('superette','Panneau privilège lumineux','panneau_privilege','exterieure'),
  ('superette','Reglette','reglette','interieure'),
  ('superette','Espace BR','espace_br','interieure'),
  ('superette','Wobler rayon','wobler','interieure'),
  ('superette','Présentoire','presentoir','interieure'),
  ('superette','TG','tg','interieure'),
  ('superette','Plaque BR','plaque_br','interieure'),
  ('superette','Merchandising','merchandising','interieure'),
  ('superette','Standard','standard','promotion'),
  ('superette','Hotesses','hotesses','promotion'),
  ('superette','Dégustation','degustation','promotion'),
  ('table_top','PARASOLS','parasol','exterieure'),
  ('table_top','NAPPE','nappe','interieure'),
  ('table_top','HANGER','hanger','interieure'),
  ('table_top','TABLIER','tablier','interieure'),
  ('table_top','Promotion','promotion','promotion'),
  ('pushcart','AFFICHE','affiche','exterieure'),
  ('pushcart','THERMOS','thermos','interieure'),
  ('pushcart','VERRE JETABLE','verre_jetable','interieure'),
  ('pushcart','CHASUBLE','chasuble','interieure'),
  ('pushcart','FULL BRANDING','full_branding','exterieure'),
  ('pushcart','Promotion','promotion','promotion'),
  ('porridge','PARASOLS','parasol','exterieure'),
  ('porridge','NAPPE','nappe','interieure'),
  ('porridge','HANGER','hanger','interieure'),
  ('porridge','VERRE JETABLE','verre_jetable','interieure'),
  ('porridge','TABLIER','tablier','interieure'),
  ('porridge','STANDARD','standard','promotion'),
  ('porridge','DEGUSTATION','degustation','promotion'),
  ('kiosque_aboki','AFFICHE','affiche','exterieure'),
  ('kiosque_aboki','THERMOS','thermos','interieure'),
  ('kiosque_aboki','VERRE','verre','interieure'),
  ('kiosque_aboki','CARAFE','carafe','interieure'),
  ('kiosque_aboki','MAISON BR','maison_br','interieure'),
  ('kiosque_aboki','CHASUBLE','chasuble','interieure'),
  ('kiosque_aboki','FULL BRANDING','full_branding','exterieure'),
  ('kiosque_aboki','Promotion','promotion','promotion')
) as v(segment,nom,code,emplacement)
where e.segment=v.segment and e.nom=v.nom;

alter table element_visibilite alter column code set not null;
alter table element_visibilite alter column emplacement set not null;
alter table element_visibilite drop constraint if exists element_visibilite_emplacement_check;
alter table element_visibilite
  add constraint element_visibilite_emplacement_check
  check (emplacement in ('exterieure','interieure','promotion'));
create unique index if not exists element_visibilite_segment_code_uq
  on element_visibilite(segment,code);

insert into standard_visibilite(segment,niveau_perfect_store,element_visibilite_id,requis)
select v.seg, v.niv, e.id, v.requis from (values
  ('boutique','flagship','Affiche',true),
  ('boutique','flagship','Flèche',true),
  ('boutique','flagship','Guirlande',true),
  ('boutique','flagship','sign board',true),
  ('boutique','flagship','Panneau privilège',true),
  ('boutique','flagship','Full branding',true),
  ('boutique','flagship','Reglette',true),
  ('boutique','flagship','Maison BR',true),
  ('boutique','flagship','Hanger',true),
  ('boutique','flagship','Wobler',true),
  ('boutique','flagship','Présentoire',true),
  ('boutique','flagship','TG',true),
  ('boutique','flagship','Plaque BR',true),
  ('boutique','flagship','Merchandising',true),
  ('boutique','flagship','Standard',true),
  ('boutique','flagship','Hotesses',true),
  ('boutique','flagship','Dégustation',true),
  ('boutique','vip','Affiche',true),
  ('boutique','vip','Flèche',true),
  ('boutique','vip','Guirlande',true),
  ('boutique','vip','sign board',true),
  ('boutique','vip','Panneau privilège',true),
  ('boutique','vip','Full branding',false),
  ('boutique','vip','Reglette',true),
  ('boutique','vip','Maison BR',true),
  ('boutique','vip','Hanger',true),
  ('boutique','vip','Wobler',true),
  ('boutique','vip','Présentoire',true),
  ('boutique','vip','TG',true),
  ('boutique','vip','Plaque BR',false),
  ('boutique','vip','Merchandising',true),
  ('boutique','vip','Standard',true),
  ('boutique','vip','Hotesses',true),
  ('boutique','vip','Dégustation',true),
  ('boutique','core','Affiche',true),
  ('boutique','core','Flèche',true),
  ('boutique','core','Guirlande',true),
  ('boutique','core','sign board',true),
  ('boutique','core','Panneau privilège',false),
  ('boutique','core','Full branding',false),
  ('boutique','core','Reglette',true),
  ('boutique','core','Maison BR',true),
  ('boutique','core','Hanger',true),
  ('boutique','core','Wobler',true),
  ('boutique','core','Présentoire',false),
  ('boutique','core','TG',false),
  ('boutique','core','Plaque BR',false),
  ('boutique','core','Merchandising',true),
  ('boutique','core','Standard',true),
  ('boutique','core','Hotesses',false),
  ('boutique','core','Dégustation',false),
  ('boutique','basic','Affiche',true),
  ('boutique','basic','Flèche',true),
  ('boutique','basic','Guirlande',true),
  ('boutique','basic','sign board',false),
  ('boutique','basic','Panneau privilège',false),
  ('boutique','basic','Full branding',false),
  ('boutique','basic','Reglette',true),
  ('boutique','basic','Maison BR',true),
  ('boutique','basic','Hanger',true),
  ('boutique','basic','Wobler',true),
  ('boutique','basic','Présentoire',false),
  ('boutique','basic','TG',false),
  ('boutique','basic','Plaque BR',false),
  ('boutique','basic','Merchandising',true),
  ('boutique','basic','Standard',true),
  ('boutique','basic','Hotesses',false),
  ('boutique','basic','Dégustation',false),
  ('superette','flagship','Affiche',true),
  ('superette','flagship','Flèche (Entrée et sortie)',true),
  ('superette','flagship','sign board lumineux',true),
  ('superette','flagship','Panneau privilège lumineux',true),
  ('superette','flagship','Reglette',true),
  ('superette','flagship','Espace BR',true),
  ('superette','flagship','Wobler rayon',true),
  ('superette','flagship','Présentoire',true),
  ('superette','flagship','TG',true),
  ('superette','flagship','Plaque BR',true),
  ('superette','flagship','Merchandising',true),
  ('superette','flagship','Standard',true),
  ('superette','flagship','Hotesses',true),
  ('superette','flagship','Dégustation',true),
  ('superette','vip','Affiche',true),
  ('superette','vip','Flèche (Entrée et sortie)',true),
  ('superette','vip','sign board lumineux',true),
  ('superette','vip','Panneau privilège lumineux',true),
  ('superette','vip','Reglette',true),
  ('superette','vip','Espace BR',true),
  ('superette','vip','Wobler rayon',true),
  ('superette','vip','Présentoire',true),
  ('superette','vip','TG',true),
  ('superette','vip','Plaque BR',true),
  ('superette','vip','Merchandising',true),
  ('superette','vip','Standard',true),
  ('superette','vip','Hotesses',true),
  ('superette','vip','Dégustation',true),
  ('superette','core','Affiche',true),
  ('superette','core','Flèche (Entrée et sortie)',true),
  ('superette','core','sign board lumineux',false),
  ('superette','core','Panneau privilège lumineux',false),
  ('superette','core','Reglette',true),
  ('superette','core','Espace BR',true),
  ('superette','core','Wobler rayon',true),
  ('superette','core','Présentoire',false),
  ('superette','core','TG',false),
  ('superette','core','Plaque BR',false),
  ('superette','core','Merchandising',true),
  ('superette','core','Standard',true),
  ('superette','core','Hotesses',true),
  ('superette','core','Dégustation',true),
  ('superette','basic','Affiche',true),
  ('superette','basic','Flèche (Entrée et sortie)',true),
  ('superette','basic','sign board lumineux',false),
  ('superette','basic','Panneau privilège lumineux',false),
  ('superette','basic','Reglette',true),
  ('superette','basic','Espace BR',true),
  ('superette','basic','Wobler rayon',true),
  ('superette','basic','Présentoire',false),
  ('superette','basic','TG',false),
  ('superette','basic','Plaque BR',false),
  ('superette','basic','Merchandising',true),
  ('superette','basic','Standard',true),
  ('superette','basic','Hotesses',false),
  ('superette','basic','Dégustation',false),
  ('table_top','flagship','PARASOLS',true),
  ('table_top','flagship','NAPPE',true),
  ('table_top','flagship','HANGER',true),
  ('table_top','flagship','TABLIER',true),
  ('table_top','flagship','Promotion',true),
  ('table_top','vip','PARASOLS',false),
  ('table_top','vip','NAPPE',true),
  ('table_top','vip','HANGER',true),
  ('table_top','vip','TABLIER',true),
  ('table_top','vip','Promotion',true),
  ('table_top','core','PARASOLS',false),
  ('table_top','core','NAPPE',true),
  ('table_top','core','HANGER',true),
  ('table_top','core','TABLIER',false),
  ('table_top','core','Promotion',true),
  ('table_top','basic','PARASOLS',false),
  ('table_top','basic','NAPPE',false),
  ('table_top','basic','HANGER',true),
  ('table_top','basic','TABLIER',false),
  ('table_top','basic','Promotion',false),
  ('pushcart','flagship','AFFICHE',false),
  ('pushcart','flagship','THERMOS',true),
  ('pushcart','flagship','VERRE JETABLE',true),
  ('pushcart','flagship','CHASUBLE',true),
  ('pushcart','flagship','FULL BRANDING',true),
  ('pushcart','flagship','Promotion',true),
  ('pushcart','vip','AFFICHE',false),
  ('pushcart','vip','THERMOS',true),
  ('pushcart','vip','VERRE JETABLE',true),
  ('pushcart','vip','CHASUBLE',true),
  ('pushcart','vip','FULL BRANDING',false),
  ('pushcart','vip','Promotion',true),
  ('pushcart','core','AFFICHE',false),
  ('pushcart','core','THERMOS',true),
  ('pushcart','core','VERRE JETABLE',true),
  ('pushcart','core','CHASUBLE',false),
  ('pushcart','core','FULL BRANDING',false),
  ('pushcart','core','Promotion',true),
  ('pushcart','basic','AFFICHE',false),
  ('pushcart','basic','THERMOS',false),
  ('pushcart','basic','VERRE JETABLE',false),
  ('pushcart','basic','CHASUBLE',false),
  ('pushcart','basic','FULL BRANDING',false),
  ('pushcart','basic','Promotion',true),
  ('porridge','flagship','PARASOLS',true),
  ('porridge','flagship','NAPPE',true),
  ('porridge','flagship','HANGER',true),
  ('porridge','flagship','VERRE JETABLE',true),
  ('porridge','flagship','TABLIER',true),
  ('porridge','flagship','STANDARD',true),
  ('porridge','flagship','DEGUSTATION',true),
  ('porridge','vip','PARASOLS',false),
  ('porridge','vip','NAPPE',true),
  ('porridge','vip','HANGER',true),
  ('porridge','vip','VERRE JETABLE',true),
  ('porridge','vip','TABLIER',false),
  ('porridge','vip','STANDARD',true),
  ('porridge','vip','DEGUSTATION',false),
  ('porridge','core','PARASOLS',false),
  ('porridge','core','NAPPE',false),
  ('porridge','core','HANGER',true),
  ('porridge','core','VERRE JETABLE',true),
  ('porridge','core','TABLIER',false),
  ('porridge','core','STANDARD',true),
  ('porridge','core','DEGUSTATION',false),
  ('porridge','basic','PARASOLS',false),
  ('porridge','basic','NAPPE',false),
  ('porridge','basic','HANGER',true),
  ('porridge','basic','VERRE JETABLE',false),
  ('porridge','basic','TABLIER',false),
  ('porridge','basic','STANDARD',true),
  ('porridge','basic','DEGUSTATION',false),
  ('kiosque_aboki','flagship','AFFICHE',true),
  ('kiosque_aboki','flagship','THERMOS',true),
  ('kiosque_aboki','flagship','VERRE',true),
  ('kiosque_aboki','flagship','CARAFE',true),
  ('kiosque_aboki','flagship','MAISON BR',true),
  ('kiosque_aboki','flagship','CHASUBLE',true),
  ('kiosque_aboki','flagship','FULL BRANDING',true),
  ('kiosque_aboki','flagship','Promotion',true),
  ('kiosque_aboki','vip','AFFICHE',false),
  ('kiosque_aboki','vip','THERMOS',true),
  ('kiosque_aboki','vip','VERRE',true),
  ('kiosque_aboki','vip','CARAFE',true),
  ('kiosque_aboki','vip','MAISON BR',true),
  ('kiosque_aboki','vip','CHASUBLE',true),
  ('kiosque_aboki','vip','FULL BRANDING',false),
  ('kiosque_aboki','vip','Promotion',true),
  ('kiosque_aboki','core','AFFICHE',false),
  ('kiosque_aboki','core','THERMOS',false),
  ('kiosque_aboki','core','VERRE',true),
  ('kiosque_aboki','core','CARAFE',true),
  ('kiosque_aboki','core','MAISON BR',true),
  ('kiosque_aboki','core','CHASUBLE',false),
  ('kiosque_aboki','core','FULL BRANDING',false),
  ('kiosque_aboki','core','Promotion',true),
  ('kiosque_aboki','basic','AFFICHE',false),
  ('kiosque_aboki','basic','THERMOS',false),
  ('kiosque_aboki','basic','VERRE',false),
  ('kiosque_aboki','basic','CARAFE',false),
  ('kiosque_aboki','basic','MAISON BR',false),
  ('kiosque_aboki','basic','CHASUBLE',false),
  ('kiosque_aboki','basic','FULL BRANDING',false),
  ('kiosque_aboki','basic','Promotion',false)
) as v(seg,niv,nom,requis)
join element_visibilite e on e.segment=v.seg and e.nom=v.nom
on conflict (niveau_perfect_store,element_visibilite_id) do update set
  segment = excluded.segment,
  requis = excluded.requis;

-- Résolution type de PDV -> matrice de visibilité.
create table if not exists segment_visibilite_type_pdv (
  type_pdv_id bigint primary key references type_pdv(id) on delete cascade,
  segment text not null check (segment in
    ('boutique','superette','table_top','pushcart','porridge','kiosque_aboki'))
);

insert into segment_visibilite_type_pdv(type_pdv_id,segment)
select tp.id, v.segment from (values
  ('Boutique A','boutique'),('Boutique B','boutique'),('Boutique C','boutique'),
  ('Superettes A','superette'),('Superettes B','superette'),('Superettes C','superette'),
  ('Hypermarket','superette'),('Supermarket A','superette'),('Supermarket B','superette'),('Supermarket C','superette'),
  ('Table Top','table_top'),('Open Market Table Top','table_top'),
  ('Pushcard A','pushcart'),('Pushcard B','pushcart'),
  ('Porridge','porridge'),
  ('Kiosk A','kiosque_aboki'),('Kiosk B','kiosque_aboki'),
  ('Aboki A','kiosque_aboki'),('Aboki B','kiosque_aboki'),
  ('Horeca coffee','kiosque_aboki')
) as v(nom,segment)
join type_pdv tp on tp.nom=v.nom
on conflict (type_pdv_id) do update set segment=excluded.segment;

alter table element_visibilite enable row level security;
alter table standard_visibilite enable row level security;
alter table segment_visibilite_type_pdv enable row level security;

drop policy if exists element_visibilite_read on element_visibilite;
create policy element_visibilite_read on element_visibilite
  for select to authenticated using (true);
drop policy if exists standard_visibilite_read on standard_visibilite;
create policy standard_visibilite_read on standard_visibilite
  for select to authenticated using (true);
drop policy if exists segment_visibilite_type_pdv_read on segment_visibilite_type_pdv;
create policy segment_visibilite_type_pdv_read on segment_visibilite_type_pdv
  for select to authenticated using (true);

commit;
