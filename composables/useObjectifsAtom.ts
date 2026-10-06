// composables/useObjectifsAtom.ts
// Objectifs par canal du merchandiser connecté (tournées Atom par quotas),
// comparés au planifié et au réalisé, sur une plage de dates.
//
// Tout passe par la session de l'utilisateur : la RLS limite déjà règles,
// tournées et visites aux siennes (routing_templates_user_read, routings,
// visites) ; la grille routing_quota_canal est lisible par tout authentifié.
// Le calcul lui-même est dans utils/objectifsAtom.ts (testé).
import { fetchAllRows } from '~/utils/fetchAll'
import {
  compteursVides, objectifsParCanal, pdvDistinctsParCanal,
  type ParCanal, type QuotaCanal, type RegleQuota, type SuspensionRegle,
} from '~/utils/objectifsAtom'

export interface ObjectifsAtom {
  /** false : aucune règle en mode quota → pas d'objectif par canal (Friesland, autre rôle). */
  estQuota: boolean
  /** Jours de la plage où une règle quota s'applique (jours de tournée). */
  joursActifs: number
  objectif: ParCanal
  /** PDV distincts des tournées de la plage (pré-générées jusqu'à J+7 seulement). */
  planifie: ParCanal
  /** PDV distincts visités (visites de l'app et importées) ou étapes « fait » dans la plage. */
  realise: ParCanal
}

// Cache de session : revenir sur la bascule Semaine / Mois, ou rouvrir
// l'écran sans réseau, réaffiche le dernier résultat au lieu d'un écran vide.
// En mémoire seulement (rien sur disque : appareil potentiellement partagé).
const cache = new Map<string, ObjectifsAtom>()

/** Début du jour local AAAA-MM-JJ, en ISO UTC (date_visite est un timestamptz). */
function debutJourLocal(jourIso: string, decalageJours = 0): string {
  const [a, m, j] = jourIso.split('-').map(Number)
  return new Date(a, m - 1, j + decalageJours).toISOString()
}

export function useObjectifsAtom() {
  const supabase = useSupabaseClient()

  /** Dernier résultat connu pour cette plage (cache de session), ou null. */
  function enCache(userId: string, debut: string, fin: string): ObjectifsAtom | null {
    return cache.get(`${userId}:${debut}:${fin}`) ?? null
  }

  async function chargerObjectifs(userId: string, debut: string, fin: string): Promise<ObjectifsAtom> {
    const db = supabase as any

    // 1. Règles quota du merchandiser. Aucune : il n'est pas sur la logique Atom.
    const { data: regles, error: errRegles } = await db
      .from('routing_templates')
      .select('id, days_of_week, day_of_week, date_debut, date_fin, is_active')
      .eq('user_id', userId)
      .eq('mode', 'quota')
    if (errRegles) throw errRegles
    if (!regles?.length) {
      const vide = { estQuota: false, joursActifs: 0, objectif: compteursVides(), planifie: compteursVides(), realise: compteursVides() }
      cache.set(`${userId}:${debut}:${fin}`, vide)
      return vide
    }
    const idsRegles = (regles as RegleQuota[]).map(r => r.id)

    // 2. Grille, suspensions de règle, étapes planifiées et visites, en parallèle.
    const [grilleRes, suspensionsRes, etapes, visites] = await Promise.all([
      db.from('routing_quota_canal').select('canal, jour_semaine, quota'),
      db.from('routing_template_exception')
        .select('template_id, pdv_id, date_debut, date_fin')
        .in('template_id', idsRegles)
        .is('pdv_id', null)
        .lte('date_debut', fin)
        .gte('date_fin', debut),
      // Étapes des tournées de la plage (hors tournées annulées).
      fetchAllRows<any>((from, to) => db.from('routing_pdv')
        .select('id, pdv_id, status, routing:routing_id!inner(date_routing, user_id, status), pdv:pdv_id(sous_categorie_pdv)')
        .eq('routing.user_id', userId)
        .gte('routing.date_routing', debut)
        .lte('routing.date_routing', fin)
        .neq('routing.status', 'cancelled')
        .order('id')
        .range(from, to)),
      // Visites de la plage, mêmes bornes que etapes_quota_du_jour
      // (date_visite >= début, < fin + 1 jour), sur l'heure locale.
      fetchAllRows<any>((from, to) => db.from('visites')
        .select('id, pdv_id, pdv:pdv_id(sous_categorie_pdv)')
        .eq('user_id', userId)
        .gte('date_visite', debutJourLocal(debut))
        .lt('date_visite', debutJourLocal(fin, 1))
        .order('id')
        .range(from, to)),
    ])
    if (grilleRes.error) throw grilleRes.error
    if (suspensionsRes.error) throw suspensionsRes.error

    const { parCanal: objectif, joursActifs } = objectifsParCanal(
      (grilleRes.data || []) as QuotaCanal[],
      regles as RegleQuota[],
      debut,
      fin,
      (suspensionsRes.data || []) as SuspensionRegle[],
    )

    const ligne = (r: any) => ({ pdv_id: r.pdv_id as string, sous_categorie_pdv: r.pdv?.sous_categorie_pdv as string | null | undefined })
    const planifie = pdvDistinctsParCanal(etapes.map(ligne))
    // Réalisé : PDV visités OU étapes marquées « fait » (une étape terminée
    // directement, sans formulaire de visite, compte aussi). Distincts.
    const realise = pdvDistinctsParCanal([
      ...visites.map(ligne),
      ...etapes.filter(e => e.status === 'completed').map(ligne),
    ])

    const resultat: ObjectifsAtom = { estQuota: true, joursActifs, objectif, planifie, realise }
    cache.set(`${userId}:${debut}:${fin}`, resultat)
    return resultat
  }

  return { chargerObjectifs, enCache }
}
