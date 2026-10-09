-- ============================================================================
-- SOURCE DES SSF CRÉÉS PAR LES IMPORTS TERRAIN
--
-- La production porte une contrainte absente des migrations du dépôt :
-- ssf_source_valide n'accepte que 'export_2026-09' (chargement initial) et
-- 'dashboard'. L'opération ssf.creer des imports (scripts/lib/imports/
-- operations.mjs) écrit la source du lot : 'client-<fichier>' (routing
-- mensuel, sous-zones SSF), 'dms-<fichier>' (routing des SSF), 'import' par
-- défaut. Le 09/10/2026, l'import « Routing mensuel » s'est arrêté sur la
-- création d'Oboumou Charles (0 opération sur 90, rien d'écrit).
--
-- La contrainte est élargie à ces sources ; les valeurs existantes restent
-- valides. Idempotent.
-- ============================================================================
begin;

alter table public.ssf drop constraint if exists ssf_source_valide;
alter table public.ssf add constraint ssf_source_valide
  check (
    source is null
    or source in ('dashboard', 'import')
    or source ~ '^(export_|client-|dms-)'
  );

commit;
