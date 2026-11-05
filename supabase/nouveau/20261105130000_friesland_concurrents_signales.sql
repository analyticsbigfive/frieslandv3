-- Concurrence › Concurrents signalés (05/11/2026) : ajouter à la liste
-- officielle (marque_concurrente) un concurrent saisi en texte libre par les
-- merchandisers. Demandé en réunion avec Friesland.
--
-- 1. concurrents_signales_bruts() : un signalement par ligne, sur toutes les
--    visites (pas seulement la période du dashboard), dans les deux formats du
--    relevé :
--      - data.concurrence.autres[].nom (formulaire actuel) ;
--      - data.concurrence.<famille>.nom_concurrent quand <famille>.autre =
--        'Présent' (ancien format, encore écrit par le formulaire).
--    Le regroupement (« Milko », « milko », « MILKO ») se fait dans l'admin
--    avec normaliserNomConcurrent (utils/concurrence.ts), la même règle que le
--    tableau de bord. Au 05/11 : 739 signalements, 98 noms, Milko 442.
--
-- 2. marque_concurrente : l'écriture était ouverte à tout compte connecté
--    (policy « for all … using (true) »), merchandisers compris. Elle est
--    réservée aux gestionnaires Perfect Store (admin, superviseur), comme
--    marque_concurrente_sku.

create or replace function public.concurrents_signales_bruts()
returns table (
  visite_id uuid,
  pdv_id text,
  date_visite timestamptz,
  famille text,
  nom text,
  en_activite boolean
)
language sql
stable
set search_path to 'public'
as $$
  select v.id, v.pdv_id, v.date_visite, e.key, trim(e.value->>'nom_concurrent'),
         case when jsonb_typeof(e.value->'en_activite') = 'boolean' then (e.value->>'en_activite')::boolean end
  from visites v,
       jsonb_each(case when jsonb_typeof(v.data->'concurrence') = 'object' then v.data->'concurrence' else '{}'::jsonb end) e
  where e.key in ('evap', 'imp', 'scm', 'uht')
    and jsonb_typeof(e.value) = 'object'
    and e.value->>'autre' = 'Présent'
    and coalesce(trim(e.value->>'nom_concurrent'), '') <> ''
  union all
  select v.id, v.pdv_id, v.date_visite, nullif(a->>'categorie', ''), trim(a->>'nom'),
         case when jsonb_typeof(a->'en_activite') = 'boolean' then (a->>'en_activite')::boolean end
  from visites v,
       jsonb_array_elements(case when jsonb_typeof(v.data->'concurrence'->'autres') = 'array' then v.data->'concurrence'->'autres' else '[]'::jsonb end) a
  where jsonb_typeof(a) = 'object'
    and coalesce(trim(a->>'nom'), '') <> ''
  order by 3 desc, 1, 5;
$$;

comment on function public.concurrents_signales_bruts() is
  'Concurrents saisis en texte libre dans les visites (autres[] et <famille>.nom_concurrent), un signalement par ligne. Regroupés dans Concurrence › Concurrents signalés.';

grant execute on function public.concurrents_signales_bruts() to authenticated;

drop policy if exists marque_concurrente_write on public.marque_concurrente;
create policy marque_concurrente_write on public.marque_concurrente
  for all to authenticated
  using (public.est_gestionnaire_perfect_store())
  with check (public.est_gestionnaire_perfect_store());
