-- ============================================================================
-- JOURNAL DES IMPORTS : TYPE « liste-pdv » (14/10/2026)
--
-- Correctif de 20261014100000 (import « Liste de PDV par jour », PR #22) :
-- l'écran crée le lot dans import_lot avant d'écrire, mais la contrainte
-- import_lot_type_check ne connaissait pas « liste-pdv » (« Le journal des
-- imports n'est pas disponible sur le serveur : rien n'a été écrit »).
--
-- 1. import_lot_type_check : + 'liste-pdv'.
-- 2. Compte agence : une politique AJOUTÉE pour ses lots « liste-pdv »
--    (import_lot_agence, limitée au routing mensuel, n'est pas élargie).
--
-- Idempotent. APPLIQUÉE en production le 14/10/2026 (connecteur Supabase, apply_migration).
-- ============================================================================
begin;

alter table public.import_lot drop constraint if exists import_lot_type_check;
alter table public.import_lot add constraint import_lot_type_check
  check (type in ('dms-pdv', 'merch-dms', 'routing-atom', 'ssf-sous-zones', 'routing-ssf-dms', 'routing-mensuel', 'liste-pdv'));

drop policy if exists import_lot_agence_liste on public.import_lot;
create policy import_lot_agence_liste on public.import_lot for all to authenticated
  using ((select public.agence_courante()) is not null and type = 'liste-pdv' and cree_par = (select auth.uid()))
  with check ((select public.agence_courante()) is not null and type = 'liste-pdv' and cree_par = (select auth.uid()));

commit;
