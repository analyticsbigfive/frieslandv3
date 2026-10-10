// plugins/session-expiree.client.ts
// Session perdue sur le back-office (/admin) : au lieu de laisser chaque bloc
// afficher « 0 » ou « aucune donnée », on prévient la personne et on la renvoie
// vers /login, qui la ramène ensuite sur la page où elle était (?redirect=).
//
// Deux sources :
// - Supabase Auth émet SIGNED_OUT sans déconnexion demandée (jeton de
//   rafraîchissement refusé, compte révoqué) ;
// - une requête est refusée faute de jeton valide (401, PGRST301, « JWT
//   expired ») : messageUtilisateur() émet EVENEMENT_SESSION_EXPIREE. On tente
//   alors un rafraîchissement : s'il réussit, la session était seulement en
//   retard et on ne fait rien.
//
// Limité aux routes /admin : l'application mobile (Capacitor) garde sa file
// d'envoi hors ligne et son propre parcours de reconnexion.
import {
  EVENEMENT_SESSION_EXPIREE,
  MOTIF_SESSION_EXPIREE,
  estDeconnexionVolontaire,
} from '~/utils/sessionExpiree'

export default defineNuxtPlugin((nuxtApp) => {
  const supabase = useSupabaseClient()
  const router = useRouter()
  let renvoiEnCours = false

  const surBackOffice = () => router.currentRoute.value.path.startsWith('/admin')

  async function renvoyerVersConnexion() {
    if (renvoiEnCours || !surBackOffice()) return
    renvoiEnCours = true
    try {
      const retour = router.currentRoute.value.fullPath
      useToast().add({
        id: 'session-expiree',
        title: 'Votre session a expiré. Reconnectez-vous.',
        icon: 'i-heroicons-lock-closed',
        color: 'amber',
        timeout: 8000,
      })
      await navigateTo({ path: '/login', query: { redirect: retour, motif: MOTIF_SESSION_EXPIREE } })
    }
    finally {
      renvoiEnCours = false
    }
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event !== 'SIGNED_OUT' || session || estDeconnexionVolontaire()) return
    // Hors du callback : supabase-js recommande de ne rien attendre dedans.
    setTimeout(() => { void nuxtApp.runWithContext(renvoyerVersConnexion) }, 0)
  })

  let verificationEnCours = false
  window.addEventListener(EVENEMENT_SESSION_EXPIREE, () => {
    if (verificationEnCours || renvoiEnCours || !surBackOffice()) return
    verificationEnCours = true
    void nuxtApp.runWithContext(async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession()
        if (!error && data.session) return
        // Réseau coupé : ce n'est pas une expiration, la bannière hors ligne le dit déjà.
        if (error?.name === 'AuthRetryableFetchError') return
        // Jeton refusé : on efface la session locale (sans appel serveur) pour
        // que /login ne renvoie pas aussitôt sur la page, puis on y va.
        const { data: courante } = await supabase.auth.getSession()
        if (courante.session) await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        await renvoyerVersConnexion()
      }
      finally {
        verificationEnCours = false
      }
    })
  })
})
