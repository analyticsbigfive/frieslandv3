-- ============================================================================
-- SSF : CONTRAINTES DE PRODUCTION REPORTÉES DANS LE DÉPÔT
--
-- La production porte, sur public.ssf, deux règles absentes des migrations :
-- un distributeur obligatoire et un nom unique sans accents ni casse. Les
-- tests (PGlite) partent des migrations : sans elles, ils acceptaient ce que
-- la production refuse (09/10/2026 : l'import « Routing mensuel » s'est
-- arrêté en production sur ssf_source_valide, voir 20261009110000).
--
-- Sans effet en production (tout y existe déjà). Idempotent.
-- ============================================================================
begin;

-- Distributeur obligatoire (seulement si aucune ligne n'en manque).
do $$
begin
  if not exists (select 1 from public.ssf where distributeur_id is null) then
    alter table public.ssf alter column distributeur_id set not null;
  else
    raise notice 'ssf.distributeur_id : des SSF sans distributeur, contrainte non posée';
  end if;
end $$;

-- Nom unique, accents et casse ignorés.
create unique index if not exists ssf_nom_unique on public.ssf (upper(public.unaccent_safe(nom)));

commit;
