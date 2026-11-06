// composables/useFermeturePdv.ts
// « PDV fermé » (migration 20261106120000) : envoi des photos de la devanture
// puis du signalement (RPC declarer_pdv_ferme). Hors ligne, ou réseau coupé
// pendant l'envoi : photos puis signalement partent dans la file, dans cet
// ordre ; la file est rejouée dans l'ordre, les photos arrivent d'abord.
import { cheminPhotoFermeture, fermeturePrete, NOTE_ETAPE_FERMEE } from '~/utils/fermeturePdv'
import { estErreurReseau } from '~/utils/supabaseErrors'

export interface SignalementFermeture {
  pdvId: string
  routingPdvId?: string | null
  /** Photos dans l'ordre des emplacements (PHOTOS_FERMETURE). */
  photos: File[]
  commentaire?: string
}

/** 'envoye' : reçu par le serveur ; 'en_file' : partira avec le réseau ; null : abandon (pas de GPS). */
export type ResultatFermeture = 'envoye' | 'en_file' | null

// Storage renvoie 409 / « Duplicate » / « already exists » selon la version :
// le chemin est fixe, une photo déjà déposée lors d'un essai précédent compte.
function dejaPresente(error: any): boolean {
  const status = Number(error?.statusCode ?? error?.status)
  return status === 409 || /duplicate|already exists/i.test(String(error?.message || error?.error || ''))
}

export function useFermeturePdv() {
  const supabase = useSupabaseClient()
  const { compressImage } = useImageUpload()
  const { exigerPosition } = useGpsVisite()
  const { isOnline, addToQueue } = useOfflineSync()
  const routingStore = useRoutingStore()

  const envoiEnCours = ref(false)

  async function declarer(s: SignalementFermeture): Promise<ResultatFermeture> {
    if (!fermeturePrete(s.photos)) {
      throw new Error('Deux photos de la devanture sont obligatoires.')
    }
    envoiEnCours.value = true
    try {
      // Pas de position, pas de signalement (même règle que la visite).
      const position = await exigerPosition()
      if (!position) return null

      const id = crypto.randomUUID()
      const fichiers = await Promise.all(s.photos.map(f => compressImage(f)))
      const chemins = fichiers.map((_, i) => cheminPhotoFermeture(id, i + 1))
      const params = {
        p_id: id,
        p_pdv_id: s.pdvId,
        p_routing_pdv_id: s.routingPdvId || null,
        p_photos: chemins,
        p_photos_prises_le: s.photos.map(f => new Date(f.lastModified || Date.now()).toISOString()),
        p_lat: position.lat,
        p_lng: position.lng,
        p_precision: Math.round(position.accuracy),
        p_commentaire: s.commentaire?.trim() || null,
      }

      // Hors ligne : tout part dans la file. En ligne : seules les photos dont
      // l'envoi a échoué (réseau faible, délai dépassé) y partent.
      const horsLigne = !isOnline.value
      const photosEnFile: number[] = horsLigne ? fichiers.map((_, i) => i) : []
      if (!horsLigne) {
        for (const [i, fichier] of fichiers.entries()) {
          const { error } = await supabase.storage
            .from('visite-images')
            .upload(chemins[i]!, fichier, { contentType: 'image/jpeg', upsert: false })
          if (error && !dejaPresente(error)) photosEnFile.push(i)
        }
      }

      let enFile = photosEnFile.length > 0
      if (!enFile) {
        const { error } = await (supabase.rpc as any)('declarer_pdv_ferme', params)
        if (error && estErreurReseau(error)) enFile = true
        else if (error) throw error
      }

      if (enFile) {
        for (const i of photosEnFile) {
          addToQueue({ type: 'image', data: { fermetureId: id, path: chemins[i], file: fichiers[i] } })
        }
        addToQueue({ type: 'fermeture_pdv', data: params })
      }

      // L'étape de tournée est close côté serveur par declarer_pdv_ferme ;
      // ici, seulement l'écran et les compteurs.
      if (s.routingPdvId) routingStore.marquerEtapeFermeeLocalement(s.routingPdvId, NOTE_ETAPE_FERMEE)

      return enFile ? 'en_file' : 'envoye'
    }
    finally {
      envoiEnCours.value = false
    }
  }

  /** Mes signalements encore sans décision pour ce PDV (fiche PDV). */
  async function enAttentePourPdv(pdvId: string): Promise<{ id: string, declare_le: string } | null> {
    const { data, error } = await (supabase.from('pdv_fermeture') as any)
      .select('id, declare_le')
      .eq('pdv_id', pdvId)
      .is('decision', null)
      .order('declare_le', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return null
    return data || null
  }

  return { envoiEnCours, declarer, enAttentePourPdv }
}
