-- ============================================================================
-- EXPORT DU ROUTING DU MOIS (05/11/2026, demande de Jean Luc)
--
-- Fichier à envoyer à l'agence et à Friesland : pour chaque merchandiser
-- d'agence (ceux qui ont un routing mensuel actif), chaque jour du mois avec
-- son plan (point de visite, commune, quartiers, SSF, distributeur du
-- routing) et les points de vente de sa tournée (code, nom, type, quartier,
-- territoire, distributeur, GPS, adresse, statut).
--
-- Les agents Friesland (règles « périmètre » : tout le portefeuille chaque
-- jour, ~2 300 PDV par tournée) n'ont pas de routing mensuel : ils ne sont pas
-- dans cet export.
--
-- SECURITY INVOKER : les droits de lecture de chacun s'appliquent (un compte
-- agence ne voit que ses merchandisers). Une ligne par étape de tournée ; une
-- tournée sans étape (jour de visite libre) donne une ligne sans PDV.
-- Les tournées du mois sont générées avant l'export par l'écran Routing
-- (materialiser_routings_periode), merchandiser par merchandiser.
--
-- Appliquée le 05/11/2026 par le MCP Supabase (lecture seule) : novembre =
-- 1 764 lignes pour 9 merchandisers Atom (tournées générées jusqu'au 12/11).
-- ============================================================================
begin;

create or replace function public.export_routing_mois(p_debut date, p_fin date, p_employeur text default null)
returns table (
  user_id uuid,
  merchandiser text,
  employeur text,
  date_routing date,
  jour text,
  semaine integer,
  point_visite text,
  commune text,
  quartiers_plan text,
  ssf text,
  distributeur_routing text,
  type_jour text,
  ordre integer,
  pdv_id text,
  code_client text,
  nom_pdv text,
  type_pdv text,
  quartier text,
  territoire text,
  distributeur text,
  latitude double precision,
  longitude double precision,
  adresse text,
  statut text,
  origine text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.user_id,
    pr.nom,
    pr.employeur,
    r.date_routing,
    (array['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'])[extract(dow from r.date_routing)::int + 1],
    semaine_routing(r.date_routing),
    rm.point_visite,
    rm.commune,
    nullif(array_to_string(rm.quartiers, ', '), ''),
    coalesce(s.nom, rm.ssf_texte),
    rm.distributeur,
    case coalesce(r.objectifs->>'type', '')
      when 'visite_libre' then 'Visite libre'
      when 'a_trouver' then 'Tournée + pushcarts à trouver'
      else 'Tournée'
    end,
    rp.position_order,
    rp.pdv_id,
    p.mdm,
    p.nom_pdv,
    p.sous_categorie_pdv,
    p.quartier,
    p.zone,
    p.distributor_name,
    p.geolocation_lat::double precision,
    p.geolocation_lng::double precision,
    p.adressage,
    case rp.status
      when 'completed' then 'Fait'
      when 'pending' then 'À faire'
      when 'in_progress' then 'En cours'
      when 'skipped' then 'Passé'
      else rp.status
    end,
    case
      when rp.id is null then null
      when rp.objectifs ? 'cree_ce_jour' then 'Créé sur place'
      when coalesce((rp.objectifs->>'a_trouver')::boolean, false) then 'Pushcart trouvé'
      when coalesce((rp.objectifs->>'visite_libre')::boolean, false) then 'Visite libre'
      else 'Prévu'
    end
  from routings r
  join profiles pr on pr.id = r.user_id
  left join routing_mensuel rm
    on rm.merchandiser_id = r.user_id and rm.actif
   and rm.jour_semaine = extract(dow from r.date_routing)::int
   and rm.semaine_du_mois = semaine_routing(r.date_routing)
  left join ssf s on s.id = rm.ssf_id
  left join routing_pdv rp on rp.routing_id = r.id
  left join pdv p on p.pdv_id = rp.pdv_id
  where r.date_routing between p_debut and p_fin
    and r.status <> 'cancelled'
    and (p_employeur is null or pr.employeur = p_employeur)
    and exists (select 1 from routing_mensuel x where x.merchandiser_id = r.user_id and x.actif)
  order by pr.nom, r.user_id, r.date_routing, rp.position_order nulls first, rp.pdv_id
$$;

comment on function public.export_routing_mois(date, date, text) is
  'Routing du mois des merchandisers d''agence (routing mensuel actif) : plan du jour et points de vente de chaque tournée (migration 20261105170000).';

revoke all on function public.export_routing_mois(date, date, text) from public, anon;
grant execute on function public.export_routing_mois(date, date, text) to authenticated;

commit;
