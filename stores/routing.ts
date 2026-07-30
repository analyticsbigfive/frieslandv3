// stores/routing.ts
import { defineStore, skipHydrate } from 'pinia'
import { markRaw } from 'vue'
import type { Routing, RoutingPDV, RoutingObjectives, RoutingTemplate, RoutingTemplatePDV, RoutingTemplateException, Profile } from '~/types'

export const useRoutingStore = defineStore('routing', () => {
  const supabase = skipHydrate(markRaw(useSupabaseClient()))

  const todayRouting = ref<Routing | null>(null)
  const routingPDVList = ref<RoutingPDV[]>([])
  const loading = ref(false)

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
    if (profile?.role === 'admin' || profile?.role === 'superviseur') return []

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

      const { data, error } = await (supabase
        .from('routings') as any)
        .select(`
          *,
          user:user_id(id, nom, email),
          routing_pdv(
            *,
            pdv:pdv_id(pdv_id, nom_pdv, zone, quartier, geolocation_lat, geolocation_lng, rayon_geofence, canal, adressage, image_url)
          )
        `)
        .eq('user_id', userId)
        .eq('date_routing', today)
        .neq('status', 'cancelled')
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        todayRouting.value = data as Routing
        routingPDVList.value = ((data as any).routing_pdv || [])
          .sort((a: RoutingPDV, b: RoutingPDV) => a.position_order - b.position_order) as RoutingPDV[]
        console.info(`[Routing] ${routingPDVList.value.length} PDV chargés pour le ${today}`)
      } else {
        todayRouting.value = null
        routingPDVList.value = []
        console.warn(`[Routing] Aucun routing trouvé pour user=${userId} date=${today}`)
      }
    } catch (err) {
      console.error('Erreur chargement routing:', err)
    } finally {
      loading.value = false
    }
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

    const { error } = await (supabase
      .from('routing_pdv') as any)
      .update(update)
      .eq('id', routingPdvId)

    if (error) throw error

    // Update local state
    const idx = routingPDVList.value.findIndex(rp => rp.id === routingPdvId)
    if (idx !== -1) {
      routingPDVList.value[idx] = { ...routingPDVList.value[idx], ...update }
    }

    // Auto-update routing status
    await syncRoutingStatus()
  }

  // ---- Auto-update routing status based on PDV progress ----
  async function syncRoutingStatus() {
    if (!todayRouting.value) return

    const allCompleted = routingPDVList.value.every(
      rp => rp.status === 'completed' || rp.status === 'skipped'
    )
    const anyInProgress = routingPDVList.value.some(
      rp => rp.status === 'in_progress' || rp.status === 'completed'
    )

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
  }) {
    loading.value = true
    try {
      let query = (supabase
        .from('routings') as any)
        .select(`
          *,
          user:user_id(id, nom, email, zone_assignee),
          creator:created_by(id, nom),
          routing_pdv(
            id, pdv_id, position_order, objectifs, status, geofence_validated, arrived_at, completed_at, visite_id,
            pdv:pdv_id(pdv_id, nom_pdv, zone, quartier)
          )
        `)
        .order('date_routing', { ascending: false })

      if (filters?.dateFrom) query = query.gte('date_routing', filters.dateFrom)
      if (filters?.dateTo) query = query.lte('date_routing', filters.dateTo)
      if (filters?.userId) query = query.eq('user_id', filters.userId)
      if (filters?.status) query = query.eq('status', filters.status)

      const { data, error } = await query.limit(200)
      if (error) throw error
      return (data || []) as Routing[]
    } catch (err) {
      console.error('Erreur chargement routings:', err)
      return []
    } finally {
      loading.value = false
    }
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
    // Fetch original
    const { data: original } = await (supabase
      .from('routings') as any)
      .select('*, routing_pdv(*)')
      .eq('id', routingId)
      .single()

    if (!original) throw new Error('Routing introuvable')

    const orig = original as any
    const targetUserId = newUserId || orig.user_id

    return await createRouting(
      targetUserId,
      newDate,
      (orig.routing_pdv || [])
        .sort((a: any, b: any) => a.position_order - b.position_order)
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

    const { data: existing, error: exErr } = await (supabase
      .from('routing_pdv') as any)
      .select('id, pdv_id')
      .eq('routing_id', routingId)
    if (exErr) throw exErr

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

    // Résolution email -> profil (id + périmètre pour la garde territoire)
    const { data: profiles, error: pErr } = await (supabase.from('profiles') as any)
      .select('id, email, role, zone_assignee, territoires_assignes, quartiers_assignes')
    if (pErr) throw pErr
    const emailToProfile = new Map<string, any>(
      (profiles || []).map((p: any) => [String(p.email || '').trim().toLowerCase(), p])
    )

    // PDV valides + leur zone/quartier (pour vérifier le périmètre)
    const { data: pdvs, error: pdvErr } = await (supabase.from('pdv') as any)
      .select('pdv_id, zone, quartier')
      .eq('is_active', true)
    if (pdvErr) throw pdvErr
    const pdvById = new Map<string, any>((pdvs || []).map((p: any) => [p.pdv_id, p]))
    const validPdv = new Set(pdvById.keys())

    const parseBool = (v?: string) => {
      const s = (v || '').trim().toLowerCase()
      return s === 'true' || s === '1' || s === 'oui' || s === 'yes' || s === 'x'
    }

    // Regroupement par email + date
    type Grp = { email: string; date: string; notes: string; status: string; items: { pdv_id: string; ordre: number; objectifs: RoutingObjectives }[] }
    const groups = new Map<string, Grp>()

    rows.forEach((r, i) => {
      const lineNo = i + 2 // ligne 1 = en-têtes
      const email = (r.email || '').trim().toLowerCase()
      const date = (r.date || '').trim()
      const pdvId = (r.pdv_id || '').trim()

      if (!email || !date || !pdvId) {
        summary.errors.push(`Ligne ${lineNo}: email, date ou pdv_id manquant`)
        return
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        summary.errors.push(`Ligne ${lineNo}: date "${date}" invalide (format AAAA-MM-JJ)`)
        return
      }

      const key = `${email}__${date}`
      let g = groups.get(key)
      if (!g) {
        g = { email, date, notes: '', status: 'pending', items: [] }
        groups.set(key, g)
      }
      if (r.notes && r.notes.trim() && !g.notes) g.notes = r.notes.trim()
      if (r.statut && r.statut.trim()) g.status = r.statut.trim().toLowerCase()

      g.items.push({
        pdv_id: pdvId,
        ordre: parseInt(r.ordre) || g.items.length + 1,
        objectifs: {
          releve_stock: parseBool(r.releve_stock),
          encaissement: parseBool(r.encaissement),
          photos: parseBool(r.photos),
          merchandising: parseBool(r.merchandising),
          prospection: parseBool(r.prospection),
        },
      })
    })

    // Traitement de chaque groupe (routing)
    for (const g of groups.values()) {
      const profile = emailToProfile.get(g.email)
      if (!profile) {
        summary.errors.push(`${g.email} (${g.date}): utilisateur introuvable`)
        continue
      }
      const userId = profile.id

      const items = g.items
        .filter((it) => {
          if (!validPdv.has(it.pdv_id)) {
            summary.errors.push(`${g.email} (${g.date}): PDV "${it.pdv_id}" introuvable, ignoré`)
            return false
          }
          // Garde périmètre : PDV hors territoires assignés au user → rejeté avec message clair.
          if (!pdvInScope(pdvById.get(it.pdv_id), profile as Profile)) {
            summary.errors.push(`${g.email} (${g.date}): PDV "${it.pdv_id}" hors du périmètre assigné, ignoré`)
            return false
          }
          return true
        })
        .sort((a, b) => a.ordre - b.ordre)
        .map(it => ({ pdv_id: it.pdv_id, objectifs: it.objectifs }))

      if (!items.length) {
        summary.errors.push(`${g.email} (${g.date}): aucun PDV valide, routing ignoré`)
        continue
      }

      const validStatus = ['pending', 'in_progress', 'completed', 'cancelled'].includes(g.status) ? g.status : 'pending'

      // Routing existant ? (UNIQUE user_id + date_routing)
      const { data: existing } = await (supabase.from('routings') as any)
        .select('id')
        .eq('user_id', userId)
        .eq('date_routing', g.date)
        .maybeSingle()

      try {
        if (existing?.id) {
          await updateRouting(
            existing.id,
            { notes: g.notes || null, status: validStatus },
            items,
            { supprimerAbsents: mode === 'remplacement' },
          )
          summary.updated++
        } else {
          const created = await createRouting(userId, g.date, items, createdBy, g.notes || undefined)
          if (validStatus !== 'pending') {
            await (supabase.from('routings') as any).update({ status: validStatus }).eq('id', (created as any).id)
          }
          summary.created++
        }
        summary.pdvCount += items.length
      } catch (err: any) {
        summary.errors.push(`${g.email} (${g.date}): ${err.message}`)
      }
    }

    return summary
  }

  // ---- Computed helpers ----
  const completedCount = computed(() =>
    routingPDVList.value.filter(rp => rp.status === 'completed').length
  )

  const totalCount = computed(() => routingPDVList.value.length)

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
          routing_template_pdv(
            id, pdv_id, position_order, objectifs,
            pdv:pdv_id(pdv_id, nom_pdv, zone, quartier)
          ),
          routing_template_exception(id, template_id, pdv_id, date_debut, date_fin, motif)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      if (userId) query = query.eq('user_id', userId)

      const { data, error } = await query
      if (error) throw error
      templates.value = (data || []) as RoutingTemplate[]
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
    } = {}
  ) {
    if (!daysOfWeek.length) throw new Error('Sélectionnez au moins un jour de la semaine')

    const { data, error } = await (supabase.from('routing_templates') as any)
      .insert({
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
   */
  async function assertScopedPDVForRegle(templateId: string, pdvIds: string[]) {
    const ids = [...new Set(pdvIds.filter(Boolean))]
    if (!ids.length) return

    const { data: tpl, error: tplErr } = await (supabase.from('routing_templates') as any)
      .select('territoire')
      .eq('id', templateId)
      .single()
    if (tplErr) throw tplErr
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

    // Get current max position
    const template = templates.value.find(t => t.id === templateId)
    const maxPos = template?.routing_template_pdv
      ?.reduce((max, p) => Math.max(max, p.position_order), 0) || 0

    const { data, error } = await (supabase.from('routing_template_pdv') as any)
      .insert({
        template_id: templateId,
        pdv_id: pdvId,
        position_order: maxPos + 1,
        objectifs,
      })
      .select('*, pdv:pdv_id(pdv_id, nom_pdv, zone, quartier)')
      .single()

    if (error) throw error

    // Update local state
    if (template) {
      if (!template.routing_template_pdv) template.routing_template_pdv = []
      template.routing_template_pdv.push(data as RoutingTemplatePDV)
    }

    return data as RoutingTemplatePDV
  }

  // ---- Remove PDV from template ----
  async function removeTemplatePDV(templateId: string, templatePdvId: string) {
    const { error } = await (supabase.from('routing_template_pdv') as any)
      .delete()
      .eq('id', templatePdvId)

    if (error) throw error

    // Update local state & reorder
    const template = templates.value.find(t => t.id === templateId)
    if (template?.routing_template_pdv) {
      template.routing_template_pdv = template.routing_template_pdv
        .filter(p => p.id !== templatePdvId)
        .sort((a, b) => a.position_order - b.position_order)
        .map((p, idx) => ({ ...p, position_order: idx + 1 }))

      // Update positions in DB
      for (const p of template.routing_template_pdv) {
        await (supabase.from('routing_template_pdv') as any)
          .update({ position_order: p.position_order })
          .eq('id', p.id)
      }
    }
  }

  // ---- Reorder PDV in template ----
  async function reorderTemplatePDV(templateId: string, pdvIdOrder: string[]) {
    const template = templates.value.find(t => t.id === templateId)
    if (!template?.routing_template_pdv) return

    for (let i = 0; i < pdvIdOrder.length; i++) {
      const item = template.routing_template_pdv.find(p => p.id === pdvIdOrder[i])
      if (item) {
        item.position_order = i + 1
        await (supabase.from('routing_template_pdv') as any)
          .update({ position_order: i + 1 })
          .eq('id', pdvIdOrder[i])
      }
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
    updateRoutingPDVStatus,
    syncRoutingStatus,
    fetchRoutings,
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
