<template>
  <div class="space-y-5">
    <!-- Version en service -->
    <section class="admin-surface space-y-4 p-5">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Version en service (Android)</h2>
        <UButton size="xs" color="gray" variant="ghost" icon="i-heroicons-arrow-path" :loading="chargement" @click="charger">Actualiser</UButton>
      </div>
      <dl class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <dt class="text-xs font-semibold uppercase text-gray-500">Version minimale (obligatoire)</dt>
          <dd class="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{{ actuelle?.version_nom_min || '—' }}</dd>
          <dd class="text-xs text-gray-500">versionCode {{ actuelle?.version_code_min ?? '—' }}</dd>
        </div>
        <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <dt class="text-xs font-semibold uppercase text-gray-500">Dernière version publiée</dt>
          <dd class="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{{ actuelle?.version_nom_dispo || actuelle?.version_nom_min || '—' }}</dd>
          <dd class="text-xs text-gray-500">versionCode {{ actuelle?.version_code_dispo ?? actuelle?.version_code_min ?? '—' }}</dd>
        </div>
        <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <dt class="text-xs font-semibold uppercase text-gray-500">Lien de téléchargement</dt>
          <dd class="mt-1 break-all text-xs text-gray-700 dark:text-gray-300">{{ actuelle?.url_telechargement || '—' }}</dd>
        </div>
      </dl>
      <div v-if="installees.length">
        <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">Versions ouvertes par les utilisateurs</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <UBadge v-for="v in installees" :key="v.cle" :color="v.code >= (actuelle?.version_code_min || 0) ? 'green' : 'red'" variant="soft">
            {{ v.nom }} (code {{ v.code }}) : {{ v.nombre }} utilisateur(s)
          </UBadge>
        </div>
        <p class="mt-1 text-xs text-gray-500">Détail par utilisateur : onglet « Versions installées ».</p>
      </div>
    </section>

    <!-- Publication -->
    <section class="admin-surface space-y-4 p-5">
      <div>
        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Publier une nouvelle version (APK direct)</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          L’APK publié ici est celui qu’on télécharge depuis le lien ci-dessus, pour les téléphones installés sans le Play Store.
          Le Play Store se met à jour séparément, dans la Play Console (guide « Publier une mise à jour »).
        </p>
      </div>

      <UFormGroup label="Fichier APK (release signé)" help="Fichier produit par le build : friesland-bonnet-rouge-<version>-release.apk">
        <input
          ref="champFichier"
          type="file"
          accept=".apk,application/vnd.android.package-archive"
          class="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-fc-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white dark:text-gray-300"
          @change="choisir"
        >
      </UFormGroup>

      <div v-if="lecture" class="text-sm text-gray-500"><UIcon name="i-heroicons-arrow-path" class="mr-1 h-4 w-4 animate-spin" />Lecture de l’APK…</div>
      <div v-if="erreurFichier" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">{{ erreurFichier }}</div>

      <div v-if="manifeste" class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <p class="text-sm text-gray-900 dark:text-gray-100">
          Version <strong>{{ manifeste.versionName }}</strong> · versionCode <strong>{{ manifeste.versionCode }}</strong>
          · <span class="font-mono text-xs">{{ manifeste.package }}</span>
        </p>
        <ul v-if="blocages.length" class="mt-2 list-disc pl-5 text-sm text-red-600">
          <li v-for="b in blocages" :key="b">{{ b }}</li>
        </ul>
      </div>

      <div v-if="manifeste && !blocages.length" class="space-y-3">
        <UCheckbox v-model="obligatoire" name="obligatoire" label="Rendre cette version obligatoire" help="Les téléphones en version plus ancienne seront bloqués sur l’écran de mise à jour. À cocher seulement quand la version est aussi en ligne sur le Play Store." />
        <UFormGroup v-if="obligatoire" label="Message affiché sur l’écran de mise à jour" help="Facultatif.">
          <UInput v-model="message" placeholder="Une nouvelle version est disponible : installez-la pour continuer." />
        </UFormGroup>
        <UButton class="bg-fc-blue" icon="i-heroicons-cloud-arrow-up" :loading="envoi" :disabled="envoi" @click="publier">
          Publier {{ manifeste.versionName }}{{ obligatoire ? ' (obligatoire)' : '' }}
        </UButton>
        <p v-if="etape" class="text-xs text-gray-500">{{ etape }}</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { lireManifesteApk, PACKAGE_APP, type ManifesteApk } from '~/utils/apkManifest'

const supabase = useSupabaseClient()
const toast = useToast()

const actuelle = ref<any>(null)
const installees = ref<{ cle: string, nom: string, code: number, nombre: number }[]>([])
const chargement = ref(false)

const champFichier = ref<HTMLInputElement | null>(null)
const fichier = ref<File | null>(null)
const manifeste = ref<ManifesteApk | null>(null)
const lecture = ref(false)
const erreurFichier = ref('')
const obligatoire = ref(false)
const message = ref('')
const envoi = ref(false)
const etape = ref('')

const derniereCode = computed(() => Math.max(actuelle.value?.version_code_dispo || 0, actuelle.value?.version_code_min || 0))
const blocages = computed(() => {
  const m = manifeste.value
  if (!m) return []
  const out: string[] = []
  if (m.package !== PACKAGE_APP) out.push(`Ce n’est pas l’app Bonnet Rouge (package ${m.package}).`)
  if (!m.versionName || !/^\d+\.\d+\.\d+$/.test(m.versionName)) out.push(`Version « ${m.versionName} » illisible.`)
  if (!Number.isInteger(m.versionCode)) out.push('versionCode illisible.')
  else if (m.versionCode <= derniereCode.value) out.push(`Le versionCode ${m.versionCode} n’est pas supérieur à la dernière version publiée (${derniereCode.value}) : incrémentez versionCode avant le build.`)
  return out
})

async function charger() {
  chargement.value = true
  try {
    let { data, error } = await (supabase.from('version_app') as any).select('*').eq('plateforme', 'android').maybeSingle()
    if (error) throw error
    actuelle.value = data
    const { data: vues } = await (supabase.from('version_installee') as any).select('version_code, version_nom').eq('plateforme', 'android')
    const parVersion = new Map<string, { cle: string, nom: string, code: number, nombre: number }>()
    for (const v of (vues || []) as any[]) {
      const cle = `${v.version_code}`
      if (!parVersion.has(cle)) parVersion.set(cle, { cle, nom: v.version_nom || '?', code: v.version_code, nombre: 0 })
      parVersion.get(cle)!.nombre++
    }
    installees.value = [...parVersion.values()].sort((a, b) => b.code - a.code)
  }
  catch (e: any) {
    toast.add({ title: 'Version indisponible', description: e.message, color: 'red' })
  }
  finally {
    chargement.value = false
  }
}

async function choisir(event: Event) {
  const f = (event.target as HTMLInputElement).files?.[0] || null
  fichier.value = f
  manifeste.value = null
  erreurFichier.value = ''
  etape.value = ''
  if (!f) return
  lecture.value = true
  try {
    manifeste.value = await lireManifesteApk(f)
  }
  catch (e: any) {
    erreurFichier.value = e.message
  }
  finally {
    lecture.value = false
  }
}

const messageErreur = (e: any) => e?.data?.statusMessage || e?.data?.message || e?.message || 'Erreur inconnue'

async function publier() {
  const m = manifeste.value
  if (!fichier.value || !m || blocages.value.length) return
  if (obligatoire.value && !confirm(`Rendre la version ${m.versionName} obligatoire ? Les téléphones en version plus ancienne seront bloqués jusqu’à la mise à jour.`)) return
  envoi.value = true
  try {
    etape.value = '1/3 — Préparation de l’envoi…'
    const { chemin, jeton } = await $fetch<{ chemin: string, jeton: string }>('/api/admin/apk/url-envoi', {
      method: 'POST', body: { versionName: m.versionName, versionCode: m.versionCode },
    })
    etape.value = `2/3 — Envoi de l’APK (${(fichier.value.size / 1e6).toFixed(1)} Mo)…`
    const { error } = await supabase.storage.from('apk').uploadToSignedUrl(chemin, jeton, fichier.value, {
      contentType: 'application/vnd.android.package-archive', cacheControl: '60',
    })
    if (error) throw error
    etape.value = '3/3 — Vérification du fichier et publication…'
    const res = await $fetch<{ url: string }>('/api/admin/apk/publier', {
      method: 'POST', body: { versionName: m.versionName, versionCode: m.versionCode, obligatoire: obligatoire.value, message: message.value },
    })
    etape.value = `Publiée : ${res.url}`
    toast.add({
      title: `Version ${m.versionName} publiée`,
      description: obligatoire.value ? 'Elle est obligatoire : les anciennes versions sont bloquées.' : 'Les téléphones 1.0.11+ proposent la mise à jour sans bloquer.',
      color: 'green',
    })
    fichier.value = null
    manifeste.value = null
    obligatoire.value = false
    message.value = ''
    if (champFichier.value) champFichier.value.value = ''
    await charger()
  }
  catch (e: any) {
    etape.value = ''
    toast.add({ title: 'Publication impossible', description: messageErreur(e), color: 'red' })
  }
  finally {
    envoi.value = false
  }
}

onMounted(charger)
</script>
