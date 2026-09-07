-- ============================================================================
-- RECALCUL PERFECT STORE PAR LOT
--
-- `recalculer_tous_perfect_store()` (20260630130200:130) boucle
-- `calculer_perfect_store(id)` sur TOUTES les visites — 26 261 aujourd'hui,
-- chacune parcourant plusieurs blocs jsonb et la table des niveaux. Or
-- `authenticated` est plafonné à 30 s (`alter role ... statement_timeout`,
-- 20260831200000:33) : au-delà de quelques milliers de visites, le bouton
-- « Recalculer » de /admin/perfect-store/standards ne peut plus aboutir.
--
-- Le contournement évident — lancer le recalcul depuis un script avec la clé de
-- service — ne marche pas non plus : `est_gestionnaire_perfect_store()` lit
-- `profiles where id = auth.uid()`, et `auth.uid()` est NULL en service_role.
-- La fonction lèverait 42501.
--
-- D'où cette variante par lot, appelée en boucle par l'écran d'administration,
-- avec la session d'un admin. Même contrôle de permission, même base de calcul,
-- parcours stable par `id` pour qu'aucune visite ne soit sautée ni traitée deux
-- fois entre deux appels.
--
-- Idempotent. Additif : `recalculer_tous_perfect_store` reste en place.
-- ============================================================================
begin;

create or replace function public.recalculer_perfect_store_lot(
  p_limit integer default 500,
  p_offset integer default 0,
  p_base_calcul text default 'taux_vente'
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  if p_base_calcul not in ('taux_vente','taux_revu') then
    raise exception 'Base de calcul invalide : %', p_base_calcul;
  end if;

  if not public.est_gestionnaire_perfect_store() then
    raise exception 'Permission refusée : rôle admin ou superviseur requis'
      using errcode = '42501';
  end if;

  -- `order by id` : un ordre total et stable. Sans lui, deux appels successifs
  -- pourraient rendre les mêmes lignes et en oublier d'autres.
  with lot as (
    select v.id from public.visites v
    order by v.id
    limit greatest(coalesce(p_limit, 500), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select count(*) into v_count from lot;

  perform public.calculer_perfect_store(id, p_base_calcul)
  from (
    select v.id from public.visites v
    order by v.id
    limit greatest(coalesce(p_limit, 500), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  ) s;

  -- Nombre de visites RÉELLEMENT traitées : l'appelant s'arrête quand il
  -- reçoit moins que `p_limit`.
  return v_count;
end;
$$;

comment on function public.recalculer_perfect_store_lot(integer, integer, text) is
  'Recalcule un lot de visites. À appeler en boucle depuis l''administration (offset croissant) : le recalcul complet dépasse le statement_timeout de 30 s.';

revoke all on function public.recalculer_perfect_store_lot(integer, integer, text) from public;
grant execute on function public.recalculer_perfect_store_lot(integer, integer, text) to authenticated;

-- Compteur, pour afficher une progression honnête plutôt qu'une barre qui
-- avance sans savoir où elle va.
create or replace function public.compter_visites_a_recalculer()
returns bigint
language sql stable
set search_path = public
as $$
  select count(*) from public.visites;
$$;

grant execute on function public.compter_visites_a_recalculer() to authenticated;

commit;
