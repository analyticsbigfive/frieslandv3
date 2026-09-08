// composables/usePushNotifications.ts
// Notifications push des actions assignées (Android, via FCM).
//
// L'app prévient déjà en direct quand elle est ouverte (Realtime + toast dans
// layouts/mobile.vue). Le push couvre le cas du terrain : téléphone en poche,
// app fermée. Le merchandiseur reçoit la notification sur son écran de veille.
//
// Rien ne part tant que le client n'a pas fourni son projet Firebase : sans
// google-services.json, l'enregistrement échoue silencieusement et l'app
// fonctionne exactement comme avant (voir docs/PUSH-NOTIFICATIONS.md).
import { Capacitor } from '@capacitor/core'

// Doit correspondre au `channel_id` envoyé par la fonction Edge notifier-action.
const CANAL = 'actions'

export function usePushNotifications() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const router = useRouter()
  const toast = useToast()

  let initialise = false

  async function enregistrerJeton(jeton: string) {
    if (!user.value?.id) return
    const { error } = await (supabase.from('appareil_push') as any).upsert({
      jeton,
      user_id: user.value.id,
      plateforme: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
      modele: navigator.userAgent.slice(0, 120),
      vu_le: new Date().toISOString(),
    }, { onConflict: 'jeton' })
    // Hors ligne ou table absente : on ne bloque pas l'app, le jeton sera
    // réenregistré au prochain démarrage (FCM le redonne à chaque lancement).
    if (error) console.warn('Push : jeton non enregistré', error.message)
  }

  async function initialiser() {
    if (initialise || !Capacitor.isNativePlatform()) return
    if (!Capacitor.isPluginAvailable('PushNotifications')) return
    initialise = true

    const { PushNotifications } = await import('@capacitor/push-notifications')

    // Android 13+ : la permission de notifier se demande à l'exécution.
    let permission = await PushNotifications.checkPermissions()
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions()
    }
    if (permission.receive !== 'granted') return

    // Canal dédié : sans lui, Android range la notification dans le canal par
    // défaut, que l'utilisateur peut avoir coupé pour toute l'app.
    if (Capacitor.getPlatform() === 'android') {
      await PushNotifications.createChannel({
        id: CANAL,
        name: 'Actions à réaliser',
        description: 'Actions que votre commercial vous assigne.',
        importance: 4,
        visibility: 1,
      }).catch(() => {})
    }

    await PushNotifications.addListener('registration', (t) => { void enregistrerJeton(t.value) })
    await PushNotifications.addListener('registrationError', (e) => {
      // Cas normal tant que google-services.json n'est pas en place.
      console.warn('Push : enregistrement impossible', e)
    })

    // App au premier plan : Android n'affiche pas la notification système, on
    // reprend le même toast que la notification Realtime.
    await PushNotifications.addListener('pushNotificationReceived', (n) => {
      toast.add({
        title: n.title || 'Nouvelle action à réaliser',
        description: n.body || 'Une action vient de vous être assignée.',
        icon: 'i-heroicons-clipboard-document-check',
        color: 'orange',
      })
    })

    // Appui sur la notification : on ouvre la liste des actions. Il n'existe
    // pas d'écran par action ; le filtre « ouvertes » est celui par défaut.
    await PushNotifications.addListener('pushNotificationActionPerformed', () => {
      void router.push('/mobile/actions')
    })

    await PushNotifications.register()
  }

  async function retirerAppareil() {
    if (!Capacitor.isNativePlatform() || !user.value?.id) return
    // À la déconnexion : ce téléphone ne doit plus recevoir les actions de la
    // personne qui s'en va. La RLS limite déjà la suppression à ses propres lignes.
    await supabase.from('appareil_push').delete().eq('user_id', user.value.id)
  }

  return { initialiser, retirerAppareil }
}
