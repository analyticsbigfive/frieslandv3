-- ============================================================================
-- JOURNAL DES IMPORTS TERRAIN (Admin › Import / Export › Imports terrain)
--
-- Les imports DMS → PDV, affectation des merchandisers DMS, visites Atom et
-- sous-zones SSF tournent désormais depuis l'admin : simulation dans le
-- navigateur, puis application par la route /api/admin/imports/<type>/appliquer
-- (clé service_role, opérations validées). Chaque lot garde son rapport, son
-- avancement et ses opérations inverses : le bouton « Annuler le lot » les
-- rejoue, à la place des blocs SQL « Retour arrière » des anciens rapports.
--
-- Idempotent. Réservé aux administrateurs.
-- ============================================================================
begin;

create table if not exists public.import_lot (
  id                uuid primary key default gen_random_uuid(),
  type              text not null check (type in ('dms-pdv', 'merch-dms', 'routing-atom', 'ssf-sous-zones')),
  fichier           text,
  statut            text not null default 'en_cours'
                    check (statut in ('en_cours', 'applique', 'erreur', 'annulation', 'annule')),
  resume            jsonb,
  rapport           text,
  operations_total  integer not null default 0,
  operations_faites integer not null default 0,
  -- Opérations inverses (retour arrière), produites avec la simulation.
  retour            jsonb,
  erreur            text,
  cree_par          uuid references public.profiles(id) on delete set null,
  cree_le           timestamptz not null default now(),
  applique_le       timestamptz,
  annule_le         timestamptz
);

comment on table public.import_lot is
  'Lots d''import terrain lancés depuis l''admin : type, fichier, rapport, avancement, opérations inverses (annulation).';

create index if not exists idx_import_lot_cree_le on public.import_lot(cree_le desc);

alter table public.import_lot enable row level security;

drop policy if exists import_lot_admin on public.import_lot;
create policy import_lot_admin on public.import_lot
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.is_active, true)))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.is_active, true)));

grant select, insert, update on public.import_lot to authenticated;

commit;
