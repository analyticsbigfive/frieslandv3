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
  SKUS_CONCURRENTS_DEFAUT,
  grouperMarquesParFamille,
  grouperSkusParMarque,
  marquesPourVisibilite,
  type MarqueConcurrente,
  type SkuConcurrent,
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
  const skus = useState<SkuConcurrent[]>('skus-concurrents', () => [...SKUS_CONCURRENTS_DEFAUT])
  const chargees = useState('marques-concurrentes-chargees', () => false)

  async function charger(force = false) {
    if (chargees.value && !force) return
    const { data, error } = await supabase
      .from('marque_concurrente')
      .select('id, famille, code, nom, ordre')
      .eq('actif', true)
    if (error || !data?.length) return
    marques.value = data as MarqueConcurrente[]
    chargees.value = true

    // SKU (lot 6) : la jointure remonte famille + code de la marque parente,
    // clés de regroupement côté formulaire. Table absente → repli conservé.
    const { data: rows, error: errSku } = await supabase
      .from('marque_concurrente_sku')
      .select('marque_id, code, libelle, grammage_g, format, image_url, ordre, marque_concurrente(famille, code)')
      .eq('actif', true)
    if (errSku) return
    skus.value = (rows || []).map((r: any) => {
      const parent = Array.isArray(r.marque_concurrente) ? r.marque_concurrente[0] : r.marque_concurrente
      return {
        marque_id: r.marque_id,
        famille: parent?.famille,
        marque_code: parent?.code,
        code: r.code,
        libelle: r.libelle,
        grammage_g: r.grammage_g,
        format: r.format,
        image_url: r.image_url,
        ordre: r.ordre,
      } as SkuConcurrent
    }).filter(s => s.famille && s.marque_code)
  }

  const parFamille = computed(() => grouperMarquesParFamille(marques.value))
  /** SKU par « famille:marque_code ». */
  const skusParMarque = computed(() => grouperSkusParMarque(skus.value))
  /** Marques distinctes (toutes familles) pour l'étape visibilité concurrence. */
  const marquesVisibilite = computed(() => marquesPourVisibilite(marques.value))

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

  return { marques, skus, parFamille, skusParMarque, marquesVisibilite, categories, charger }
}
