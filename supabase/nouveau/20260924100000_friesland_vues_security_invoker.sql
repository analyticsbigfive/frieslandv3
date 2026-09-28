-- ============================================================================
-- VUES DE STATISTIQUES : SECURITY INVOKER + PLUS D'ACCÈS ANONYME
--
-- Alerte Supabase « Security Definer View » (14 vues, niveau CRITICAL).
--
-- Une vue Postgres s'exécute par défaut avec les droits de son propriétaire
-- (postgres), qui ignore la RLS : les politiques de `visites` et `pdv` ne
-- s'appliquaient donc pas à travers ces vues. Et `anon` avait le droit SELECT :
-- avec la seule clé publique (embarquée dans l'app et le site), sans connexion,
-- on lisait par exemple les 26 000+ lignes de `v_visites_detail`.
--
-- `security_invoker = on` : la vue s'exécute avec les droits de l'appelant,
-- donc la RLS des tables sources s'applique —
--   admin / superviseur : tout (inchangé pour les tableaux de bord admin) ;
--   commercial          : son périmètre (pdv_ids_perimetre) ;
--   merchandiser        : ses propres visites ;
--   anon                : rien.
-- On retire en plus le SELECT à `anon` : aucune de ces vues n'est lue sans
-- session (toutes sont appelées depuis l'espace admin, après connexion).
--
-- `v_perfect_store_liste` et `v_perfect_store_liste_full` sont déjà en
-- security_invoker et sans accès anon : non concernées.
-- ============================================================================
begin;

do $$
declare
  v text;
begin
  foreach v in array array[
    'v_couverture',
    'v_couverture_globale',
    'v_dispo_produits_zone',
    'v_distribution_pdv',
    'v_perfect_store_evolution',
    'v_perfect_store_global',
    'v_perfect_store_manques',
    'v_perfect_store_par_categorie_pdv',
    'v_perfect_store_par_type',
    'v_performance_commerciaux',
    'v_stats_visites',
    'v_stats_zone_secteur',
    'v_visites_detail',
    'v_visites_par_jour'
  ] loop
    execute format('alter view public.%I set (security_invoker = on)', v);
    execute format('revoke all on public.%I from anon', v);
  end loop;
end $$;

commit;
