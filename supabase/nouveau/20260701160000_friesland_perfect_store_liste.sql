-- ============================================================================
-- LISTE DES PERFECT STORES PAR NIVEAU
-- Une ligne par PDV, basée sur sa visite scorée la plus récente.
-- ============================================================================
begin;

create or replace view public.v_perfect_store_liste
with (security_invoker = true)
as
select
  latest.visite_id,
  latest.pdv_id,
  latest.nom_pdv,
  latest.type_pdv,
  latest.zone,
  latest.date_visite,
  latest.commercial,
  latest.niveau,
  latest.score_global,
  latest.dispo_rayon,
  latest.assortiment,
  latest.visibilite,
  latest.promotion
from (
  select distinct on (v.pdv_id)
    r.visite_id,
    v.pdv_id,
    p.nom_pdv,
    coalesce(p.sous_categorie_pdv, 'Non renseigné') as type_pdv,
    p.zone,
    v.date_visite,
    v.commercial,
    r.niveau,
    r.score_global,
    r.dispo_rayon,
    r.assortiment,
    r.visibilite,
    r.promotion
  from public.resultat_perfect_store r
  join public.visites v on v.id = r.visite_id
  join public.pdv p on p.pdv_id = v.pdv_id
  order by v.pdv_id, v.date_visite desc, r.calcule_le desc
) latest
where latest.niveau is not null;

revoke all on public.v_perfect_store_liste from public, anon;
grant select on public.v_perfect_store_liste to authenticated;

commit;
