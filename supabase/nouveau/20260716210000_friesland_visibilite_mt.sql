-- ============================================================================
-- MATRICE DE VISIBILITÉ MODERN TRADE dédiée (segment 'mt').
-- Source : docs/big-five-kpi-csv/crictere-perfect-store-mt.csv (onglet
-- « CRICTERE PERFECT STORE MT » du fichier BIG FIVE KPI UPDATE).
--
-- Jusqu'ici les supermarchés étaient rabattus sur la matrice 'superette'
-- (repli provisoire) : la vraie matrice MT (Niche, Wobbler, Top shelf, Bacs,
-- Réglettes, TG / promo Plot, Hôtesses) n'existait pas en base. Corrigé ici.
--
-- Matrice (X du CSV brut) :
--   FLAGSHIP : niche, wobler, top_shelf, bacs, reglette, tg | plot, hotesses
--   VIP      : wobler, bacs, reglette, tg                   | hotesses
--   CORE     : wobler, bacs, reglette, tg                   | hotesses
--   BASIC    : wobler, reglette, tg                         | hotesses
-- ⚠️ NB : le résumé kpi-merchandising-v2.md §3 disait « Top shelf » pour
-- VIP/CORE/BASIC ; le CSV brut (export direct) dit Wobbler + Bacs. On suit le
-- CSV brut — si Friesland conteste, la matrice s'édite dans l'admin standards.
--
-- Les codes réutilisent ceux du formulaire quand la sémantique correspond
-- (wobler, reglette, tg, hotesses) ; nouveaux codes : niche, top_shelf, bacs,
-- plot (lus via data.visibilite.standards.<code>, fallback natif du moteur).
--
-- Idempotent. Recalcule l'historique. Dépend de 20260630130000/130100.
-- ============================================================================
begin;

-- 1. Autoriser le segment 'mt' (element_visibilite + segment_visibilite_type_pdv).
do $$
declare c text;
begin
  select conname into c from pg_constraint
  where conrelid = 'element_visibilite'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%segment%';
  if c is not null then execute format('alter table element_visibilite drop constraint %I', c); end if;
end $$;
alter table element_visibilite add constraint element_visibilite_segment_check
  check (segment in ('boutique','superette','table_top','pushcart','porridge','kiosque_aboki','mt'));

do $$
declare c text;
begin
  select conname into c from pg_constraint
  where conrelid = 'segment_visibilite_type_pdv'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%segment%';
  if c is not null then execute format('alter table segment_visibilite_type_pdv drop constraint %I', c); end if;
end $$;
alter table segment_visibilite_type_pdv add constraint segment_visibilite_type_pdv_segment_check
  check (segment in ('boutique','superette','table_top','pushcart','porridge','kiosque_aboki','mt'));

-- 2. Éléments de visibilité MT.
insert into element_visibilite(segment, nom, code, pilier, emplacement, optionnel)
select v.* from (values
  ('mt','Niche','niche','visibilite','interieure',false),
  ('mt','Wobbler','wobler','visibilite','interieure',false),
  ('mt','Top shelf','top_shelf','visibilite','interieure',false),
  ('mt','Bacs','bacs','visibilite','interieure',false),
  ('mt','Réglettes','reglette','visibilite','interieure',false),
  ('mt','TG (activités promotionnelles)','tg','visibilite','interieure',false),
  ('mt','Plot','plot','promotion','promotion',false),
  ('mt','Hôtesses','hotesses','promotion','promotion',false)
) as v(segment,nom,code,pilier,emplacement,optionnel)
where not exists (
  select 1 from element_visibilite e where e.segment=v.segment and e.code=v.code
);

-- 3. Matrice standard_visibilite (requis par niveau), depuis le CSV brut.
insert into standard_visibilite(segment, niveau_perfect_store, element_visibilite_id, requis)
select 'mt', niv.niveau, e.id, (e.code = any(niv.codes))
from element_visibilite e
cross join (values
  ('flagship', array['niche','wobler','top_shelf','bacs','reglette','tg','plot','hotesses']),
  ('vip',      array['wobler','bacs','reglette','tg','hotesses']),
  ('core',     array['wobler','bacs','reglette','tg','hotesses']),
  ('basic',    array['wobler','reglette','tg','hotesses'])
) as niv(niveau, codes)
where e.segment = 'mt'
on conflict do nothing;

-- 4. Rattacher les types MT à la matrice 'mt' (remplace le repli 'superette').
update segment_visibilite_type_pdv sv
set segment = 'mt'
from type_pdv tp
where tp.id = sv.type_pdv_id
  and tp.nom in ('Hypermarket','Supermarket A','Supermarket B','Supermarket C');

-- 5. Visite seed MT (PS-VIS-003) : compléter les standards avec les codes MT
--    pour que le flagship de démo reste flagship sous la nouvelle matrice.
update visites
set data = jsonb_set(
  data, '{visibilite,standards}',
  (data->'visibilite'->'standards')
    || jsonb_build_object('niche',true,'top_shelf',true,'bacs',true,'plot',true)
)
where visite_id = 'PS-VIS-003';

-- 6. Recalcul complet (les PDV MT changent de matrice).
select calculer_perfect_store(id, 'taux_vente') from visites;

commit;
