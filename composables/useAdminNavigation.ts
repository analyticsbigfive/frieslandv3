// composables/useAdminNavigation.ts
// Le registre de navigation (utils/adminNavigation.ts) appliqué au compte
// connecté : domaines et onglets visibles pour son rôle et sa matrice
// d'accès, onglet courant, liens. Lu par le menu latéral, la barre d'onglets,
// le fil d'Ariane, AdminPageHeader et les liens vers d'autres écrans.
import {
  ADMIN_DOMAINS,
  ADMIN_GROUPS,
  locate,
  peutOuvrirChemin,
  peutOuvrirOnglet,
  lienEntreOnglets,
  tabHref,
  type AdminDomain,
  type AdminTab,
} from '~/utils/adminNavigation'

export function useAdminNavigation() {
  const route = useRoute()
  const authStore = useAuthStore()
  const { canAccessSection, loaded } = useAccessControl()

  const role = computed(() => authStore.profile?.role || null)

  function ouvrable(tab: AdminTab) {
    return peutOuvrirOnglet(tab, role.value, s => canAccessSection(s))
  }

  /** Onglets d'un domaine que le compte peut ouvrir. */
  function ongletsVisibles(domain: AdminDomain) {
    return domain.tabs.filter(ouvrable)
  }

  /** Domaines visibles (au moins un onglet ouvrable), groupés pour le menu. */
  const groupes = computed(() => ADMIN_GROUPS
    .map(g => ({
      ...g,
      domaines: ADMIN_DOMAINS.filter(d => d.group === g.id && ongletsVisibles(d).length > 0),
    }))
    .filter(g => g.domaines.length > 0))

  /** Domaine et onglet de la page courante. */
  const courant = computed(() => locate(route.path, route.query))

  const ongletsCourants = computed(() => (courant.value ? ongletsVisibles(courant.value.domain) : []))

  /** Lien d'un onglet, avec les filtres à conserver (famille, direction…). */
  function lienOnglet(tab: AdminTab) {
    return courant.value ? lienEntreOnglets(courant.value.domain, tab, route.query) : tabHref(tab)
  }

  /** Premier onglet ouvrable d'un domaine : là où mène l'entrée du menu. */
  function arrivee(domain: AdminDomain) {
    const tab = ongletsVisibles(domain)[0]
    return tab ? tabHref(tab) : null
  }

  /** Première page ouvrable du back-office pour ce compte (après connexion, après un refus). */
  const accueil = computed(() => {
    for (const d of ADMIN_DOMAINS) {
      const lien = arrivee(d)
      if (lien) return lien
    }
    return null
  })

  /** Le compte peut-il ouvrir ce chemin ? Pour masquer un lien plutôt que renvoyer l'utilisateur. */
  function peutOuvrir(path: string, query?: Record<string, unknown>) {
    return peutOuvrirChemin(path, query, role.value, s => canAccessSection(s))
  }

  /** Titre de la page courante : celui de l'onglet, sinon le domaine. */
  const titreCourant = computed(() => {
    const c = courant.value
    if (!c) return ''
    return c.tab?.title || (c.domain.tabs.length > 1 ? c.tab?.label : null) || c.domain.label
  })

  return {
    groupes,
    courant,
    ongletsCourants,
    ongletsVisibles,
    lienOnglet,
    arrivee,
    accueil,
    peutOuvrir,
    titreCourant,
    droitsCharges: loaded,
  }
}
