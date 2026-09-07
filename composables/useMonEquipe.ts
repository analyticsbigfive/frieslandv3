// composables/useMonEquipe.ts
// Merchandiseurs explicitement rattachés au commercial connecté
// (profiles.commercial_id). Lien organisationnel : il ne remplace pas le
// périmètre territorial, il permet de dire « mon équipe » plutôt que « tous
// les merchandiseurs de mes territoires ».
import type { Profile } from '~/types'

export function useMonEquipe() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const membres = useState<Profile[]>('mon-equipe', () => [])
  const charge = useState('mon-equipe-chargee', () => false)

  async function charger(force = false) {
    if (charge.value && !force) return membres.value
    if (!user.value?.id) return []
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nom, email, role, telephone, zone_assignee, territoires_assignes, is_active')
      .eq('commercial_id', user.value.id)
      .eq('is_active', true)
      .order('nom')
    if (!error) {
      membres.value = (data || []) as unknown as Profile[]
      charge.value = true
    }
    return membres.value
  }

  const idsEquipe = computed(() => new Set(membres.value.map(m => m.id)));
  const aUneEquipe = computed(() => membres.value.length > 0)

  function estDeMonEquipe(userId?: string | null) {
    return !!userId && idsEquipe.value.has(userId)
  }

  return { membres, idsEquipe, aUneEquipe, estDeMonEquipe, charger }
}
