-- ============================================================================
-- ROUTING MENSUEL : UN POINT GPS ET UN RAYON PAR CASE
--
-- Analyse du 09/10/2026 (lieux d'Elias) : 93 % des PDV n'ont pas d'area et
-- les quartiers sont écrits autrement par l'agence, le DMS et le référentiel.
-- Les 204 lieux du routing ont maintenant une position (160 validées). Une
-- case peut donc porter un point : la tournée prend les PDV du portefeuille
-- du merchandiser (son distributeur DMS, celui du SSF) dans ce rayon.
-- Sans point, rien ne change : quartiers de la case, puis commune.
--
-- À appliquer AVANT le déploiement du front qui écrit ces colonnes.
-- Idempotent.
-- ============================================================================
begin;

alter table public.routing_mensuel add column if not exists latitude double precision;
alter table public.routing_mensuel add column if not exists longitude double precision;
alter table public.routing_mensuel add column if not exists rayon_m integer;

alter table public.routing_mensuel drop constraint if exists routing_mensuel_point_valide;
alter table public.routing_mensuel add constraint routing_mensuel_point_valide check (
  (latitude is null and longitude is null)
  or (latitude is not null and longitude is not null
      and latitude between -90 and 90 and longitude between -180 and 180)
);
alter table public.routing_mensuel drop constraint if exists routing_mensuel_rayon_valide;
alter table public.routing_mensuel add constraint routing_mensuel_rayon_valide check (rayon_m is null or rayon_m between 100 and 3000);

comment on column public.routing_mensuel.latitude is
  'Point du lieu de la case (WGS84). Avec longitude : la tournée prend les PDV du portefeuille du merchandiser à moins de rayon_m (500 m par défaut).';
comment on column public.routing_mensuel.rayon_m is
  'Rayon autour du point, en mètres (100 à 3 000 ; vide = 500).';

commit;
