-- ============================================================================
-- VALIDATION DES TOURNÉES : ZONES PROPOSÉES PAR LE MERCHANDISER (20/10/2026)
-- Quand un merchandiser répond « Non » à un secteur Atom ou à un territoire
-- Friesland, il coche ce qu'il couvre vraiment, avec le même mécanisme que
-- l'admin (territoires, puis quartiers de ces territoires, secteurs Atom).
-- Ce n'est qu'une PROPOSITION : profiles n'est pas modifié. L'admin en tire
-- un rapport (à ajouter / à retirer) pour mettre la base à jour ensuite.
-- zones_proposees = { "secteursAtom": [...], "territoires": [codes], "quartiers": [noms] }
-- Idempotente.
-- ============================================================================
begin;

alter table public.validation_tournee_merch add column if not exists zones_proposees jsonb;
comment on column public.validation_tournee_merch.zones_proposees is
  'Zones que le merchandiser dit couvrir (secteurs Atom, codes de territoire, quartiers). Proposition, jamais recopiée automatiquement dans profiles.';

commit;
