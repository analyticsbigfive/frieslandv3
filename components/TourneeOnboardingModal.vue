<template>
  <UModal v-model="isOpen">
    <div class="p-5 space-y-4">
      <div>
        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Activer le suivi de tournée</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Pour suivre votre tournée même écran éteint, l'application a besoin des autorisations suivantes.
        </p>
      </div>

      <!-- Étape 1 : localisation -->
      <div class="flex items-start gap-3">
        <UIcon
          :name="locationGranted ? 'i-heroicons-check-circle-solid' : 'i-heroicons-map-pin'"
          class="mt-0.5 w-6 h-6 shrink-0"
          :class="locationGranted ? 'text-emerald-500' : 'text-gray-400'"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">1. Autoriser la localisation</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">Nécessaire pour capter votre position pendant la tournée.</p>
          <UButton
            v-if="!locationGranted"
            size="xs"
            color="red"
            variant="soft"
            class="mt-2"
            @click="requestLocation"
          >
            Autoriser
          </UButton>
        </div>
      </div>

      <!-- Étape 2 : localisation "tout le temps" -->
      <div class="flex items-start gap-3">
        <UIcon name="i-heroicons-clock" class="mt-0.5 w-6 h-6 shrink-0 text-gray-400" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">2. Choisir « Toujours autoriser »</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Dans les réglages de l'application, réglez la localisation sur
            <strong>« Toujours autoriser »</strong> pour que le suivi continue écran éteint.
          </p>
          <UButton size="xs" color="gray" variant="soft" class="mt-2" @click="emit('open-settings')">
            Ouvrir les réglages
          </UButton>
        </div>
      </div>

      <!-- Étape 3 : batterie -->
      <div class="flex items-start gap-3">
        <UIcon
          :name="batteryExempt ? 'i-heroicons-check-circle-solid' : 'i-heroicons-battery-50'"
          class="mt-0.5 w-6 h-6 shrink-0"
          :class="batteryExempt ? 'text-emerald-500' : 'text-gray-400'"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">3. Désactiver l'optimisation batterie</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">Empêche Android d'arrêter le suivi pour économiser la batterie.</p>
          <UButton
            v-if="!batteryExempt"
            size="xs"
            color="gray"
            variant="soft"
            class="mt-2"
            @click="requestBattery"
          >
            Désactiver pour cette app
          </UButton>
        </div>
      </div>

      <!-- Aide OEM -->
      <UAccordion
        :items="[{ label: 'Mon téléphone arrête le suivi (Tecno, Infinix, Xiaomi…)', slot: 'oem' }]"
        color="gray"
        variant="soft"
        size="sm"
      >
        <template #oem>
          <ul class="space-y-2 px-1 pb-2 text-xs text-gray-600 dark:text-gray-300">
            <li>
              <strong>Tecno / Infinix / itel (HiOS, XOS)</strong> : ouvrez <em>Phone Master</em> →
              gestion auto / nettoyage automatique → retirez Friesland de la liste, puis
              Paramètres → Batterie → autorisez le démarrage en arrière-plan.
            </li>
            <li>
              <strong>Xiaomi / Redmi (MIUI)</strong> : Paramètres → Applications → Friesland →
              activez <em>Démarrage automatique</em> et réglez Économiseur de batterie sur
              <em>« Aucune restriction »</em>. Dans les applications récentes, verrouillez
              Friesland (icône cadenas).
            </li>
            <li>
              <strong>Samsung</strong> : Paramètres → Entretien de l'appareil → Batterie →
              ajoutez Friesland aux <em>applications jamais mises en veille</em>.
            </li>
          </ul>
        </template>
      </UAccordion>

      <div class="flex justify-end gap-2 pt-1">
        <UButton color="gray" variant="ghost" @click="isOpen = false">Plus tard</UButton>
        <UButton color="red" icon="i-heroicons-play-circle" @click="emit('start')">
          Démarrer la tournée
        </UButton>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'start': []
  'open-settings': []
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const geo = useGeoProvider()
const { isExempt, requestExemption } = useBatteryOptimization()

const locationGranted = ref(false)
const batteryExempt = ref(false)

async function refreshStatus() {
  locationGranted.value = (await geo.checkPermission()) === 'granted'
  batteryExempt.value = await isExempt()
}

async function requestLocation() {
  await geo.requestPermission()
  await refreshStatus()
}

async function requestBattery() {
  await requestExemption()
  // L'utilisateur revient des réglages système : on relit l'état.
  await refreshStatus()
}

watch(() => props.modelValue, (open) => {
  if (open) {
    void refreshStatus()
  }
})
</script>
