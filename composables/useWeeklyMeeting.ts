// composables/useWeeklyMeeting.ts
// Weekly Meeting Merchandising Agency : lit en base la semaine d'une agence
// (lundi → samedi) et la semaine précédente, puis construit le rapport
// (utils/weeklyMeeting.ts) et sa présentation (utils/weeklyMeetingPptx.ts).
//
// Tout se lit avec les droits du compte connecté (écran réservé aux admins) :
// pas de fonction SQL dédiée, donc pas de migration à appliquer.
import { estCompteTest } from '~/utils/adoptionApp'
import type { Agence } from '~/utils/agences'
import { libelleDirection } from '~/utils/agences'
import { chargerPptxGenJS } from '~/utils/chargerPptx'
import { fetchAllRows } from '~/utils/fetchAll'
import { categoriesProduitsActives } from '~/utils/products'
import { estSituationIndisponible } from '~/utils/situationTournee'
import {
  construireRapport, lendemainDe, semainePrecedente,
  type FermetureHebdo, type MembreAgence, type RapportHebdo, type ResultatHebdo, type SemaineHebdo, type TourneeHebdo, type VisiteHebdo,
} from '~/utils/weeklyMeeting'
import { construirePresentation, type PhotoSlide } from '~/utils/weeklyMeetingPptx'

// Identifiants passés dans l'URL (in.(…)) : par paquets, pour rester loin des
// limites de longueur d'URL.
const PAQUET_COMPTES = 40
const PAQUET_VISITES = 100
const PARALLELES = 6

const COLONNES_LEGERES = 'id, pdv_id, user_id, email, date_visite'
const COLONNES_COMPLETES = `${COLONNES_LEGERES}, commercial, geofence_validated, data, image_urls, pdv:pdv_id(nom_pdv, zone, quartier)`

function paquets<T>(xs: T[], taille: number): T[][] {
  return Array.from({ length: Math.ceil(xs.length / taille) }, (_, i) => xs.slice(i * taille, (i + 1) * taille))
}

async function parLots<T, R>(elements: T[], lire: (e: T) => Promise<R[]>): Promise<R[]> {
  const sortie: R[] = []
  for (const lot of paquets(elements, PARALLELES)) {
    for (const lignes of await Promise.all(lot.map(lire))) sortie.push(...lignes)
  }
  return sortie
}

export function useWeeklyMeeting() {
  const supabase = useSupabaseClient() as any
  const { charger: chargerCatalogue } = useCatalogueReleve()
  const { fetchElements } = useVisibilityStandards()
  // Colonne calculée visites.situation_tournee (migration 20261105120000) :
  // demandée une fois, abandonnée si la base ne la connaît pas.
  const situationDisponible = useState('weekly-situation-disponible', () => true)

  /** Comptes de l'agence, hors comptes de test (QA Atom…) : ni leurs visites ni leurs tournées ne comptent. */
  async function lireMembres(agence: string): Promise<MembreAgence[]> {
    const comptes = await fetchAllRows<MembreAgence>((from, to) => supabase.from('profiles')
      .select('id, nom, email, role, is_active')
      .eq('employeur', agence)
      .order('id')
      .range(from, to))
    return comptes.filter(m => !estCompteTest(m.email))
  }

  /** Visites des comptes de l'agence sur la semaine : par user_id, sinon par e-mail (visites sans user_id). */
  async function lireVisites(membres: MembreAgence[], s: SemaineHebdo, completes: boolean): Promise<VisiteHebdo[]> {
    const lire = (avecSituation: boolean) => parLots(paquets(membres, PAQUET_COMPTES), (lot) => {
      const ids = lot.map(m => m.id)
      const emails = lot.map(m => m.email).filter((e): e is string => !!e)
      const auteurs = [
        `user_id.in.(${ids.join(',')})`,
        emails.length ? `and(user_id.is.null,email.in.(${emails.map(e => `"${e.replace(/["\\]/g, '\\$&')}"`).join(',')}))` : '',
      ].filter(Boolean).join(',')
      const colonnes = `${completes ? COLONNES_COMPLETES : COLONNES_LEGERES}${completes && avecSituation ? ', situation_tournee' : ''}`
      return fetchAllRows<VisiteHebdo>((from, to) => supabase.from('visites')
        .select(colonnes)
        .gte('date_visite', s.debut)
        .lt('date_visite', lendemainDe(s.fin))
        .or(auteurs)
        .order('date_visite').order('id')
        .range(from, to))
    })

    let visites: VisiteHebdo[]
    try {
      visites = await lire(situationDisponible.value)
    }
    catch (err) {
      if (!situationDisponible.value || !estSituationIndisponible(err)) throw err
      console.warn('visites.situation_tournee indisponible (migration 20261105120000 non appliquée) : rapport sans la situation dans la tournée.')
      situationDisponible.value = false
      visites = await lire(false)
    }

    // Résultats Perfect Store, un par visite scorée.
    const resultats = await parLots(paquets(visites.map(v => v.id), PAQUET_VISITES), async (ids) => {
      const { data, error } = await supabase.from('resultat_perfect_store')
        .select('visite_id, niveau, dispo_rayon, visibilite, score_global, calcule_le')
        .in('visite_id', ids)
      if (error) throw error
      return (data || []) as (ResultatHebdo & { visite_id: string })[]
    })
    const parVisite = new Map(resultats.map(r => [r.visite_id, r]))
    return visites.map(v => ({ ...v, resultat: parVisite.get(v.id) ?? null }))
  }

  /** Tournées non annulées de la semaine, avec leurs compteurs (étapes, étapes faites). */
  async function lireTournees(membres: MembreAgence[], s: SemaineHebdo): Promise<TourneeHebdo[]> {
    return parLots(paquets(membres.map(m => m.id), PAQUET_COMPTES * 2), async (ids) => {
      const lignes = await fetchAllRows<any>((from, to) => supabase.from('routings')
        .select('id, user_id, date_routing, total:routing_pdv(count), faits:routing_pdv(count)')
        .eq('faits.status', 'completed')
        .in('user_id', ids)
        .gte('date_routing', s.debut)
        .lte('date_routing', s.fin)
        .neq('status', 'cancelled')
        .order('date_routing').order('id')
        .range(from, to))
      return lignes.map(l => ({
        user_id: l.user_id,
        date_routing: String(l.date_routing).slice(0, 10),
        nb_pdv: l.total?.[0]?.count ?? 0,
        nb_faits: l.faits?.[0]?.count ?? 0,
      }))
    })
  }

  /** PDV signalés fermés par l'agence sur la semaine. Liste vide si la table n'existe pas encore. */
  async function lireFermetures(membres: MembreAgence[], s: SemaineHebdo): Promise<FermetureHebdo[]> {
    try {
      return await parLots(paquets(membres.map(m => m.id), PAQUET_COMPTES * 2), async (ids) => {
        const { data, error } = await supabase.from('pdv_fermeture')
          .select('pdv_id, declare_par, declare_le, decision, commentaire, pdv:pdv_id(nom_pdv, zone, quartier)')
          .in('declare_par', ids)
          .gte('declare_le', s.debut)
          .lt('declare_le', lendemainDe(s.fin))
          .order('declare_le', { ascending: false })
        if (error) throw error
        return (data || []).map((f: any) => ({
          pdv_id: f.pdv_id,
          nom_pdv: f.pdv?.nom_pdv ?? null,
          zone: f.pdv?.zone ?? null,
          quartier: f.pdv?.quartier ?? null,
          declare_par: f.declare_par,
          declare_le: f.declare_le,
          decision: f.decision,
          commentaire: f.commentaire,
        }))
      })
    }
    catch (err: any) {
      console.warn('pdv_fermeture illisible (migration 20261106120000 ?) : rapport sans les fermetures signalées.', err?.message)
      return []
    }
  }

  async function chargerRapport(agence: Agence, semaine: SemaineHebdo): Promise<RapportHebdo> {
    const precedente = semainePrecedente(semaine)
    const [membres, elements] = await Promise.all([lireMembres(agence.code), fetchElements(), chargerCatalogue()])
    const [visites, visitesPrecedentes, tournees, tourneesPrecedentes, fermetures] = membres.length
      ? await Promise.all([
          lireVisites(membres, semaine, true),
          lireVisites(membres, precedente, false),
          lireTournees(membres, semaine),
          lireTournees(membres, precedente),
          lireFermetures(membres, semaine),
        ])
      : [[], [], [], [], []]

    return construireRapport({
      agence: { code: agence.code, nom: agence.nom, direction: agence.direction },
      semaine,
      membres,
      visites,
      visitesPrecedentes,
      tournees,
      tourneesPrecedentes,
      fermetures,
      catalogue: categoriesProduitsActives().map(c => ({ key: c.key, label: c.label, skus: c.skus.map(s => ({ key: s.key, label: s.label })) })),
      elementsVisibilite: elements.map(e => ({ code: e.code, nom: e.nom, emplacement: e.emplacement, pilier: e.pilier })),
    })
  }

  /** Télécharge et réduit une photo (1 400 px au plus, JPEG) pour l'insérer dans une slide. */
  async function chargerPhoto(url: string): Promise<{ data: string, largeur: number, hauteur: number } | null> {
    try {
      const reponse = await fetch(url)
      if (!reponse.ok) return null
      const image = await createImageBitmap(await reponse.blob())
      const echelle = Math.min(1, 1400 / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * echelle))
      canvas.height = Math.max(1, Math.round(image.height * echelle))
      canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
      image.close()
      return { data: canvas.toDataURL('image/jpeg', 0.82), largeur: canvas.width, hauteur: canvas.height }
    }
    catch {
      return null
    }
  }

  /** Les photos de la slide « Photos de la semaine » : les premières candidates qui se chargent. */
  async function chargerPhotos(rapport: RapportHebdo, max = 6): Promise<PhotoSlide[]> {
    const photos: PhotoSlide[] = []
    for (const candidate of rapport.photos) {
      if (photos.length >= max) break
      const image = await chargerPhoto(candidate.url)
      if (image) {
        photos.push({ ...image, legende: `${candidate.pdv} · ${candidate.merchandiser} · ${candidate.jour.slice(8, 10)}/${candidate.jour.slice(5, 7)}` })
      }
    }
    return photos
  }

  /** Présentation d'une agence, prête à télécharger. */
  async function genererPptx(rapport: RapportHebdo): Promise<Blob> {
    const [Pptx, photos] = await Promise.all([chargerPptxGenJS(), chargerPhotos(rapport)])
    const direction = rapport.agence.direction ? libelleDirection(rapport.agence.direction) : ''
    return await construirePresentation(Pptx, rapport, photos, direction).write({ outputType: 'blob' }) as Blob
  }

  return { chargerRapport, genererPptx }
}
