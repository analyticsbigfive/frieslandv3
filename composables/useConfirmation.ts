// composables/useConfirmation.ts
// Remplace window.confirm() par la fenêtre AdminConfirmation, sans changer la
// logique de l'appelant : `if (!(await demanderConfirmation({...}))) return`.
//
//   const { confirmation, demanderConfirmation, confirmer, annuler } = useConfirmation()
//   <AdminConfirmation v-bind="confirmation" @confirmer="confirmer" @annuler="annuler" />

export interface DemandeConfirmation {
  /** Question qui nomme l'élément : « Supprimer la visite chez « X » ? » */
  titre: string
  /** Conséquence en clair. */
  message: string
  /** Verbe du bouton, répété depuis le titre : « Supprimer la visite ». */
  libelleAction: string
  /** Faux pour une action non destructive (appliquer, recalculer). */
  destructif?: boolean
  /** Bouton de renoncement, « Annuler » par défaut. */
  libelleRetour?: string
}

export function useConfirmation() {
  const confirmation = reactive({
    ouvert: false,
    titre: '',
    message: '',
    libelleAction: '',
    libelleRetour: 'Annuler',
    destructif: true,
  })
  let resoudre: ((ok: boolean) => void) | null = null

  function repondre(ok: boolean) {
    confirmation.ouvert = false
    const r = resoudre
    resoudre = null
    r?.(ok)
  }

  function demanderConfirmation(demande: DemandeConfirmation): Promise<boolean> {
    // Une demande encore ouverte vaut refus.
    repondre(false)
    Object.assign(confirmation, { destructif: true, libelleRetour: 'Annuler', ...demande, ouvert: true })
    return new Promise<boolean>((r) => { resoudre = r })
  }

  return {
    confirmation,
    demanderConfirmation,
    confirmer: () => repondre(true),
    annuler: () => repondre(false),
  }
}
