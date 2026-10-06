// composables/useSsfTerrain.ts
// SSF pour le terrain Atom : planning de la semaine du merchandiser (RPC
// ssf_semaine), liste des SSF et quartiers de leurs sous-zones. Gardés hors
// ligne (IndexedDB) : le SSF du jour doit s'afficher sans réseau, sur le
// terrain. Effacés à la déconnexion (useOfflineData.clearOfflineData).
import { get, set } from 'idb-keyval'
import type { JourSsf, QuartierSsf, SsfTerrain } from '~/utils/ssfTerrain'

export const CLE_CACHE_SSF = 'offline:ssf'
export const CLE_CACHE_SSF_SEMAINE = 'offline:ssf-semaine'

export function useSsfTerrain() {
  const supabase = useSupabaseClient() as any
  const semaine = useState<JourSsf[]>('ssf-semaine', () => [])
  const listeSsf = useState<SsfTerrain[]>('ssf-liste', () => [])
  const quartiers = useState<QuartierSsf[]>('ssf-quartiers', () => [])
  const chargee = useState('ssf-semaine-chargee', () => false)

  /** Planning de la semaine du merchandiser : réseau, sinon cache. */
  async function chargerSemaine(userId: string | null | undefined) {
    if (!userId) return
    try {
      const { data, error } = await supabase.rpc('ssf_semaine', { p_user_id: userId })
      if (error) throw error
      semaine.value = (data || []) as JourSsf[]
      chargee.value = true
      await set(CLE_CACHE_SSF_SEMAINE, { userId, lignes: JSON.parse(JSON.stringify(semaine.value)) }).catch(() => {})
    }
    catch {
      // Hors ligne, ou migration 20261007100000 pas encore appliquée.
      const cache = await get<{ userId: string, lignes: JourSsf[] }>(CLE_CACHE_SSF_SEMAINE).catch(() => undefined)
      if (cache?.userId === userId) { semaine.value = cache.lignes; chargee.value = true }
    }
  }

  /** SSF actifs et quartiers de leurs sous-zones : réseau, sinon cache. */
  async function chargerListe() {
    try {
      const [s, q] = await Promise.all([
        supabase.from('ssf').select('id, nom, telephone, actif, distributeur:distributeur_id(nom)').eq('actif', true).order('nom'),
        supabase.from('ssf_quartier').select('ssf_id, zone, quartier'),
      ])
      if (s.error) throw s.error
      listeSsf.value = (s.data || []).map((r: any) => ({ id: r.id, nom: r.nom, telephone: r.telephone ?? null, distributeur: r.distributeur?.nom ?? null }))
      quartiers.value = q.error ? [] : (q.data || []) as QuartierSsf[]
      await set(CLE_CACHE_SSF, JSON.parse(JSON.stringify({ ssf: listeSsf.value, quartiers: quartiers.value }))).catch(() => {})
    }
    catch {
      const cache = await get<{ ssf: SsfTerrain[], quartiers: QuartierSsf[] }>(CLE_CACHE_SSF).catch(() => undefined)
      if (cache) { listeSsf.value = cache.ssf || []; quartiers.value = cache.quartiers || [] }
    }
  }

  return { semaine, listeSsf, quartiers, chargee, chargerSemaine, chargerListe }
}
