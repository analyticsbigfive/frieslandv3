-- ============================================================================
-- LISTE COMPLÈTE des Perfect Stores par niveau (non conformes INCLUS)
-- Comme v_perfect_store_liste, mais garde aussi les PDV sans niveau
-- (niveau = 'NON CONFORME'), pour une liste filtrable exhaustive.
-- ============================================================================
begin;

create or replace view public.v_perfect_store_liste_full
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
  coalesce(latest.niveau, 'NON CONFORME') as niveau,
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
) latest;

revoke all on public.v_perfect_store_liste_full from public, anon;
grant select on public.v_perfect_store_liste_full to authenticated;

commit;
