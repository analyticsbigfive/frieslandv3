// stores/routing.ts
import { defineStore, skipHydrate } from 'pinia'
import { markRaw } from 'vue'
import type { Routing, RoutingPDV, RoutingObjectives, RoutingTemplate, RoutingTemplatePDV, Profile } from '~/types'

export const useRoutingStore = defineStore('routing', () => {
  const supabase = skipHydrate(markRaw(useSupabaseClient()))

  const todayRouting = ref<Routing | null>(null)
  const routingPDVList = ref<RoutingPDV[]>([])
  const loading = ref(false)

  // ---- Mobile: fetch today's routing for current user ----
  async function fetchTodayRouting(userId: string) {
    loading.value = true
    try {
      const today = new Date().toISOString().slice(0, 10)

      const { data, error } = await (supabase
        .from('routings') as any)
        .select(`
          *,
          user:user_id(id, nom, email),
          routing_pdv(
            *,
            pdv:pdv_id(pdv_id, nom_pdv, zone, secteur, geolocation_lat, geolocation_lng, rayon_geofence, canal, adressage, image_url)
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
            pdv:pdv_id(pdv_id, nom_pdv, zone, secteur)
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
            pdv:pdv_id(pdv_id, nom_pdv, zone, secteur)
          )
        `)
        .eq('is_active', true)
        .order('day_of_week', { ascending: true })

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

  // ---- Create a new template ----
  async function createTemplate(
    userId: string,
    dayOfWeek: number,
    label: string,
    createdBy: string,
    notes?: string
  ) {
    const { data, error } = await (supabase.from('routing_templates') as any)
      .insert({
        user_id: userId,
        day_of_week: dayOfWeek,
        label: label || null,
        notes: notes || null,
        is_active: true,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) throw error
    return data as RoutingTemplate
  }

  // ---- Update template metadata ----
  async function updateTemplate(templateId: string, updates: { label?: string; notes?: string; is_active?: boolean }) {
    const { error } = await (supabase.from('routing_templates') as any)
      .update(updates)
      .eq('id', templateId)

    if (error) throw error
  }

  // ---- Delete template ----
  async function deleteTemplate(templateId: string) {
    const { error } = await (supabase.from('routing_templates') as any)
      .delete()
      .eq('id', templateId)

    if (error) throw error
  }

  // ---- Add PDV to template ----
  async function addTemplatePDV(
    templateId: string,
    pdvId: string,
    objectifs: RoutingObjectives = { releve_stock: true, photos: true }
  ) {
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
      .select('*, pdv:pdv_id(pdv_id, nom_pdv, zone, secteur)')
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

  // ---- Generate daily routings from templates for a date range ----
  async function generateFromTemplates(
    userId: string,
    dateFrom: string,
    dateTo: string,
    createdBy: string
  ) {
    // Fetch user's active templates
    const { data: userTemplates, error: tErr } = await (supabase.from('routing_templates') as any)
      .select('*, routing_template_pdv(*)')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (tErr) throw tErr
    if (!userTemplates?.length) throw new Error('Aucun template actif pour cet utilisateur')

    const results: { date: string; status: string }[] = []
    const start = new Date(dateFrom + 'T00:00:00')
    const end = new Date(dateTo + 'T00:00:00')

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay() // 0=Sun, 1=Mon...
      const dateStr = d.toISOString().slice(0, 10)

      const template = userTemplates.find((t: any) => t.day_of_week === dayOfWeek)
      if (!template || !template.routing_template_pdv?.length) {
        results.push({ date: dateStr, status: 'skipped' })
        continue
      }

      try {
        const pdvItems = (template.routing_template_pdv as any[])
          .sort((a: any, b: any) => a.position_order - b.position_order)
          .map((p: any) => ({ pdv_id: p.pdv_id, objectifs: p.objectifs || {} }))

        await createRouting(userId, dateStr, pdvItems, createdBy, template.notes || template.label)
        results.push({ date: dateStr, status: 'created' })
      } catch {
        results.push({ date: dateStr, status: 'exists' })
      }
    }

    return results
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
    deleteRouting,
    duplicateRouting,
    // Templates
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
  }
})
