// composables/useActionsCommerciales.ts
// Actions décidées par le commercial (lot 3.5). Types depuis le référentiel
// `type_action_commerciale`, repli hors ligne sur TYPES_ACTION_DEFAUT.
import type { ActionCommerciale, ActionCommercialeStatut, TypeActionCommerciale } from '~/types'
import { STATUTS_OUVERTS, TYPES_ACTION_DEFAUT, typesActifs } from '~/utils/actionsCommerciales'

const SELECT = 'id, pdv_id, visite_id, auteur_id, type_code, assigne_a, echeance, statut, commentaire, created_at, updated_at, '
  + 'pdv:pdv_id(nom_pdv, zone, quartier), auteur:auteur_id(nom, email), assigne:assigne_a(nom, email, telephone), type:type_code(libelle)'

export interface NouvelleAction {
  pdv_id: string
  visite_id?: string | null
  type_code: string
  assigne_a?: string | null
  echeance?: string | null
  commentaire?: string | null
}

export function useActionsCommerciales() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const types = useState<TypeActionCommerciale[]>('types-action-commerciale', () => [...TYPES_ACTION_DEFAUT])
  const typesCharges = useState('types-action-commerciale-charges', () => false)

  async function chargerTypes(force = false) {
    if (typesCharges.value && !force) return
    const { data, error } = await supabase
      .from('type_action_commerciale')
      .select('code, libelle, ordre, actif')
    if (!error && data?.length) {
      types.value = data as TypeActionCommerciale[]
      typesCharges.value = true
    }
  }

  const typesActifsListe = computed(() => typesActifs(types.value))

  function libelleType(code: string): string {
    return types.value.find(t => t.code === code)?.libelle || code
  }

  async function listerPourPdv(pdvId: string): Promise<ActionCommerciale[]> {
    const { data, error } = await supabase
      .from('action_commerciale')
      .select(SELECT)
      .eq('pdv_id', pdvId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as unknown as ActionCommerciale[]
  }

  async function listerPourVisite(visiteId: string): Promise<ActionCommerciale[]> {
    const { data, error } = await supabase
      .from('action_commerciale')
      .select(SELECT)
      .eq('visite_id', visiteId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as unknown as ActionCommerciale[]
  }

  /**
   * Actions à connaître quand on ouvre une visite : celles décidées DEPUIS
   * cette visite, plus celles encore ouvertes sur le même PDV.
   *
   * Une action créée depuis la fiche PDV n'a pas de `visite_id`
   * (useActionsCommerciales.creer insère `visite_id: null`) : filtrer sur ce
   * seul champ la rendait invisible dans toutes les visites, avant comme après.
   * Le lecteur d'une visite veut pourtant savoir ce qui reste à faire sur ce PDV.
   */
  async function listerPourVisiteEtPdv(visiteId: string, pdvId: string): Promise<ActionCommerciale[]> {
    const { data, error } = await supabase
      .from('action_commerciale')
      .select(SELECT)
      .eq('pdv_id', pdvId)
      .or(`visite_id.eq.${visiteId},and(visite_id.is.null,statut.in.(${STATUTS_OUVERTS.join(',')}))`)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as unknown as ActionCommerciale[]
  }

  // Tout ce que la RLS laisse voir : auteur, assigné, ou PDV du périmètre.
  async function listerMesActions(limite = 200): Promise<ActionCommerciale[]> {
    const { data, error } = await supabase
      .from('action_commerciale')
      .select(SELECT)
      .order('statut')
      .order('echeance', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limite)
    if (error) throw error
    return (data || []) as unknown as ActionCommerciale[]
  }

  async function creer(payload: NouvelleAction): Promise<ActionCommerciale> {
    if (!user.value?.id) throw new Error('Session expirée, reconnectez-vous')
    const { data, error } = await (supabase.from('action_commerciale') as any)
      .insert({
        pdv_id: payload.pdv_id,
        visite_id: payload.visite_id || null,
        auteur_id: user.value.id,
        type_code: payload.type_code,
        assigne_a: payload.assigne_a || null,
        echeance: payload.echeance || null,
        commentaire: payload.commentaire?.trim() || null,
      })
      .select(SELECT)
      .single()
    if (error) throw error
    return data as ActionCommerciale
  }

  // Nombre d'actions ouvertes qui me sont assignées. `head: true` : PostgREST
  // renvoie le compte dans l'en-tête, aucune ligne ne descend — le badge coûte
  // une requête vide, ce qui compte sur un forfait data de terrain.
  const actionsOuvertes = useState('actions-ouvertes-compte', () => 0)

  async function compterActionsOuvertes(): Promise<number> {
    if (!user.value?.id) return 0
    const { count, error } = await supabase
      .from('action_commerciale')
      .select('*', { count: 'exact', head: true })
      .eq('assigne_a', user.value.id)
      .in('statut', STATUTS_OUVERTS as unknown as string[])
    if (error) {
      // Hors ligne ou RLS : garder la dernière valeur connue plutôt que
      // d'afficher 0, qui se lirait « rien à faire ».
      console.warn('Compteur d’actions indisponible', error.message)
      return actionsOuvertes.value
    }
    actionsOuvertes.value = count ?? 0
    return actionsOuvertes.value
  }

  async function changerStatut(id: string, statut: ActionCommercialeStatut): Promise<void> {
    const { error } = await (supabase.from('action_commerciale') as any)
      .update({ statut })
      .eq('id', id)
    if (error) throw error
  }

  // Merchandiseurs actifs du périmètre du commercial (profiles est lisible par
  // tous ; on filtre sur les territoires pour proposer les bons noms).
  async function merchandiseursPour(zones: string[]): Promise<{ id: string; nom: string; email: string; zone_assignee: string | null }[]> {
    let q = supabase
      .from('profiles')
      .select('id, nom, email, zone_assignee, territoires_assignes')
      .eq('role', 'merchandiser')
      .eq('is_active', true)
      .order('nom')
    const { data, error } = await q
    if (error) throw error
    const rows = (data || []) as any[]
    if (!zones.length) return rows
    const zs = new Set(zones)
    const dansZone = rows.filter(r =>
      (r.zone_assignee && zs.has(r.zone_assignee))
      || (Array.isArray(r.territoires_assignes) && r.territoires_assignes.some((t: string) => zs.has(t))),
    )
    return dansZone.length ? dansZone : rows
  }

  return {
    types,
    typesActifs: typesActifsListe,
    chargerTypes,
    libelleType,
    listerPourPdv,
    listerPourVisite,
    listerPourVisiteEtPdv,
    listerMesActions,
    actionsOuvertes,
    compterActionsOuvertes,
    creer,
    changerStatut,
    merchandiseursPour,
  }
}
