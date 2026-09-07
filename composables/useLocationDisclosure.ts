// composables/useLocationDisclosure.ts
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

// Divulgation bien visible (Google Play, politique « Données utilisateur ») :
// l'application déclare ACCESS_BACKGROUND_LOCATION, donc AUCUNE demande de
// permission localisation ne doit apparaître avant que l'utilisateur ait lu
// et accepté, dans l'application, l'explication de la collecte (y compris en
// arrière-plan). L'acceptation est persistée ; un refus redemande la
// prochaine fois qu'une fonctionnalité a besoin de la position.

const STORAGE_KEY = 'fc-location-disclosure-accepted'

const isOpen = ref(false)
const accepted = ref<boolean | null>(null)

let pending: Promise<boolean> | null = null
let resolvePending: ((value: boolean) => void) | null = null

function isNative() {
  return import.meta.client && Capacitor.isNativePlatform()
}

async function loadAccepted(): Promise<boolean> {
  if (accepted.value !== null) {
    return accepted.value
  }
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY })
    accepted.value = value === '1'
  }
  catch {
    accepted.value = false
  }
  return accepted.value
}

export function useLocationDisclosure() {
  // Résout true si l'utilisateur a déjà accepté ou accepte maintenant,
  // false s'il refuse. Sur le web, pas de divulgation Play : toujours true.
  async function ensureDisclosure(): Promise<boolean> {
    if (!isNative()) {
      return true
    }
    if (await loadAccepted()) {
      return true
    }
    if (pending) {
      return pending
    }

    pending = new Promise<boolean>((resolve) => {
      resolvePending = resolve
      isOpen.value = true
    })

    try {
      return await pending
    }
    finally {
      pending = null
      resolvePending = null
      isOpen.value = false
    }
  }

  async function accept() {
    accepted.value = true
    await Preferences.set({ key: STORAGE_KEY, value: '1' }).catch(() => {})
    resolvePending?.(true)
  }

  function decline() {
    resolvePending?.(false)
  }

  return { isOpen, accepted, ensureDisclosure, accept, decline }
}
