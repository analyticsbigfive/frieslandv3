// composables/useTypePdvLabels.ts
// Libellés français des types de PDV (type_pdv.nom_fr / categorie_pdv.nom_fr,
// seedés par la migration 20260717130000 depuis docs/ajour/types-de-pdv.csv).
// Les valeurs stockées dans pdvs (categorie_pdv / sous_categorie_pdv) restent
// les noms EN du référentiel : ce composable ne sert qu'à l'affichage.
// select('*') tolère l'absence de nom_fr tant que la migration n'est pas
// appliquée — fallback sur le nom EN dans ce cas.
export function useTypePdvLabels() {
  const supabase = useSupabaseClient()
  const typeLabels = useState<Record<string, string>>('type-pdv-labels', () => ({}))
  const categorieLabels = useState<Record<string, string>>('categorie-pdv-labels', () => ({}))
  const loaded = useState<boolean>('type-pdv-labels-loaded', () => false)

  async function fetchTypePdvLabels(force = false) {
    if (loaded.value && !force) return
    const { data, error } = await supabase.from('type_pdv').select('*, categorie_pdv(*)')
    if (error) {
      console.warn('useTypePdvLabels: référentiel indisponible', error.message)
      return
    }
    const one = (x: any) => (Array.isArray(x) ? x[0] : x)
    const types: Record<string, string> = {}
    const categories: Record<string, string> = {}
    for (const r of (data as any[]) || []) {
      if (r.nom) types[r.nom] = r.nom_fr || r.nom
      const cp = one(r.categorie_pdv)
      if (cp?.nom) categories[cp.nom] = cp.nom_fr || cp.nom
    }
    typeLabels.value = types
    categorieLabels.value = categories
    loaded.value = true
  }

  const typePdvLabel = (nom?: string | null) => (nom ? typeLabels.value[nom] || nom : '')
  const categoriePdvLabel = (nom?: string | null) => (nom ? categorieLabels.value[nom] || nom : '')

  return { fetchTypePdvLabels, typePdvLabel, categoriePdvLabel, typeLabels, categorieLabels }
}
