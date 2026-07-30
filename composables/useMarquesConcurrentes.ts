// composables/useMarquesConcurrentes.ts
// Marques concurrentes pilotées par le référentiel `marque_concurrente`
// (réunion 23/07, tâche 5) — plus de listes codées en dur dans les pages.
//
// Le formulaire mobile est offline-first : si la table est injoignable ou
// vide, on retombe sur MARQUES_CONCURRENTES_DEFAUT (les marques historiques),
// jamais sur une liste vide. L'état est partagé via useState pour que le
// dashboard et le formulaire lisent la même liste sans refetch.

import {
  MARQUES_CONCURRENTES_DEFAUT,
  grouperMarquesParFamille,
  type MarqueConcurrente,
} from '~/utils/concurrence'

/** Les 4 familles du relevé. Fixes : elles structurent le JSONB des visites. */
export const FAMILLES_CONCURRENCE = [
  { key: 'evap', label: 'Concurrent EVAP' },
  { key: 'imp', label: 'Concurrent IMP' },
  { key: 'scm', label: 'Concurrent SCM' },
  { key: 'uht', label: 'Concurrent UHT' },
] as const

export function useMarquesConcurrentes() {
  const supabase = useSupabaseClient()
  const marques = useState<MarqueConcurrente[]>('marques-concurrentes', () => [...MARQUES_CONCURRENTES_DEFAUT])
  const chargees = useState('marques-concurrentes-chargees', () => false)

  async function charger() {
    if (chargees.value) return
    const { data, error } = await supabase
      .from('marque_concurrente')
      .select('famille, code, nom, ordre')
      .eq('actif', true)
    if (!error && data?.length) {
      marques.value = data as MarqueConcurrente[]
      chargees.value = true
    }
  }

  const parFamille = computed(() => grouperMarquesParFamille(marques.value))

  /**
   * Même forme que l'ancienne constante `categories` du dashboard concurrence :
   * [{ key, label, competitors: [{ key, label }] }], « Autre » inclus en fin de
   * liste (la saisie libre reste un canal de collecte à part entière).
   */
  const categories = computed(() =>
    FAMILLES_CONCURRENCE.map(f => ({
      key: f.key,
      label: f.label,
      competitors: [
        ...(parFamille.value[f.key] || []).map(m => ({ key: m.code, label: m.nom })),
        { key: 'autre', label: 'Autre' },
      ],
    })),
  )

  return { marques, parFamille, categories, charger }
}
