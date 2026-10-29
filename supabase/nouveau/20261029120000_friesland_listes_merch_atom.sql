-- ============================================================================
-- LISTES DES MERCHANDISERS ATOM EN UNE TABLE (29/10/2026)
--
-- Page « Découpage » (/admin/decoupage) : il lui faut la liste de chaque
-- merchandiser Atom, soit pdv_ids_merch_atom(id). Cette fonction renvoie un
-- SETOF text que PostgREST ne sait pas trier : impossible de la lire par pages
-- de 1 000 de façon fiable, alors que deux listes dépassent 1 000 boutiques.
-- listes_merch_atom() renvoie (merchandiser_id, pdv_id) pour tous les
-- merchandisers Atom actifs (hors comptes de test), même filtre que
-- synchroniser_zones_atom ; triable par les deux colonnes. Aucune règle
-- nouvelle : elle appelle pdv_ids_merch_atom.
-- Réservée au service_role, comme pdv_ids_merch_atom. Idempotente.
-- ============================================================================
begin;

create or replace function public.listes_merch_atom()
returns table (merchandiser_id uuid, pdv_id text)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, x.pdv_id
  from profiles m
  cross join lateral pdv_ids_merch_atom(m.id) as x(pdv_id)
  where m.role = 'merchandiser' and m.employeur = 'atom' and coalesce(m.is_active, true)
    and coalesce(m.email, '') not like '%@friesland-test.ci'
$$;

comment on function public.listes_merch_atom() is
  'Liste de chaque merchandiser Atom actif (pdv_ids_merch_atom), une ligne par (merchandiser, boutique). Page Découpage.';

revoke all on function public.listes_merch_atom() from public, anon, authenticated;
grant execute on function public.listes_merch_atom() to service_role;

commit;
