import { axesPour } from '~/utils/chartPalette'

/**
 * Axes, grille et info-bulle des graphiques selon le thème (clair ou sombre).
 * Réactif : les options Chart.js qui le lisent dans un computed se recalculent
 * quand l'utilisateur bascule le mode sombre.
 */
export function useAxesGraphique() {
  const colorMode = useColorMode()
  return computed(() => axesPour(colorMode.value === 'dark'))
}
