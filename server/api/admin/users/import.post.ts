// server/api/admin/users/import.post.ts
// Import CSV des utilisateurs (upsert par email).
//   - email existant : mise à jour des seuls champs fournis non vides
//     (jamais l'email ni le mot de passe) ;
//   - email inconnu : création auth + profil avec mot_de_passe fourni,
//     sinon SEED_DEFAULT_PASSWORD.
// Le rôle 'admin' est importable : l'endpoint est réservé aux admins
// (requireAdmin), il n'y a donc pas d'escalade possible.
import { serverSupabaseServiceRole } from '#supabase/server'
import type { UserRole } from '~/types'
import { createUserWithProfile, USER_ROLES, EMAIL_RE } from '../../../utils/adminUsers'

const MAX_ROWS = 500

interface ImportRow {
  line?: number
  email?: string
  nom?: string
  role?: string
  telephone?: string
  is_active?: string
  zone_assignee?: string
  territoires_assignes?: string[]
  quartiers_assignes?: string[]
  region?: string
  mot_de_passe?: string
}

function parseBool(v: string): boolean | null {
  const s = String(v || '').trim().toLowerCase()
  if (['true', '1', 'oui', 'yes', 'actif'].includes(s)) return true
  if (['false', '0', 'non', 'no', 'inactif'].includes(s)) return false
  return null
}

export default defineEventHandler(async (event) => {
  const service = serverSupabaseServiceRole(event) as any
  await requireAdmin(event, service)

  const body = await readBody(event)
  const rows: ImportRow[] = Array.isArray(body?.rows) ? body.rows : []
  if (!rows.length) throw apiError(400, 'Aucune ligne à importer')
  if (rows.length > MAX_ROWS) throw apiError(400, `Maximum ${MAX_ROWS} lignes par import (${rows.length} reçues)`)

  const { data: existing, error: exErr } = await service.from('profiles').select('id, email')
  if (exErr) throw apiError(500, `Lecture des profils impossible : ${exErr.message}`)
  const idByEmail = new Map<string, string>(
    (existing || []).map((p: any) => [String(p.email || '').toLowerCase(), p.id]),
  )

  const toStringArray = (v: any) =>
    (Array.isArray(v) ? v : []).map((x: any) => String(x).trim()).filter(Boolean)

  let created = 0
  let updated = 0
  const errors: { line: number; email: string; message: string }[] = []
  const seenEmails = new Set<string>()

  for (const [i, row] of rows.entries()) {
    const line = Number(row?.line) || i + 2
    const email = String(row?.email || '').trim().toLowerCase()
    const fail = (message: string) => errors.push({ line, email, message })

    if (!email || !EMAIL_RE.test(email)) { fail('Email manquant ou invalide'); continue }
    if (seenEmails.has(email)) { fail('Email en double dans le fichier (première occurrence traitée)'); continue }
    seenEmails.add(email)

    const nom = String(row?.nom || '').trim().substring(0, 100)
    const roleRaw = String(row?.role || '').trim().toLowerCase()
    if (roleRaw && !USER_ROLES.includes(roleRaw as UserRole)) { fail(`Rôle invalide : ${roleRaw}`); continue }
    const isActiveRaw = String(row?.is_active ?? '').trim()
    const isActive = isActiveRaw ? parseBool(isActiveRaw) : null
    if (isActiveRaw && isActive === null) { fail(`Valeur is_active invalide : ${isActiveRaw}`); continue }

    const territoires = toStringArray(row?.territoires_assignes)
    const quartiers = toStringArray(row?.quartiers_assignes)
    const telephone = row?.telephone ? String(row.telephone).trim().substring(0, 50) : ''
    const zoneAssignee = String(row?.zone_assignee || '').trim()
    const region = String(row?.region || '').trim()

    const existingId = idByEmail.get(email)
    if (existingId) {
      // Mise à jour partielle : seuls les champs fournis non vides sont modifiés.
      const patch: Record<string, any> = {}
      if (nom) patch.nom = nom
      if (roleRaw) patch.role = roleRaw
      if (telephone) patch.telephone = telephone
      if (isActive !== null) patch.is_active = isActive
      if (territoires.length) patch.territoires_assignes = territoires
      if (quartiers.length) patch.quartiers_assignes = quartiers
      if (zoneAssignee || territoires.length) patch.zone_assignee = zoneAssignee || territoires[0]
      if (region) patch.region = region
      if (!Object.keys(patch).length) { fail('Aucun champ à mettre à jour'); continue }

      const { error } = await service.from('profiles').update(patch).eq('id', existingId)
      if (error) { fail(error.message); continue }
      updated++
    } else {
      const password = String(row?.mot_de_passe || '').trim() || String(process.env.SEED_DEFAULT_PASSWORD || '')
      if (!nom) { fail('Le nom est requis pour créer un compte'); continue }
      if (password.length < 8) {
        fail(row?.mot_de_passe
          ? 'Le mot de passe doit contenir au moins 8 caractères'
          : 'Aucun mot_de_passe fourni et SEED_DEFAULT_PASSWORD non configuré')
        continue
      }
      try {
        const profile = await createUserWithProfile(service, {
          email,
          password,
          nom,
          role: (roleRaw || 'merchandiser') as UserRole,
          telephone: telephone || null,
          zone_assignee: zoneAssignee || territoires[0] || null,
          territoires_assignes: territoires,
          quartiers_assignes: quartiers,
          region: region || null,
        })
        idByEmail.set(email, profile.id)
        created++
      } catch (e: any) {
        fail(e?.statusMessage || e?.message || 'Création impossible')
      }
    }
  }

  return { created, updated, errors }
})
