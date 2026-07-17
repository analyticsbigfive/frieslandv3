-- ============================================================================
-- Mise à jour STANDARDS DE VISIBILITÉ d'après les grilles client du 17/07/2026
-- Sources : docs/ajour/criteres-gt.csv (Boutique, Supérette)
--           docs/ajour/criteres-canaux-alt.csv (Table Top, Pushcart, Porridge,
--           Kiosque & Aboki)
-- Remplace les valeurs provisoires du seed 20260630130000. Table Top était
-- déjà conforme ; le segment mt (Modern Trade) est géré par 20260716210000.
-- Migration idempotente, rejouable.
-- ============================================================================
begin;

-- 1. Nouvel élément : NAPPE brandée du Kiosque & Aboki (absente du seed initial)
insert into element_visibilite(segment,nom,pilier,optionnel,code,emplacement)
values ('kiosque_aboki','NAPPE','visibilite',false,'nappe','interieure')
on conflict (segment,nom) do update set
  pilier = excluded.pilier,
  optionnel = excluded.optionnel,
  code = excluded.code,
  emplacement = excluded.emplacement;

insert into standard_visibilite(segment,niveau_perfect_store,element_visibilite_id,requis)
select 'kiosque_aboki', v.niv, e.id, v.requis
from (values
  ('flagship',true),
  ('vip',true),
  ('core',false),
  ('basic',false)
) as v(niv,requis)
join element_visibilite e on e.segment='kiosque_aboki' and e.nom='NAPPE'
on conflict (niveau_perfect_store,element_visibilite_id) do update set
  segment = excluded.segment,
  requis = excluded.requis;

-- 2. Corrections de la matrice requis (écarts seed provisoire -> grilles client)
update standard_visibilite s
set requis = v.requis
from (values
  ('boutique','core','Guirlande',false),
  ('boutique','core','sign board',false),
  ('boutique','basic','Flèche',false),
  ('boutique','basic','Guirlande',false),
  ('boutique','basic','Wobler',false),
  ('superette','vip','sign board lumineux',false),
  ('superette','vip','Panneau privilège lumineux',false),
  ('superette','vip','TG',false),
  ('superette','core','Dégustation',false),
  ('superette','basic','Flèche (Entrée et sortie)',false),
  ('superette','basic','Wobler rayon',false),
  ('pushcart','vip','AFFICHE',true),
  ('pushcart','core','AFFICHE',true),
  ('pushcart','basic','AFFICHE',true),
  ('porridge','vip','PARASOLS',true),
  ('porridge','core','NAPPE',true),
  ('kiosque_aboki','vip','AFFICHE',true),
  ('kiosque_aboki','core','AFFICHE',true),
  ('kiosque_aboki','basic','AFFICHE',true)
) as v(seg,niv,nom,requis)
join element_visibilite e on e.segment=v.seg and e.nom=v.nom
where s.niveau_perfect_store=v.niv and s.element_visibilite_id=e.id;

-- 3. Flags optionnel d'après les en-têtes "(Optionnel)" des nouvelles grilles.
--    optionnel = true : l'élément ne compte pas dans la note Perfect Store.
update element_visibilite e
set optionnel = true
from (values
  ('boutique','Flèche'),
  ('boutique','Hanger'),
  ('boutique','Wobler'),
  ('boutique','Présentoire'),
  ('boutique','TG'),
  ('superette','Flèche (Entrée et sortie)'),
  ('superette','Reglette'),
  ('superette','Wobler rayon'),
  ('superette','Présentoire'),
  ('superette','TG'),
  ('pushcart','VERRE JETABLE'),
  ('porridge','VERRE JETABLE')
) as v(segment,nom)
where e.segment=v.segment and e.nom=v.nom;

commit;
