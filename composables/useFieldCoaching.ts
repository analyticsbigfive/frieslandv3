// composables/useFieldCoaching.ts
// Field coaching (lot 4) : référentiels (engins, distributeurs, SKU), CRUD,
// transfert. Repli hors ligne sur ENGINS_DEFAUT.
import type { FieldCoaching } from '~/types'
import { ENGINS_DEFAUT } from '~/utils/fieldCoaching'

const SELECT = 'id, date_coaching, auteur_id, superviseur_id, assigne_a, distributeur_nom, vendeur_nom, engin_code, pdv_id, route_jour, type_pdv, type_pdv_detail, '
  + 'commune, quartier, rue, proche_de, proprietaire_nom, proprietaire_prenom, proprietaire_tel, nb_sku_pdv, nb_sku_dispo, '
  + 'skus_disponibles, reponses, commentaire, motif_non_participation, image_urls, statut, created_at, updated_at, '
  + 'pdv:pdv_id(nom_pdv, zone, quartier), auteur:auteur_id(nom, email), assigne:assigne_a(nom, email), superviseur:superviseur_id(nom, email)'

export function useFieldCoaching() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const engins = useState('engins-vente', () => [...ENGINS_DEFAUT])
  const distributeurs = useState<{ id: number; nom: string }[]>('distributeurs-coaching', () => [])
  const references = useState<{ id: number; nom: string; role: string }[]>('references-coaching', () => [])

  async function chargerReferentiels() {
    const [e, d, r] = await Promise.all([
      supabase.from('engin_vente').select('code, libelle, ordre, actif').eq('actif', true).order('ordre'),
      supabase.from('distributeur').select('id, nom').order('nom'),
      supabase.from('reference_produit').select('id, nom, role').order('id'),
    ])
    if (!e.error && e.data?.length) engins.value = e.data as any
    if (!d.error) distributeurs.value = (d.data || []) as any
    if (!r.error) references.value = (r.data || []) as any
  }

  async function lister(limite = 200): Promise<FieldCoaching[]> {
    const { data, error } = await supabase
      .from('field_coaching')
      .select(SELECT)
      .order('date_coaching', { ascending: false })
      .limit(limite)
    if (error) throw error
    return (data || []) as unknown as FieldCoaching[]
  }

  async function charger(id: string): Promise<FieldCoaching | null> {
    const { data, error } = await supabase.from('field_coaching').select(SELECT).eq('id', id).maybeSingle()
    if (error) throw error
    return (data as unknown as FieldCoaching) || null
  }

  async function transferts(coachingId: string) {
    const { data } = await supabase
      .from('field_coaching_transfert')
      .select('id, created_at, motif, de:de_user(nom), vers:vers_user(nom), par:par_user(nom)')
      .eq('coaching_id', coachingId)
      .order('created_at', { ascending: false })
    return (data || []) as any[]
  }

  async function transferer(coachingId: string, vers: string, motif?: string) {
    const { error } = await (supabase.rpc as any)('transferer_field_coaching', {
      p_coaching_id: coachingId, p_vers: vers, p_motif: motif || null,
    })
    if (error) throw error
  }

  // Comptes pouvant recevoir un coaching : superviseurs et commerciaux actifs.
  async function destinatairesTransfert() {
    const { data } = await supabase
      .from('profiles')
      .select('id, nom, email, role')
      .in('role', ['superviseur', 'commercial', 'admin'])
      .eq('is_active', true)
      .order('nom')
    return ((data || []) as any[]).filter(p => p.id !== user.value?.id)
  }

  return { engins, distributeurs, references, chargerReferentiels, lister, charger, transferts, transferer, destinatairesTransfert }
}
