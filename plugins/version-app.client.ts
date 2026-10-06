import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

// Mise à jour obligatoire de l'app mobile (table version_app, migration
// 20260930091000). En dessous de version_code_min (versionCode Android),
// components/MiseAJourObligatoire.vue bloque l'app et renvoie vers le
// téléchargement. Vérifié au lancement et à chaque retour au premier plan.
//
// Au passage, la version ouverte est déclarée dans version_installee : l'admin
// voit qui a mis à jour avant de relever la version minimale.
//
// Version publiée plus récente mais pas encore obligatoire (version_code_dispo,
// renseignée par Référentiels › Publier une version) : bandeau discret
// « nouvelle version disponible » (components/MiseAJourObligatoire.vue).
//
// Hors ligne ou table absente : on ne bloque jamais.
export interface EtatMiseAJour {
  requise: boolean
  disponible?: boolean
  versionDispo?: string | null
  url: string | null
  message: string | null
  versionMin: string | null
  versionInstallee: string | null
}

export default defineNuxtPlugin(() => {
  if (!Capacitor.isNativePlatform()) return

  const etat = useState<EtatMiseAJour>('mise-a-jour-app', () => ({
    requise: false, url: null, message: null, versionMin: null, versionInstallee: null,
  }))
  const supabase = useSupabaseClient()
  const utilisateur = useSupabaseUser()
  const plateforme = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'

  async function infoApp() {
    const info = await App.getInfo()
    return { code: Number(info.build), nom: info.version }
  }

  async function verifier() {
    try {
      const { code, nom } = await infoApp()
      if (!Number.isFinite(code)) return
      const colonnes = 'version_code_min, version_nom_min, url_telechargement, message'
      let { data, error } = await (supabase.from('version_app') as any)
        .select(`${colonnes}, version_code_dispo, version_nom_dispo`)
        .eq('plateforme', plateforme)
        .maybeSingle()
      if (error) {
        // Base sans la version disponible (migration 20261007120000 non appliquée).
        ({ data, error } = await (supabase.from('version_app') as any)
          .select(colonnes).eq('plateforme', plateforme).maybeSingle())
      }
      if (error || !data) return
      const requise = code < data.version_code_min
      etat.value = {
        requise,
        disponible: !requise && Number.isFinite(data.version_code_dispo) && code < data.version_code_dispo,
        versionDispo: data.version_nom_dispo || null,
        url: data.url_telechargement,
        message: data.message,
        versionMin: data.version_nom_min,
        versionInstallee: nom,
      }
    }
    catch {
      // Hors ligne : l'app reste utilisable.
    }
  }

  async function declarerVersion() {
    if (!utilisateur.value?.id) return
    try {
      const { code, nom } = await infoApp()
      if (!Number.isFinite(code)) return
      await (supabase.from('version_installee') as any).upsert({
        user_id: utilisateur.value.id,
        plateforme,
        version_code: code,
        version_nom: nom,
        vu_le: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    }
    catch {
      // Sans réseau : redéclarée au prochain lancement.
    }
  }

  void verifier()
  void declarerVersion()
  watch(utilisateur, (u) => { if (u?.id) void declarerVersion() })
  void App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void verifier()
  })
})
