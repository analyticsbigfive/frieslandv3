-- ============================================================================
-- PERFECT STORE : UNE VISITE SANS AUCUN RELEVÉ N'EST PAS ÉVALUÉE (10/10/2026)
-- APPLIQUÉE EN PRODUCTION le 10/10/2026 (MCP) : 10 080 résultats supprimés ;
-- 26 269 visites évaluées, disponibilité moyenne 53,6 %, assortiment 76,3 %.
--
-- Les 10 080 visites importées de l'export Atom (9 juin → 30 septembre 2026,
-- 7 321 PDV) n'ont ni relevé produit ni relevé de visibilité : ce sont des
-- passages. Le calcul leur donnait 0 % partout (disponibilité, présence,
-- assortiment, visibilité) : elles tiraient les moyennes vers le bas (17,9 %
-- de disponibilité affichés pour 53,6 % sur les visites avec relevé) et
-- leurs PDV comptaient « non conformes » sans avoir été évalués.
--
-- Décision du 10/10 : une visite sans relevé produit NI de visibilité n'a pas
-- de résultat Perfect Store (ligne supprimée de resultat_perfect_store et de
-- visite_perfect_store). Elle reste une visite (couverture, activité) ; la
-- fiche affiche « Non évalué ».
--
-- Mise en œuvre : les fonctions de calcul existantes sont renommées en
-- *_complet ; calculer_perfect_store / compute_perfect_store deviennent des
-- enveloppes (mêmes signatures, mêmes droits) que les déclencheurs appellent
-- par leur nom. Idempotent.
-- ============================================================================
begin;

-- Vrai si la visite n'a aucun relevé : ni produits, ni visibilité.
create or replace function public.visite_sans_releve(p_data jsonb)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $function$
  select (jsonb_typeof(p_data->'produits') is distinct from 'object' or p_data->'produits' = '{}'::jsonb)
     and (jsonb_typeof(p_data->'visibilite') is distinct from 'object' or p_data->'visibilite' = '{}'::jsonb)
$function$;

do $$
begin
  if to_regprocedure('public.calculer_perfect_store_complet(uuid,text)') is null then
    alter function public.calculer_perfect_store(uuid, text) rename to calculer_perfect_store_complet;
  end if;
  if to_regprocedure('public.compute_perfect_store_complet(text,text)') is null then
    alter function public.compute_perfect_store(text, text) rename to compute_perfect_store_complet;
  end if;
end $$;

create or replace function public.calculer_perfect_store(p_visite_id uuid, p_base_calcul text default 'taux_vente'::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_data jsonb;
begin
  select data into v_data from visites where id = p_visite_id;
  if v_data is null then return; end if;
  if public.visite_sans_releve(v_data) then
    delete from resultat_perfect_store where visite_id = p_visite_id;
    return;
  end if;
  perform public.calculer_perfect_store_complet(p_visite_id, p_base_calcul);
end;
$function$;

create or replace function public.compute_perfect_store(p_visite_id text, p_basis text default 'taux_vente'::text)
 returns visite_perfect_store
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_data jsonb;
begin
  select data into v_data from public.visites where visite_id = p_visite_id;
  if v_data is not null and public.visite_sans_releve(v_data) then
    delete from public.visite_perfect_store where visite_id = p_visite_id;
    return null;
  end if;
  return public.compute_perfect_store_complet(p_visite_id, p_basis);
end;
$function$;

revoke all on function public.calculer_perfect_store(uuid, text) from public, anon;
revoke all on function public.compute_perfect_store(text, text) from public, anon;
grant execute on function public.calculer_perfect_store(uuid, text) to authenticated, service_role;
grant execute on function public.compute_perfect_store(text, text) to authenticated, service_role;
grant execute on function public.visite_sans_releve(jsonb) to authenticated;

-- Résultats existants des visites sans relevé.
delete from public.resultat_perfect_store r
  using public.visites v
  where v.id = r.visite_id and public.visite_sans_releve(v.data);
delete from public.visite_perfect_store r
  using public.visites v
  where v.visite_id = r.visite_id and public.visite_sans_releve(v.data);

commit;
