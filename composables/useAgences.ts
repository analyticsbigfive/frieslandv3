// composables/useAgences.ts
// Agences de merchandising (table agence, Référentiels › Agences). Chargées une
// fois par session ; avant la migration 20261008100000, liste par défaut.
import { AGENCES_DEFAUT, nomAgence, type Agence } from '~/utils/agences'

export function useAgences() {
  const supabase = useSupabaseClient() as any
  const agences = useState<Agence[]>('agences', () => [...AGENCES_DEFAUT])
  const chargees = useState('agences-chargees', () => false)

  async function charger(forcer = false) {
    if (chargees.value && !forcer) return agences.value
    const { data, error } = await supabase.from('agence').select('code, nom, direction, programme, actif, ordre').order('ordre')
    if (!error && data?.length) {
      agences.value = data as Agence[]
      chargees.value = true
    }
    return agences.value
  }

  const actives = computed(() => agences.value.filter(a => a.actif))
  const options = computed(() => actives.value.map(a => ({ label: a.nom, value: a.code })))
  const programmes = computed(() => actives.value.filter(a => a.programme))

  return {
    agences, actives, options, programmes, charger,
    nom: (code: string | null | undefined) => nomAgence(code, agences.value),
  }
}
