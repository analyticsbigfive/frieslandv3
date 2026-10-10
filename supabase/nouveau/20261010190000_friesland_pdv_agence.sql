-- ============================================================================
-- ÉCRAN « PDV DE L'AGENCE » (10/10/2026)
--
-- Points de vente › PDV de l'agence : les PDV visités ou recensés par les
-- merchandisers d'une agence (mêmes PDV que carte_pdv_agence, 20261010180000),
-- avec leurs visites (nombre, dernière, dernier merchandiser) et le
-- merchandiser qui les a recensés. Atom : 8 496 PDV, 343 sans GPS, 1 219
-- recensés jamais visités. Lecture seule : un PDV sans GPS prend la position
-- de sa prochaine visite dans l'application (geolocaliserPdv).
--
-- Compte agence : toujours son agence, quel que soit p_agence. Admin et
-- superviseur : l'agence passée en paramètre. Tout autre compte : refus
-- (42501). Testée en production dans une transaction annulée (Elias, Elias
-- avec une autre agence, admin avec et sans agence, commercial). Idempotent.
-- ============================================================================
begin;

create or replace function public.pdv_agence(p_agence text default null)
returns table(
  pdv_id text, nom_pdv text, zone text, quartier text, canal text, sous_categorie_pdv text,
  distributor_name text, adressage text, geolocation_lat double precision, geolocation_lng double precision,
  recense_par text, nb_visites integer, derniere_visite timestamptz, dernier_merchandiser text
)
language plpgsql stable security definer
set search_path to 'public'
as $$
#variable_conflict use_column
declare
  v_agence text := public.agence_courante();
begin
  if v_agence is null and public.role_actif_courant() in ('admin', 'superviseur') then
    v_agence := nullif(p_agence, '');
  end if;
  if v_agence is null or v_agence = 'friesland' then
    raise exception 'Accès refusé aux points de vente de l''agence' using errcode = '42501';
  end if;

  return query
  with merch as materialized (
    select m.id, m.nom, lower(m.email) as email from public.profiles m
    where m.role = 'merchandiser' and m.employeur = v_agence
  ),
  vis as materialized (
    select v.pdv_id, count(*)::int as n, max(v.date_visite) as derniere,
           (array_agg(m.nom order by v.date_visite desc))[1] as dernier
    from public.visites v join merch m on m.id = v.user_id
    group by v.pdv_id
  )
  select p.pdv_id, p.nom_pdv, p.zone, p.quartier, p.canal, p.sous_categorie_pdv, p.distributor_name, p.adressage,
         p.geolocation_lat, p.geolocation_lng,
         coalesce(mc.nom, ma.nom), coalesce(vi.n, 0), vi.derniere, vi.dernier
  from public.pdv p
  left join vis vi on vi.pdv_id = p.pdv_id
  left join merch mc on mc.id = p.created_by
  left join merch ma on ma.email = lower(p.ajoute_par)
  where p.is_active and (vi.pdv_id is not null or mc.id is not null or ma.id is not null);
end;
$$;

revoke all on function public.pdv_agence(text) from public, anon;
grant execute on function public.pdv_agence(text) to authenticated;

commit;
