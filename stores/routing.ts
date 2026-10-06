// stores/routing.ts
import { defineStore, skipHydrate } from 'pinia'
import { isPrivilegedProfile } from '~/utils/roles'
import { markRaw } from 'vue'
import { fetchAllRows } from '~/utils/fetchAll'
import { regrouperLignesTournees } from '~/utils/routingImport'
import { estErreurReseau } from '~/utils/supabaseErrors'
import type { Routing, RoutingPDV, RoutingObjectives, RoutingTemplate, RoutingTemplatePDV, RoutingTemplateException, Profile, RoutingTemplateMode } from '~/types'

export const useRoutingStore = defineStore('routing', () => {
  const supabase = skipHydrate(markRaw(useSupabaseClient()))
  const { addToQueue, isOnline } = useOfflineSync()

  const todayRouting = ref<Routing | null>(null)
  // Étapes de la tournée du jour DÉJÀ CHARGÉES, par pages de PAGE_ETAPES : une
  // tournée « portefeuille » compte jusqu'à ~1 000 PDV, trop pour un seul appel
  // (plafond PostgREST de 1 000 lignes, rendu lent sur téléphone).
  const routingPDVList = ref<RoutingPDV[]>([])
  const loading = ref(false)
  const chargementPage = ref(false)
  // Compteurs de TOUTE la tournée, lus en base : la liste n'en contient qu'une partie.
  const compteurs = ref({ total: 0, faits: 0, clos: 0, entames: 0 })
  // Incrémenté à chaque rechargement : une page encore en vol au moment d'un
  // « Actualiser » est ignorée au lieu de se mélanger à la nouvelle liste.
  let jetonTournee = 0

  // ---- Garde périmètre : refuse toute tournée contenant un PDV hors des territoires du user ----
  // Filet côté store, appliqué même quand l'UI est contournée (duplicate, template, generate, CSV).
  // Retourne la liste des pdv_id hors périmètre (vide si tout est valide).
  async function findOutOfScopePDV(userId: string, pdvIds: string[]): Promise<string[]> {
    const ids = [...new Set(pdvIds.filter(Boolean))]
    if (!ids.length) return []

    const { data: profile, error: profErr } = await (supabase
      .from('profiles') as any)
      .select('role, zone_assignee, territoires_assignes, quartiers_assignes')
      .eq('id', userId)
      .single()
    if (profErr) throw profErr

    // admin / superviseur : aucune restriction de périmètre.
    if (isPrivilegedProfile(profile)) return []

    const { data: pdvs, error: pdvErr } = await (supabase
      .from('pdv') as any)
      .select('pdv_id, zone, quartier')
      .in('pdv_id', ids)
    if (pdvErr) throw pdvErr

    return (pdvs || [])
      .filter((p: any) => !pdvInScope(p, profile as Profile))
      .map((p: any) => p.pdv_id)
  }

  async function assertScopedPDV(userId: string, pdvIds: string[]) {
    const bad = await findOutOfScopePDV(userId, pdvIds)
    if (bad.length) {
      throw new Error(`${bad.length} PDV hors du périmètre du merchandiser : ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? '…' : ''}`)
    }
  }

  // ---- Mobile: fetch today's routing for current user ----
  async function fetchTodayRouting(userId: string) {
    loading.value = true
    try {
      // toIsoJour et non toISOString() : ce dernier bascule en UTC et renverrait
      // la veille pour tout fuseau à l'est de Greenwich.
      const today = toIsoJour(new Date())

      // Rattrapage : si la pré-génération (J → J+7) n'a pas eu lieu — première
      // connexion, règle créée le matin même — on matérialise la tournée du jour
      // à la volée. La RPC est idempotente : si la tournée existe, elle est
      // renvoyée telle quelle, sans toucher à l'avancement terrain.
      // Hors ligne, l'appel échoue silencieusement et on lit le cache.
      try {
        await (supabase.rpc as any)('materialiser_routing_jour', { p_user_id: userId, p_date: today })

        // Pendant qu'on est en ligne, on pousse aussi l'horizon à J+7 : c'est ce
        // qui permet au merchandiser d'ouvrir l'app demain matin sans réseau et
        // d'y trouver quand même sa tournée. Sans attendre — la tournée du jour,
        // seule bloquante pour l'affichage, est déjà créée.
        const horizon = new Date()
        horizon.setDate(horizon.getDate() + 7)
        void (supabase.rpc as any)('materialiser_routings_periode', {
          p_user_id: userId,
          p_date_debut: today,
          p_date_fin: toIsoJour(horizon),
        })
      }
      catch (err) {
        console.warn('[Routing] matérialisation du jour impossible (hors ligne ?)', err)
      }

      // En-tête seul : les étapes arrivent par pages (chargerPageRouting).
      const { data, error } = await (supabase
        .from('routings') as any)
        .select('*, user:user_id(id, nom, email)')
        .eq('user_id', userId)
        .eq('date_routing', today)
        .neq('status', 'cancelled')
        .single()

      if (error && error.code !== 'PGRST116') throw error

      jetonTournee++
      routingPDVList.value = []
      chargementPage.value = false
      if (data) {
        todayRouting.value = data as Routing
        await compterEtapes()
        await chargerPageRouting()
        console.info(`[Routing] ${routingPDVList.value.length}/${compteurs.value.total} PDV chargés pour le ${today}`)
      } else {
        todayRouting.value = null
        compteurs.value = { total: 0, faits: 0, clos: 0, entames: 0 }
        console.warn(`[Routing] Aucun routing trouvé pour user=${userId} date=${today}`)
      }
    } catch (err) {
      console.error('Erreur chargement routing:', err)
    } finally {
      loading.value = false
    }
  }

  const PAGE_ETAPES = 50
  const SELECT_ETAPE = `*,
    pdv:pdv_id(pdv_id, nom_pdv, zone, quartier, geolocation_lat, geolocation_lng, rayon_geofence, canal, sous_categorie_pdv, adressage, image_url)`

  // clos = fait ou passé (tournée terminée quand tout est clos) ;
  // entamés = en cours ou fait (tournée « en cours » dès le premier).
  async function compterEtapes() {
    const routingId = todayRouting.value?.id
    if (!routingId) return
    const compter = (statuts?: string[]) => {
      let q = (supabase.from('routing_pdv') as any)
        .select('id', { count: 'exact', head: true })
        .eq('routing_id', routingId)
      if (statuts) q = q.in('status', statuts)
      return q
    }
    const [total, faits, clos, entames] = await Promise.all([
      compter(), compter(['completed']), compter(['completed', 'skipped']), compter(['in_progress', 'completed']),
    ])
    const erreur = [total, faits, clos, entames].find(r => r.error)?.error
    if (erreur) throw erreur
    compteurs.value = {
      total: total.count ?? 0,
      faits: faits.count ?? 0,
      clos: clos.count ?? 0,
      entames: entames.count ?? 0,
    }
  }

  const toutCharge = computed(() => routingPDVList.value.length >= compteurs.value.total)

  // ---- Mobile : calendrier des tournées (lecture seule) ----
  /**
   * Tournées du merchandiser entre deux dates (AAAA-MM-JJ, incluses), avec le
   * nombre d'étapes et d'étapes faites. Compteurs seuls, comme fetchRoutings :
   * les étapes d'un jour se lisent à l'ouverture (chargerEtapesRouting).
   * Les erreurs remontent : hors ligne, la page affiche son propre état.
   */
  async function fetchCalendrierTournees(userId: string, dateDebut: string, dateFin: string) {
    const { data, error } = await (supabase
      .from('routings') as any)
      .select('id, date_routing, status, total:routing_pdv(count), faits:routing_pdv(count)')
      .eq('faits.status', 'completed')
      .eq('user_id', userId)
      .gte('date_routing', dateDebut)
      .lte('date_routing', dateFin)
      .neq('status', 'cancelled')
      .order('date_routing')
    if (error) throw error
    return (data || []).map(({ total, faits, ...r }: any) => ({
      ...r,
      nb_pdv: total?.[0]?.count ?? 0,
      nb_faits: faits?.[0]?.count ?? 0,
    })) as Pick<Routing, 'id' | 'date_routing' | 'status' | 'nb_pdv' | 'nb_faits'>[]
  }

  /** Page suivante des étapes de la tournée du jour, dans l'ordre de passage. */
  async function chargerPageRouting() {
    const routingId = todayRouting.value?.id
    if (!routingId || chargementPage.value || toutCharge.value) return
    const jeton = jetonTournee
    chargementPage.value = true
    try {
      const debut = routingPDVList.value.length
      const { data, error } = await (supabase.from('routing_pdv') as any)
        .select(SELECT_ETAPE)
        .eq('routing_id', routingId)
        .order('position_order')
        .order('id')
        .range(debut, debut + PAGE_ETAPES - 1)
      if (jeton !== jetonTournee) return
      if (error) throw error
      const vus = new Set(routingPDVList.value.map(rp => rp.id))
      routingPDVList.value = [...routingPDVList.value, ...((data || []) as RoutingPDV[]).filter(rp => !vus.has(rp.id))]
      // Page vide alors que le compteur en annonce plus : la tournée a changé
      // entre-temps, on s'aligne sur ce qui est réellement chargé.
      if (!data?.length) compteurs.value.total = routingPDVList.value.length
    }
    catch (err) {
      console.error('Erreur chargement des étapes:', err)
    }
    finally {
      if (jeton === jetonTournee) chargementPage.value = false
    }
  }

  /** Étape par son id : dans la liste chargée, sinon lue en base. */
  async function getRoutingPDV(routingPdvId: string): Promise<RoutingPDV | null> {
    const locale = routingPDVList.value.find(rp => rp.id === routingPdvId)
    if (locale) return locale
    const { data, error } = await (supabase.from('routing_pdv') as any)
      .select(SELECT_ETAPE)
      .eq('id', routingPdvId)
      .maybeSingle()
    if (error) throw error
    return (data as RoutingPDV) || null
  }

  function ajusterCompteurs(avant: string | undefined, apres: string) {
    if (!avant || avant === apres) return
    const c = { ...compteurs.value }
    const dans = (s: string, liste: string[]) => (liste.includes(s) ? 1 : 0)
    c.faits += dans(apres, ['completed']) - dans(avant, ['completed'])
    c.clos += dans(apres, ['completed', 'skipped']) - dans(avant, ['completed', 'skipped'])
    c.entames += dans(apres, ['in_progress', 'completed']) - dans(avant, ['in_progress', 'completed'])
    compteurs.value = c
  }

  // ---- Mobile: update routing PDV status ----
  async function updateRoutingPDVStatus(
    routingPdvId: string,
    status: string,
    extras?: {
      geofence_validated?: boolean
      geolocation_lat?: number
      geolocation_lng?: number
      precision_gps?: number
      visite_id?: string
      result_notes?: string
    }
  ) {
    const now = new Date().toISOString()
    const update: any = { status, updated_at: now }

    if (status === 'in_progress') update.arrived_at = now
    if (status === 'completed') update.completed_at = now
    if (extras) Object.assign(update, extras)

    // Statut précédent, pour tenir les compteurs : l'étape peut ne pas être
    // dans les pages chargées (clôture depuis le formulaire de visite).
    const idx = routingPDVList.value.findIndex(rp => rp.id === routingPdvId)
    let avant = idx !== -1 ? routingPDVList.value[idx].status : undefined
    if (!avant && isOnline.value) {
      const { data } = await (supabase.from('routing_pdv') as any).select('status').eq('id', routingPdvId).maybeSingle()
      avant = (data as any)?.status
    }

    // Hors ligne (ou réseau coupé pendant l'envoi) : la mise à jour part dans
    // la file et sera rejouée à la reconnexion ; l'écran avance quand même.
    // Sans cela, une visite enregistrée hors ligne affichait « Erreur » et son
    // étape restait « en cours » (test du 06/10/2026).
    let enFile = !isOnline.value
    if (!enFile) {
      const { error } = await (supabase
        .from('routing_pdv') as any)
        .update(update)
        .eq('id', routingPdvId)

      if (error && estErreurReseau(error)) enFile = true
      else if (error) throw error
    }
    if (enFile) addToQueue({ type: 'routing_pdv', data: { id: routingPdvId, update } })

    // Update local state
    if (idx !== -1) {
      routingPDVList.value[idx] = { ...routingPDVList.value[idx], ...update }
    }
    ajusterCompteurs(avant, status)

    // Auto-update routing status (recalculé au prochain changement si hors ligne)
    if (!enFile) await syncRoutingStatus()
  }

  // ---- Auto-update routing status based on PDV progress ----
  // D'après les compteurs de toute la tournée, pas des seules pages chargées.
  async function syncRoutingStatus() {
    if (!todayRouting.value) return

    const { total, clos, entames } = compteurs.value
    const allCompleted = total > 0 && clos >= total
    const anyInProgress = entames > 0

    let newStatus = todayRouting.value.status
    if (allCompleted) newStatus = 'completed'
    else if (anyInProgress) newStatus = 'in_progress'

    if (newStatus !== todayRouting.value.status) {
      await (supabase
        .from('routings') as any)
        .update({ status: newStatus })
        .eq('id', todayRouting.value.id)

      todayRouting.value.status = newStatus as any
    }
  }

  // ---- Admin: fetch all routings (with filters) ----
  async function fetchRoutings(filters?: {
    dateFrom?: string
    dateTo?: string
    userId?: string
    status?: string
    /** Nombre maximal de tournées (200 par défaut ; planning d'équipe : une semaine de toute l'équipe). */
    limite?: number
  }) {
    loading.value = true
    try {
      // Compteurs seulement : avec des tournées « portefeuille » (~1 000 PDV
      // chacune), embarquer les étapes de 200 tournées ne tient plus. Le détail
      // se charge à l'ouverture (chargerEtapesRouting).
      let query = (supabase
        .from('routings') as any)
        .select(`
          *,
          user:user_id(id, nom, email, zone_assignee),
          creator:created_by(id, nom),
          total:routing_pdv(count),
          faits:routing_pdv(count)
        `)
        .eq('faits.status', 'completed')
        .order('date_routing', { ascending: false })

      if (filters?.dateFrom) query = query.gte('date_routing', filters.dateFrom)
      if (filters?.dateTo) query = query.lte('date_routing', filters.dateTo)
      if (filters?.userId) query = query.eq('user_id', filters.userId)
      if (filters?.status) query = query.eq('status', filters.status)

      const { data, error } = await query.limit(filters?.limite ?? 200)
      if (error) throw error
      return (data || []).map(({ total, faits, ...r }: any) => ({
        ...r,
        nb_pdv: total?.[0]?.count ?? 0,
        nb_faits: faits?.[0]?.count ?? 0,
      })) as Routing[]
    } catch (err) {
      console.error('Erreur chargement routings:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  const SELECT_ETAPE_ADMIN = `id, pdv_id, position_order, objectifs, status, geofence_validated, arrived_at, completed_at, visite_id,
    pdv:pdv_id(pdv_id, nom_pdv, zone, quartier, sous_categorie_pdv, geolocation_lat, geolocation_lng)`

  /**
   * Une page d'étapes d'une tournée, dans l'ordre de passage. Admin, et
   * calendrier des tournées mobile (lecture seule, la RLS limite le
   * merchandiser à ses propres tournées).
   */
  async function chargerEtapesRouting(routingId: string, debut = 0, taille = PAGE_ETAPES): Promise<RoutingPDV[]> {
    const { data, error } = await (supabase.from('routing_pdv') as any)
      .select(SELECT_ETAPE_ADMIN)
      .eq('routing_id', routingId)
      .order('position_order')
      .order('id')
      .range(debut, debut + taille - 1)
    if (error) throw error
    return (data || []) as RoutingPDV[]
  }

  /** Admin : toutes les étapes d'une tournée (édition, duplication). */
  async function toutesEtapesRouting(routingId: string): Promise<RoutingPDV[]> {
    return await fetchAllRows<RoutingPDV>((from, to) => (supabase.from('routing_pdv') as any)
      .select(SELECT_ETAPE_ADMIN)
      .eq('routing_id', routingId)
      .order('position_order')
      .order('id')
      .range(from, to))
  }

  // ---- Admin: create routing with PDV list ----
  async function createRouting(
    userId: string,
    dateRouting: string,
    pdvItems: { pdv_id: string; objectifs: RoutingObjectives }[],
    createdBy: string,
    notes?: string
  ) {
    // Garde périmètre : refuse tout PDV hors des territoires assignés au user.
    await assertScopedPDV(userId, pdvItems.map(i => i.pdv_id))

    // Create routing
    const { data: routing, error: routingError } = await (supabase
      .from('routings') as any)
      .insert({
        user_id: userId,
        date_routing: dateRouting,
        created_by: createdBy,
        notes: notes || null,
        status: 'pending',
      })
      .select()
      .single()

    if (routingError) throw routingError

    // Create routing PDV items
    const pdvRows = pdvItems.map((item, idx) => ({
      routing_id: (routing as any).id,
      pdv_id: item.pdv_id,
      position_order: idx + 1,
      objectifs: item.objectifs,
      status: 'pending',
    }))

    const { error: pdvError } = await (supabase
      .from('routing_pdv') as any)
      .insert(pdvRows)

    if (pdvError) throw pdvError

    return routing as Routing
  }

  // ---- Admin: delete routing ----
  async function deleteRouting(routingId: string) {
    const { error } = await (supabase
      .from('routings') as any)
      .delete()
      .eq('id', routingId)

    if (error) throw error
  }

  // ---- Admin: duplicate routing to another date ----
  async function duplicateRouting(routingId: string, newDate: string, newUserId?: string) {
    // Fetch original (étapes paginées : une tournée peut dépasser 1 000 PDV)
    const { data: original } = await (supabase
      .from('routings') as any)
      .select('*')
      .eq('id', routingId)
      .single()

    if (!original) throw new Error('Routing introuvable')

    const orig = original as any
    const targetUserId = newUserId || orig.user_id
    const etapes = await toutesEtapesRouting(routingId)

    return await createRouting(
      targetUserId,
      newDate,
      etapes
        .map((rp: any) => ({
          pdv_id: rp.pdv_id,
          objectifs: rp.objectifs || {},
        })),
      orig.created_by,
      orig.notes
    )
  }

  // ---- Admin: update routing (metadata + PDV list diff) ----
  // Preserves progress (status/geofence/visite_id) on PDV kept in the list.
  async function updateRouting(
    routingId: string,
    updates: { user_id?: string; date_routing?: string; notes?: string | null; status?: string },
    pdvItems?: { pdv_id: string; objectifs: RoutingObjectives }[],
    // supprimerAbsents = false : mode FUSION. Les PDV absents de `pdvItems`
    // sont conservés. Utilisé par l'import CSV en mode « mise à jour » : le
    // client corrige un routing d'un mois déjà importé sans que les PDV hors
    // fichier disparaissent. L'édition manuelle garde le mode remplacement,
    // sinon retirer un PDV de la modale n'aurait aucun effet.
    options: { supprimerAbsents?: boolean } = {}
  ) {
    const supprimerAbsents = options.supprimerAbsents !== false
    // Garde périmètre : si la liste PDV change, valide contre le user (nouveau ou courant).
    if (pdvItems) {
      let targetUser = updates.user_id
      if (!targetUser) {
        const { data: cur, error: curErr } = await (supabase
          .from('routings') as any)
          .select('user_id')
          .eq('id', routingId)
          .single()
        if (curErr) throw curErr
        targetUser = (cur as any)?.user_id
      }
      if (targetUser) await assertScopedPDV(targetUser, pdvItems.map(i => i.pdv_id))
    }

    // 1. Update routing metadata
    const metaUpdate: any = { ...updates, updated_at: new Date().toISOString() }
    const { error: metaError } = await (supabase
      .from('routings') as any)
      .update(metaUpdate)
      .eq('id', routingId)
    if (metaError) throw metaError

    // 2. Sync PDV list (only if provided)
    if (!pdvItems) return

    // Paginé : une tournée « portefeuille » dépasse le plafond de 1 000 lignes.
    const existing = await fetchAllRows<any>((from, to) => (supabase
      .from('routing_pdv') as any)
      .select('id, pdv_id, position_order')
      .eq('routing_id', routingId)
      .order('position_order').order('id')
      .range(from, to))

    const existingByPdv = new Map<string, any>((existing || []).map((r: any) => [r.pdv_id, r]))
    const desiredPdvIds = new Set(pdvItems.map(i => i.pdv_id))

    // Delete PDV removed from the list (mode remplacement uniquement)
    const toDelete = supprimerAbsents
      ? (existing || []).filter((r: any) => !desiredPdvIds.has(r.pdv_id))
      : []
    if (toDelete.length) {
      const { error } = await (supabase
        .from('routing_pdv') as any)
        .delete()
        .in('id', toDelete.map((r: any) => r.id))
      if (error) throw error
    }

    // Update kept PDV (objectifs + order, progress preserved) / insert new ones
    for (let idx = 0; idx < pdvItems.length; idx++) {
      const item = pdvItems[idx]
      const existingRow = existingByPdv.get(item.pdv_id)
      if (existingRow) {
        const { error } = await (supabase
          .from('routing_pdv') as any)
          .update({ position_order: idx + 1, objectifs: item.objectifs })
          .eq('id', existingRow.id)
        if (error) throw error
      } else {
        const { error } = await (supabase
          .from('routing_pdv') as any)
          .insert({
            routing_id: routingId,
            pdv_id: item.pdv_id,
            position_order: idx + 1,
            objectifs: item.objectifs,
            status: 'pending',
          })
        if (error) throw error
      }
    }

    // Fusion : les PDV conservés hors fichier passent après ceux du fichier,
    // dans leur ordre d'origine (sinon deux PDV partagent la même position et
    // l'ordre de visite s'entrelace).
    if (!supprimerAbsents) {
      const conserves = (existing || []).filter((r: any) => !desiredPdvIds.has(r.pdv_id))
      for (let i = 0; i < conserves.length; i += 20) {
        const lot = conserves.slice(i, i + 20)
        const res = await Promise.all(lot.map((r: any, j: number) => (supabase
          .from('routing_pdv') as any)
          .update({ position_order: pdvItems.length + i + j + 1 })
          .eq('id', r.id)))
        const err = res.find((x: any) => x.error)?.error
        if (err) throw err
      }
    }
  }

  // ---- Admin: bulk import routings from CSV (1 ligne = 1 PDV) ----
  // Upsert basé sur email + date (contrainte UNIQUE(user_id, date_routing)).
  //
  // mode 'fusion' (défaut) : les PDV déjà présents et absents du fichier sont
  // CONSERVÉS. C'est la demande du client — réimporter pour corriger un mois
  // déjà chargé ne doit rien effacer.
  // mode 'remplacement' : la tournée du jour devient exactement le contenu du
  // fichier. À choisir explicitement dans la modale d'import.
  async function importRoutingsFromCSV(
    rows: Record<string, string>[],
    createdBy: string,
    mode: 'fusion' | 'remplacement' = 'fusion'
  ) {
    const summary = { created: 0, updated: 0, pdvCount: 0, errors: [] as string[] }
    if (!rows.length) return summary

    // Résolution email -> profil (id + périmètre pour la garde territoire).
    // Paginé (plafond PostgREST de 1 000 lignes) ; comptes inactifs écartés.
    const profiles = await fetchAllRows<any>((from, to) => (supabase.from('profiles') as any)
      .select('id, email, role, is_active, zone_assignee, territoires_assignes, quartiers_assignes')
      .order('id')
      .range(from, to))
    const emailToProfile = new Map<string, any>(
      profiles
        .filter((p: any) => p.is_active !== false && p.email)
        .map((p: any) => [String(p.email).trim().toLowerCase(), p])
    )

    // PDV valides + leur zone/quartier (pour vérifier le périmètre). Paginé :
    // sans range(), PostgREST s'arrête à 1 000 lignes et tout PDV au-delà était
    // refusé comme « introuvable ».
    const pdvs = await fetchAllRows<any>((from, to) => (supabase.from('pdv') as any)
      .select('pdv_id, zone, quartier')
      .eq('is_active', true)
      .order('pdv_id')
      .range(from, to))
    const pdvById = new Map<string, any>(pdvs.map((p: any) => [p.pdv_id, p]))

    // Regroupement par email + date, PDV en double et dates invalides refusés.
    const { groupes, erreurs } = regrouperLignesTournees(rows)
    summary.errors.push(...erreurs)

    for (const g of groupes) {
      const profile = emailToProfile.get(g.email)
      if (!profile) {
        summary.errors.push(`${g.email} (${g.date}) : merchandiser introuvable ou compte désactivé`)
        continue
      }
      if (!['merchandiser', 'commercial'].includes(profile.role)) {
        summary.errors.push(`${g.email} (${g.date}) : compte « ${profile.role} », pas un merchandiser, tournée ignorée`)
        continue
      }
      const userId = profile.id

      const items = g.items
        .filter((it) => {
          if (!pdvById.has(it.pdv_id)) {
            summary.errors.push(`${g.email} (${g.date}) : point de vente « ${it.pdv_id} » introuvable ou inactif, ignoré`)
            return false
          }
          // Garde périmètre : PDV hors territoires assignés au user → rejeté avec message clair.
          if (!pdvInScope(pdvById.get(it.pdv_id), profile as Profile)) {
            summary.errors.push(`${g.email} (${g.date}) : point de vente « ${it.pdv_id} » hors des territoires de ce merchandiser, ignoré`)
            return false
          }
          return true
        })
        .map(it => ({ pdv_id: it.pdv_id, objectifs: it.objectifs }))

      if (!items.length) {
        summary.errors.push(`${g.email} (${g.date}) : aucun point de vente valide, tournée non créée`)
        continue
      }

      // Routing existant ? (UNIQUE user_id + date_routing)
      const { data: existing, error: exErr } = await (supabase.from('routings') as any)
        .select('id')
        .eq('user_id', userId)
        .eq('date_routing', g.date)
        .maybeSingle()
      if (exErr) {
        summary.errors.push(`${g.email} (${g.date}) : lecture de la tournée existante impossible (${exErr.message}), ignorée`)
        continue
      }

      try {
        if (existing?.id) {
          // Ce que le fichier ne dit pas reste tel quel : le modèle n'a pas de
          // colonne Statut, et une tournée en cours ne doit pas repasser « en
          // attente ». En remplacement, les notes suivent le fichier.
          const maj: { notes?: string | null; status?: string } = {}
          if (g.status) maj.status = g.status
          if (g.notes !== undefined) maj.notes = g.notes
          else if (mode === 'remplacement') maj.notes = null
          await updateRouting(existing.id, maj, items, { supprimerAbsents: mode === 'remplacement' })
          summary.updated++
        } else {
          const created = await createRouting(userId, g.date, items, createdBy, g.notes)
          if (g.status && g.status !== 'pending') {
            const { error: stErr } = await (supabase.from('routings') as any).update({ status: g.status }).eq('id', (created as any).id)
            if (stErr) summary.errors.push(`${g.email} (${g.date}) : tournée créée, mais statut non appliqué (${stErr.message})`)
          }
          summary.created++
        }
        summary.pdvCount += items.length
      } catch (err: any) {
        summary.errors.push(`${g.email} (${g.date}) : ${err.message}`)
      }
    }

    return summary
  }

  // ---- Computed helpers ----
  // Sur toute la tournée (compteurs en base), pas sur les pages chargées.
  const completedCount = computed(() => compteurs.value.faits)

  const totalCount = computed(() => compteurs.value.total)

  const progressPercent = computed(() =>
    totalCount.value > 0 ? Math.round((completedCount.value / totalCount.value) * 100) : 0
  )

  const nextPendingPDV = computed(() =>
    routingPDVList.value.find(rp => rp.status === 'pending')
  )

  const currentInProgressPDV = computed(() =>
    routingPDVList.value.find(rp => rp.status === 'in_progress')
  )

  // ================================================================
  // TEMPLATES PERMANENTS
  // ================================================================
  const templates = ref<RoutingTemplate[]>([])
  const templateLoading = ref(false)

  // ---- Fetch all templates (optionally filter by user) ----
  async function fetchTemplates(userId?: string) {
    templateLoading.value = true
    try {
      let query = (supabase.from('routing_templates') as any)
        .select(`
          *,
          user:user_id(id, nom, email, zone_assignee),
          creator:created_by(id, nom),
          routing_template_exception(id, template_id, pdv_id, date_debut, date_fin, motif)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      if (userId) query = query.eq('user_id', userId)

      const { data, error } = await query
      if (error) throw error
      const regles = (data || []) as RoutingTemplate[]

      // Règles « portefeuille » de plusieurs milliers de PDV (des dizaines de
      // milliers au total) : compteurs + première page seulement, la suite se
      // charge à la demande (chargerPdvRegle).
      await Promise.all(regles.map(async (t) => {
        t.routing_template_pdv = []
        const [total, sansGps] = await Promise.all([
          (supabase.from('routing_template_pdv') as any)
            .select('id', { count: 'exact', head: true })
            .eq('template_id', t.id),
          (supabase.from('routing_template_pdv') as any)
            .select('id, pdv:pdv_id!inner(pdv_id)', { count: 'exact', head: true })
            .eq('template_id', t.id)
            .is('pdv.geolocation_lat', null),
        ])
        t.nb_pdv = total.count ?? 0
        t.nb_sans_gps = sansGps.count ?? 0
        await chargerPdvRegle(t)
      }))

      templates.value = regles
      return templates.value
    } catch (err) {
      console.error('Erreur chargement templates:', err)
      return []
    } finally {
      templateLoading.value = false
    }
  }

  // ---- Create a new template (règle récurrente) ----
  // `days_of_week` remplace le jour unique : « chaque lundi ET chaque jeudi ».
  // `territoire` / `distributeur` sont portés par la règle, pas par le profil :
  // c'est ce qui permet à un merchandiser de couvrir Abobo/Distributeur A une
  // semaine et Adjamé/Distributeur B la suivante.
  async function createTemplate(
    userId: string,
    daysOfWeek: number[],
    label: string,
    createdBy: string,
    options: {
      notes?: string
      territoire?: string
      distributeur?: string
      dateDebut?: string
      dateFin?: string
      /** quota = Atom : N PDV par canal et par jour, chaque PDV une fois par mois. */
      mode?: RoutingTemplateMode
      /** SSF de la règle : sa sous-zone borne les PDV (merchandisers Atom). */
      ssfId?: number | null
    } = {}
  ) {
    if (!daysOfWeek.length) throw new Error('Sélectionnez au moins un jour de la semaine')

    const { data, error } = await (supabase.from('routing_templates') as any)
      .insert({
        // Colonne ssf_id (migration 20261007100000) écrite seulement si un SSF est choisi.
        ...(options.ssfId ? { ssf_id: options.ssfId } : {}),
        user_id: userId,
        days_of_week: daysOfWeek,
        // Renseigné pour rester lisible par tout code n'ayant pas encore migré.
        day_of_week: daysOfWeek[0],
        label: label || null,
        notes: options.notes || null,
        territoire: options.territoire || null,
        distributeur: options.distributeur || null,
        date_debut: options.dateDebut || null,
        date_fin: options.dateFin || null,
        mode: options.mode || 'perimetre',
        is_active: true,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) throw error
    return data as RoutingTemplate
  }

  // ---- Update template metadata ----
  async function updateTemplate(
    templateId: string,
    updates: {
      label?: string
      notes?: string
      is_active?: boolean
      days_of_week?: number[]
      territoire?: string | null
      distributeur?: string | null
      date_debut?: string | null
      date_fin?: string | null
      mode?: RoutingTemplateMode
      ssf_id?: number | null
    }
  ) {
    const payload: any = { ...updates }
    if (updates.days_of_week) {
      if (!updates.days_of_week.length) throw new Error('Sélectionnez au moins un jour de la semaine')
      payload.day_of_week = updates.days_of_week[0]
    }
    const { error } = await (supabase.from('routing_templates') as any)
      .update(payload)
      .eq('id', templateId)

    if (error) throw error
  }

  // ---- Exceptions : « cette semaine, il ne visite pas ce PDV » ----
  // pdvId omis = toute la tournée suspendue sur la période. La règle n'est
  // jamais supprimée : elle reprend d'elle-même après la fenêtre.
  async function addTemplateException(
    templateId: string,
    dateDebut: string,
    dateFin: string,
    options: { pdvId?: string; motif?: string; createdBy?: string } = {}
  ) {
    const { data, error } = await (supabase.from('routing_template_exception') as any)
      .insert({
        template_id: templateId,
        pdv_id: options.pdvId || null,
        date_debut: dateDebut,
        date_fin: dateFin,
        motif: options.motif || null,
        created_by: options.createdBy || null,
      })
      .select()
      .single()

    if (error) throw error
    return data as RoutingTemplateException
  }

  async function removeTemplateException(exceptionId: string) {
    const { error } = await (supabase.from('routing_template_exception') as any)
      .delete()
      .eq('id', exceptionId)

    if (error) throw error
  }

  /**
   * Pré-génère les tournées d'un merchandiser sur une fenêtre glissante.
   *
   * C'est le chemin principal de matérialisation : l'app mobile est
   * offline-first, un merchandiser qui ouvre l'app sans réseau doit trouver sa
   * tournée déjà créée et mise en cache. Idempotent : les tournées existantes
   * sont laissées intactes, avancement terrain compris.
   */
  async function materialiserPeriode(userId: string, dateDebut: string, dateFin: string): Promise<number> {
    const { data, error } = await (supabase.rpc as any)('materialiser_routings_periode', {
      p_user_id: userId,
      p_date_debut: dateDebut,
      p_date_fin: dateFin,
    })
    if (error) throw error
    return (data as number) || 0
  }

  /** Pré-génération J → J+jours pour tous les merchandisers ayant une règle active. */
  async function preGenererHorizon(jours = 7): Promise<{ users: number; tournees: number }> {
    const { data: regles, error } = await (supabase.from('routing_templates') as any)
      .select('user_id')
      .eq('is_active', true)
    if (error) throw error

    const userIds = [...new Set((regles || []).map((r: any) => r.user_id).filter(Boolean))] as string[]
    const debut = new Date()
    const fin = new Date()
    fin.setDate(fin.getDate() + jours)

    let tournees = 0
    for (const userId of userIds) {
      tournees += await materialiserPeriode(userId, toIsoJour(debut), toIsoJour(fin))
    }
    return { users: userIds.length, tournees }
  }

  // ---- Delete template ----
  async function deleteTemplate(templateId: string) {
    const { error } = await (supabase.from('routing_templates') as any)
      .delete()
      .eq('id', templateId)

    if (error) throw error
  }

  /**
   * Garde de périmètre côté RÈGLE (tâche 4.4).
   *
   * Les tournées ponctuelles restent validées contre `profiles.territoires_assignes`
   * (voir assertScopedPDV) : c'est leur seul filet. Mais une règle récurrente
   * porte SON territoire, précisément pour qu'un merchandiser puisse couvrir
   * Abobo une semaine et Adjamé la suivante — un contrôle contre le profil figé
   * rejetterait le second cas. On valide donc contre le territoire de la règle.
   * Règle sans territoire = pas de contrainte (l'admin assume).
   * Règle liée à un SSF : le PDV doit être dans sa sous-zone (ssf_quartier) ;
   * un PDV sans quartier est accepté s'il est dans une zone de la sous-zone.
   */
  async function assertScopedPDVForRegle(templateId: string, pdvIds: string[]) {
    const ids = [...new Set(pdvIds.filter(Boolean))]
    if (!ids.length) return

    let { data: tpl, error: tplErr } = await (supabase.from('routing_templates') as any)
      .select('territoire, ssf_id')
      .eq('id', templateId)
      .single()
    if (tplErr) {
      // Base sans ssf_id (migration 20261007100000 non appliquée).
      ;({ data: tpl, error: tplErr } = await (supabase.from('routing_templates') as any)
        .select('territoire').eq('id', templateId).single())
    }
    if (tplErr) throw tplErr

    if (tpl?.ssf_id) {
      const { data: sousZone, error: szErr } = await (supabase.from('ssf_quartier') as any)
        .select('zone, quartier').eq('ssf_id', tpl.ssf_id)
      if (szErr) throw szErr
      if ((sousZone || []).length) {
        const cles = new Set((sousZone || []).map((q: any) => `${q.zone}|${q.quartier}`))
        const zones = new Set((sousZone || []).map((q: any) => q.zone))
        const { data: pdvs, error: pdvErr } = await (supabase.from('pdv') as any)
          .select('pdv_id, nom_pdv, zone, quartier').in('pdv_id', ids)
        if (pdvErr) throw pdvErr
        const hors = (pdvs || []).filter((p: any) => p.quartier ? !cles.has(`${p.zone}|${p.quartier}`) : !zones.has(p.zone))
        if (hors.length) {
          throw new Error(`${hors.length} PDV hors de la sous-zone du SSF de la règle : ${hors.slice(0, 3).map((p: any) => `${p.nom_pdv} (${p.zone} › ${p.quartier || 'sans quartier'})`).join(', ')}${hors.length > 3 ? '…' : ''}. Ajoutez le quartier dans Référentiels › SSF ↔ Quartiers si besoin.`)
        }
        return
      }
    }
    if (!tpl?.territoire) return

    const { data: pdvs, error: pdvErr } = await (supabase.from('pdv') as any)
      .select('pdv_id, zone')
      .in('pdv_id', ids)
    if (pdvErr) throw pdvErr

    const hors = (pdvs || []).filter((p: any) => p.zone !== tpl.territoire).map((p: any) => p.pdv_id)
    if (hors.length) {
      throw new Error(`${hors.length} PDV hors du territoire de la règle (${tpl.territoire}) : ${hors.slice(0, 5).join(', ')}${hors.length > 5 ? '…' : ''}`)
    }
  }

  // ---- Add PDV to template ----
  async function addTemplatePDV(
    templateId: string,
    pdvId: string,
    objectifs: RoutingObjectives = { releve_stock: true, photos: true }
  ) {
    await assertScopedPDVForRegle(templateId, [pdvId])

    // Dernière position lue en base : la liste locale n'est chargée que par pages.
    const template = templates.value.find(t => t.id === templateId)
    const { data: dernier, error: posErr } = await (supabase.from('routing_template_pdv') as any)
      .select('position_order')
      .eq('template_id', templateId)
      .order('position_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (posErr) throw posErr
    const maxPos = (dernier as any)?.position_order || 0

    const { data, error } = await (supabase.from('routing_template_pdv') as any)
      .insert({
        template_id: templateId,
        pdv_id: pdvId,
        position_order: maxPos + 1,
        objectifs,
      })
      .select('*, pdv:pdv_id(pdv_id, nom_pdv, zone, quartier, geolocation_lat, geolocation_lng)')
      .single()

    if (error?.code === '23505') throw new Error('Ce PDV est déjà dans la règle.')
    if (error) throw error

    // Update local state
    if (template) {
      if (!template.routing_template_pdv) template.routing_template_pdv = []
      template.routing_template_pdv.push(data as RoutingTemplatePDV)
      template.nb_pdv = (template.nb_pdv ?? 0) + 1
      if ((data as any)?.pdv && (data as any).pdv.geolocation_lat == null) template.nb_sans_gps = (template.nb_sans_gps ?? 0) + 1
    }

    return data as RoutingTemplatePDV
  }

  const PAGE_REGLE = 50

  /** Page suivante des PDV d'une règle, dans l'ordre de passage. */
  async function chargerPdvRegle(template: RoutingTemplate) {
    const deja = template.routing_template_pdv || []
    const { data, error } = await (supabase.from('routing_template_pdv') as any)
      .select('id, template_id, pdv_id, position_order, objectifs, pdv:pdv_id(pdv_id, nom_pdv, zone, quartier, geolocation_lat, geolocation_lng)')
      .eq('template_id', template.id)
      .order('position_order')
      .order('id')
      .range(deja.length, deja.length + PAGE_REGLE - 1)
    if (error) throw error
    const vus = new Set(deja.map(p => p.id))
    template.routing_template_pdv = [...deja, ...((data || []) as RoutingTemplatePDV[]).filter(p => !vus.has(p.id))]
  }

  // ---- Remove PDV from template ----
  // Pas de renumérotation : la matérialisation suit l'ordre de position_order,
  // les trous n'y changent rien. Renuméroter une règle de 4 000 PDV coûtait
  // 4 000 requêtes.
  async function removeTemplatePDV(templateId: string, templatePdvId: string) {
    const { error } = await (supabase.from('routing_template_pdv') as any)
      .delete()
      .eq('id', templatePdvId)

    if (error) throw error

    const template = templates.value.find(t => t.id === templateId)
    if (template?.routing_template_pdv) {
      const retire = template.routing_template_pdv.find(p => p.id === templatePdvId)
      template.routing_template_pdv = template.routing_template_pdv.filter(p => p.id !== templatePdvId)
      template.nb_pdv = Math.max(0, (template.nb_pdv ?? 1) - 1)
      if (retire?.pdv && retire.pdv.geolocation_lat == null) template.nb_sans_gps = Math.max(0, (template.nb_sans_gps ?? 1) - 1)
    }
  }

  // ---- Reorder PDV in template ----
  // Les PDV réordonnés reprennent entre eux les positions qu'ils occupaient :
  // seules les lignes dont la position change sont écrites (2 pour un échange).
  async function reorderTemplatePDV(templateId: string, pdvIdOrder: string[]) {
    const template = templates.value.find(t => t.id === templateId)
    if (!template?.routing_template_pdv) return

    const items = pdvIdOrder
      .map(id => template.routing_template_pdv!.find(p => p.id === id))
      .filter((p): p is RoutingTemplatePDV => !!p)
    const positions = items.map(p => p.position_order).sort((a, b) => a - b)
    const changements = items
      .map((p, i) => ({ item: p, position: positions[i] }))
      .filter(c => c.item.position_order !== c.position)

    for (const { item, position } of changements) {
      const { error } = await (supabase.from('routing_template_pdv') as any)
        .update({ position_order: position })
        .eq('id', item.id)
      if (error) throw error
      item.position_order = position
    }

    template.routing_template_pdv.sort((a, b) => a.position_order - b.position_order)
  }

  // ---- Update objectifs for a template PDV ----
  async function updateTemplatePDVObjectifs(templatePdvId: string, objectifs: RoutingObjectives) {
    const { error } = await (supabase.from('routing_template_pdv') as any)
      .update({ objectifs })
      .eq('id', templatePdvId)

    if (error) throw error
  }

  /**
   * Matérialise les tournées d'un merchandiser sur une plage de dates, depuis
   * ses règles récurrentes.
   *
   * Remplace l'ancienne boucle côté client (un seul jour de semaine par règle,
   * et un `catch` nu qui classait toute erreur en « existe déjà » — une panne
   * réseau ou un PDV supprimé passait pour un doublon). La RPC SQL gère les
   * règles multi-jours, les exceptions, et l'idempotence.
   */
  async function generateFromTemplates(
    userId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<{ crees: number }> {
    const crees = await materialiserPeriode(userId, dateFrom, dateTo)
    return { crees }
  }

  return {
    todayRouting,
    routingPDVList,
    loading,
    completedCount,
    totalCount,
    progressPercent,
    nextPendingPDV,
    currentInProgressPDV,
    fetchTodayRouting,
    chargerPageRouting,
    chargementPage,
    fetchCalendrierTournees,
    toutCharge,
    getRoutingPDV,
    updateRoutingPDVStatus,
    syncRoutingStatus,
    fetchRoutings,
    chargerEtapesRouting,
    toutesEtapesRouting,
    chargerPdvRegle,
    createRouting,
    updateRouting,
    deleteRouting,
    duplicateRouting,
    importRoutingsFromCSV,
    // Règles récurrentes (ex-« templates »)
    templates,
    templateLoading,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    addTemplatePDV,
    removeTemplatePDV,
    reorderTemplatePDV,
    updateTemplatePDVObjectifs,
    generateFromTemplates,
    // Exceptions ponctuelles + matérialisation
    addTemplateException,
    removeTemplateException,
    materialiserPeriode,
    preGenererHorizon,
  }
})
