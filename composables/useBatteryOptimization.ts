// composables/useBatteryOptimization.ts
import { Capacitor, registerPlugin } from '@capacitor/core'

// Pont vers BatteryOptimizationPlugin.java (plugin local du projet Android).

interface BatteryOptimizationPlugin {
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>
  requestIgnoreBatteryOptimizations(): Promise<void>
}

const BatteryOptimization = registerPlugin<BatteryOptimizationPlugin>('BatteryOptimization')

export function useBatteryOptimization() {
  const isNative = import.meta.client && Capacitor.isNativePlatform()

  async function isExempt(): Promise<boolean> {
    if (!isNative) {
      return true
    }

    try {
      const { ignoring } = await BatteryOptimization.isIgnoringBatteryOptimizations()
      return ignoring
    }
    catch {
      return true
    }
  }

  async function requestExemption() {
    if (!isNative) {
      return
    }

    await BatteryOptimization.requestIgnoreBatteryOptimizations().catch(() => {})
  }

  return { isNative, isExempt, requestExemption }
}
