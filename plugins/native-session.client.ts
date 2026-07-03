import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const MIRROR_KEY = 'supabase-session-mirror'

// Certains OEM (HiOS/XOS, MIUI…) purgent les données de la WebView,
// dont les cookies qui portent la session Supabase. On miroite les
// tokens dans les Preferences natives et on restaure au démarrage.
export default defineNuxtPlugin(async () => {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  const supabase = useSupabaseClient()

  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      const { value } = await Preferences.get({ key: MIRROR_KEY })
      if (value) {
        const { access_token, refresh_token } = JSON.parse(value)
        await supabase.auth.setSession({ access_token, refresh_token })
      }
    }
  }
  catch {
    // Restauration impossible (tokens invalides ou hors ligne) :
    // l'utilisateur repassera par /login.
    await Preferences.remove({ key: MIRROR_KEY }).catch(() => {})
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      void Preferences.set({
        key: MIRROR_KEY,
        value: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }),
      })
    }
    else if (event === 'SIGNED_OUT') {
      void Preferences.remove({ key: MIRROR_KEY })
    }
  })
})
