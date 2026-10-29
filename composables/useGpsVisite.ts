// composables/useGpsVisite.ts
// GPS obligatoire (1.0.17) : « Démarrer » dans la tournée, l'ouverture et
// l'enregistrement du formulaire de visite, la création d'un PDV attendent
// une position assez précise (Paramètres terrain › « Précision GPS exigée »).
// Une seule recherche à la fois, partagée par tous les écrans : un
// double appui sur « Démarrer » attend la même. Pendant la recherche, l'écran
// GpsVisiteOverlay (monté dans app.vue) affiche « Recherche de la position…
// (précision actuelle : X m) » ; en cas d'échec, l'aide du cas A, B ou C
// (components/AideGpsTablette.vue) avec « Réessayer ». Règles pures :
// utils/gpsVisite.ts.
import { causeBlocageGps, codeErreurGps, etatRecherche, type CauseBlocageGps, type PermissionGps } from '~/utils/gpsVisite'
import type { GeoError } from '~/composables/useGeoProvider'

export interface PositionVisite {
  lat: number
  lng: number
  accuracy: number
}

export type EtatGpsVisite =
  | { phase: 'ferme' }
  | { phase: 'recherche', precision: number | null, max: number }
  | { phase: 'aide', cause: CauseBlocageGps, precision: number | null, max: number }

type Resultat = { position: PositionVisite } | { cause: CauseBlocageGps, precision: number | null }

/** Temps laissé à la tablette pour trouver une position assez précise. */
export const DUREE_RECHERCHE_MS = 20_000

const etat = ref<EtatGpsVisite>({ phase: 'ferme' })
const dernierePosition = ref<(PositionVisite & { le: number }) | null>(null)
let demande: Promise<PositionVisite | null> | null = null
let finDemande: ((position: PositionVisite | null) => void) | null = null
let arreterRecherche: (() => void) | null = null
// Une recherche fermée puis relancée : l'ancienne ne doit plus rien écrire.
let generation = 0
// Écran qui attend la position : en changer arrête la recherche (GpsVisiteOverlay).
const cheminDemande = ref('')

export function useGpsVisite() {
  const geo = useGeoProvider()
  const { parametres } = useParametresApp()
  const router = useRouter()

  /** Autorisation : vérifier, puis demander (y compris pour passer d'« approximative » à « exacte »). */
  async function autorisation(): Promise<{ permission: PermissionGps } | { cause: CauseBlocageGps }> {
    let { permission, erreur } = await geo.etatPermission(false)
    if (codeErreurGps(erreur) === 2) return { cause: 'desactive' }
    if (geo.isNative && permission?.location !== 'granted') {
      ({ permission, erreur } = await geo.etatPermission(true))
      if (permission?.location !== 'granted') {
        return { cause: causeBlocageGps(erreur || { code: 1 }, permission) }
      }
    }
    // Web : le navigateur pose la question au premier relevé ; refusé d'avance → cas B.
    if (permission?.location === 'denied') return { cause: 'permission' }
    return { permission }
  }

  /** Suit la position jusqu'à la précision demandée, au plus DUREE_RECHERCHE_MS. */
  function suivre(max: number, permission: PermissionGps): Promise<Resultat> {
    return new Promise((resolve) => {
      let meilleure: PositionVisite | null = null
      let derniereErreur: GeoError | null = null
      let fini = false
      let nettoyer: (() => void) | null = null
      const finir = (r: Resultat) => {
        if (fini) return
        fini = true
        clearTimeout(minuteur)
        nettoyer?.()
        arreterRecherche = null
        resolve(r)
      }
      const echec = () => ({ cause: causeBlocageGps(derniereErreur, permission), precision: meilleure ? Math.round(meilleure.accuracy) : null })
      const minuteur = setTimeout(() => finir(echec()), DUREE_RECHERCHE_MS)
      arreterRecherche = () => finir(echec())

      void geo.watchPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }
          if (!meilleure || p.accuracy < meilleure.accuracy) meilleure = p
          if (etat.value.phase === 'recherche') etat.value = { ...etat.value, precision: Math.round(meilleure.accuracy) }
          if (etatRecherche(p.accuracy, max) === 'ok') finir({ position: p })
        },
        (err) => {
          derniereErreur = err
          // Refusé ou coupé : inutile d'attendre. Délai (3) : on laisse courir les 20 s.
          if (err.code === 1 || err.code === 2) finir(echec())
        },
        { enableHighAccuracy: true, timeout: DUREE_RECHERCHE_MS, maximumAge: 0 },
      ).then((stop) => {
        if (fini) stop()
        else nettoyer = stop
      })
    })
  }

  async function chercher(max: number): Promise<Resultat> {
    const auto = await autorisation()
    if ('cause' in auto) return { cause: auto.cause, precision: null }
    return suivre(max, auto.permission)
  }

  async function lancer() {
    const max = parametres.value.gps_precision_min_m
    const tour = ++generation
    etat.value = { phase: 'recherche', precision: null, max }
    const r = await chercher(max)
    if (tour !== generation || !demande) return // fermé ou relancé pendant la recherche
    if ('position' in r) {
      dernierePosition.value = { ...r.position, le: Date.now() }
      terminer(r.position)
    }
    else {
      etat.value = { phase: 'aide', cause: r.cause, precision: r.precision, max }
    }
  }

  function terminer(position: PositionVisite | null) {
    etat.value = { phase: 'ferme' }
    const fin = finDemande
    demande = null
    finDemande = null
    fin?.(position)
  }

  /**
   * Position fraîche et assez précise, ou null si l'agent ferme l'aide sans
   * l'avoir obtenue. Ne rejette jamais : l'écran d'aide dit la cause.
   */
  function exigerPosition(): Promise<PositionVisite | null> {
    if (demande) return demande
    cheminDemande.value = router.currentRoute.value.path
    demande = new Promise((resolve) => { finDemande = resolve })
    void lancer()
    return demande
  }

  function reessayer() {
    if (etat.value.phase === 'aide') void lancer()
  }

  function fermer() {
    arreterRecherche?.()
    terminer(null)
  }

  /** Dernière position acceptée, si elle a moins de `ageMaxMs` (PDV le plus proche…). */
  function positionRecente(ageMaxMs = 120_000): PositionVisite | null {
    const p = dernierePosition.value
    return p && Date.now() - p.le <= ageMaxMs ? { lat: p.lat, lng: p.lng, accuracy: p.accuracy } : null
  }

  return {
    etat: readonly(etat),
    cheminDemande: readonly(cheminDemande),
    exigerPosition,
    reessayer,
    fermer,
    positionRecente,
  }
}
