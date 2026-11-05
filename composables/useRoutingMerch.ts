// composables/useRoutingMerch.ts
// Routing mensuel du compte connecté (lignes actives de routing_mensuel) :
// distributeur, commune et point de visite de chaque jour. Le formulaire de
// création de PDV s'en sert pour imposer le distributeur du routing et, quand
// le profil n'a plus de quartiers (synchronisation « vos PDV » des comptes
// Atom), pour proposer ses points de visite comme quartiers.
//
// Gardé dans useState comme les référentiels (useReferentiels) : rechargé à
// l'ouverture du formulaire si on est en ligne ; hors ligne, on garde ce qui a
// déjà été chargé. `lignes` vaut null tant que rien n'est chargé pour ce compte
// (≠ [] : chargé, mais aucun routing).
import type { LigneRoutingMerch } from '~/utils/distributeurCreation'

export function useRoutingMerch() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const lignes = useState<LigneRoutingMerch[] | null>('routing-merch-lignes', () => null)
  // Compte pour lequel `lignes` a été chargé : un changement de compte sur la
  // même tablette ne doit pas montrer le distributeur du précédent.
  const chargePour = useState<string | null>('routing-merch-uid', () => null)
  const error = useState<string | null>('routing-merch-error', () => null)

  async function fetchRoutingMerch(force = false) {
    const uid = user.value?.id || null
    if (chargePour.value !== uid) {
      lignes.value = null
      chargePour.value = null
    }
    if (!uid) return
    if (lignes.value !== null && !force) return
    error.value = null
    const { data, error: err } = await supabase
      .from('routing_mensuel')
      .select('distributeur, commune, point_visite, zone, latitude, longitude')
      .eq('merchandiser_id', uid)
      .eq('actif', true)
      .then(r => r, (e: any) => ({ data: null, error: { message: e?.message || String(e) } }))
    if (err) {
      // On garde les lignes déjà chargées (réseau coupé en cours de route).
      error.value = err.message
      console.warn('[routing] chargement du routing mensuel impossible', err.message)
      return
    }
    // Le compte a pu changer pendant la requête.
    if ((user.value?.id || null) !== uid) return
    lignes.value = (data || []) as LigneRoutingMerch[]
    chargePour.value = uid
  }

  // null tant que le routing de ce compte n'est pas chargé.
  const routing = computed<LigneRoutingMerch[] | null>(() =>
    chargePour.value && chargePour.value === (user.value?.id || null) ? lignes.value : null,
  )

  return { routing, error, fetchRoutingMerch }
}
