<template>
  <div class="space-y-5">
    <!-- Version en service -->
    <section class="admin-surface space-y-4 p-5" aria-labelledby="titre-version-service">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 id="titre-version-service" class="text-base font-semibold text-slate-900 dark:text-white">Version en service (Android)</h3>
        <UButton size="xs" color="gray" variant="ghost" icon="i-heroicons-arrow-path" :loading="chargement" @click="charger">Actualiser</UButton>
      </div>
      <dl class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-md bg-slate-50 p-3 dark:bg-slate-900/40">
          <dt class="text-xs font-semibold text-slate-600 dark:text-slate-300">Version minimale (obligatoire)</dt>
          <dd class="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{{ actuelle?.version_nom_min || 'Non définie' }}</dd>
          <dd v-if="actuelle?.version_code_min != null" class="text-xs tabular-nums text-slate-600 dark:text-slate-300">Numéro interne {{ actuelle.version_code_min }}</dd>
        </div>
        <div class="rounded-md bg-slate-50 p-3 dark:bg-slate-900/40">
          <dt class="text-xs font-semibold text-slate-600 dark:text-slate-300">Dernière version publiée</dt>
          <dd class="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{{ actuelle?.version_nom_dispo || actuelle?.version_nom_min || 'Aucune' }}</dd>
          <dd v-if="(actuelle?.version_code_dispo ?? actuelle?.version_code_min) != null" class="text-xs tabular-nums text-slate-600 dark:text-slate-300">Numéro interne {{ actuelle.version_code_dispo ?? actuelle.version_code_min }}</dd>
        </div>
        <div class="rounded-md bg-slate-50 p-3 dark:bg-slate-900/40">
          <dt class="text-xs font-semibold text-slate-600 dark:text-slate-300">Lien de téléchargement</dt>
          <dd class="mt-1 break-all text-xs text-slate-700 dark:text-slate-300">{{ actuelle?.url_telechargement || 'Aucun lien publié' }}</dd>
        </div>
      </dl>
      <div v-if="installees.length">
        <p class="text-sm font-semibold text-slate-900 dark:text-white">Versions ouvertes par les utilisateurs</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <UBadge v-for="v in installees" :key="v.cle" :color="v.code >= (actuelle?.version_code_min || 0) ? 'green' : 'red'" variant="soft">
            {{ v.nom }} ({{ v.code }}) : {{ v.nombre }} utilisateur{{ v.nombre > 1 ? 's' : '' }} · {{ v.code >= (actuelle?.version_code_min || 0) ? 'à jour' : 'sous le minimum' }}
          </UBadge>
        </div>
        <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Détail par utilisateur : onglet « Versions installées ».</p>
      </div>
    </section>

    <!-- Publication -->
    <section class="admin-surface space-y-4 p-5" aria-labelledby="titre-publication">
      <div>
        <h3 id="titre-publication" class="text-base font-semibold text-slate-900 dark:text-white">Fichier de la nouvelle version (APK direct)</h3>
        <p class="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          L’APK publié ici est celui qu’on télécharge depuis le lien ci-dessus, pour les téléphones installés sans le Play Store.
          Le Play Store se met à jour séparément, dans la Play Console (guide « Publier une mise à jour »).
        </p>
      </div>

      <UFormGroup label="Fichier APK (version finale signée)" help="Le fichier de la nouvelle version, nommé friesland-bonnet-rouge-<version>-release.apk.">
        <input
          ref="champFichier"
          type="file"
          accept=".apk,application/vnd.android.package-archive"
          class="block w-full rounded-md text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-solid file:border-slate-300 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-300 dark:file:border-slate-600 dark:file:bg-slate-800 dark:file:text-slate-200"
          @change="choisir"
        >
      </UFormGroup>

      <ChargementContenu v-if="lecture" variante="compact" libelle="Lecture de l’APK…" />
      <UAlert v-if="erreurFichier" color="red" variant="soft" icon="i-heroicons-exclamation-circle" title="Fichier refusé" :description="erreurFichier" />

      <div v-if="manifeste" class="rounded-md border border-slate-200 p-4 dark:border-slate-700">
        <p class="text-sm text-slate-900 dark:text-white">
          Version <strong>{{ manifeste.versionName }}</strong> · numéro interne <strong class="tabular-nums">{{ manifeste.versionCode }}</strong>
        </p>
        <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Identifiant de l’application : <span class="font-mono">{{ manifeste.package }}</span></p>
        <ul v-if="blocages.length" class="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700 dark:text-red-300">
          <li v-for="b in blocages" :key="b">{{ b }}</li>
        </ul>
      </div>

      <div v-if="manifeste && !blocages.length" class="space-y-3">
        <UCheckbox v-model="obligatoire" name="obligatoire" label="Rendre cette version obligatoire" help="Les téléphones en version plus ancienne seront bloqués sur l’écran de mise à jour. À cocher seulement quand la version est aussi en ligne sur le Play Store." />
        <UFormGroup v-if="obligatoire" label="Message affiché sur l’écran de mise à jour" help="Facultatif.">
          <UInput v-model="message" placeholder="Une nouvelle version est disponible : installez-la pour continuer." />
        </UFormGroup>
        <UButton icon="i-heroicons-cloud-arrow-up" :loading="envoi" :disabled="envoi" @click="publier">
          Publier {{ manifeste.versionName }}{{ obligatoire ? ' (obligatoire)' : '' }}
        </UButton>
        <p v-if="etape" class="text-sm text-slate-600 dark:text-slate-300" aria-live="polite">{{ etape }}</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { lireManifesteApk, PACKAGE_APP, type ManifesteApk } from '~/utils/apkManifest'
import { messageUtilisateur } from '~/utils/supabaseErrors'

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
  if (m.package !== PACKAGE_APP) out.push(`Ce fichier n’est pas l’application Bonnet Rouge (identifiant ${m.package}).`)
  if (!m.versionName || !/^\d+\.\d+\.\d+$/.test(m.versionName)) out.push(`Le nom de version « ${m.versionName} » n’est pas lisible (attendu : 1.0.12, par exemple).`)
  if (!Number.isInteger(m.versionCode)) out.push('Le numéro interne de la version n’est pas lisible.')
  else if (m.versionCode <= derniereCode.value) out.push(`Le numéro interne ${m.versionCode} n’est pas supérieur à celui de la dernière version publiée (${derniereCode.value}) : il faut un fichier compilé avec un numéro plus élevé.`)
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
    toast.add({ title: 'Version en service non chargée', description: messageUtilisateur(e), color: 'red' })
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
    console.error('[apk] lecture du manifeste', e)
    erreurFichier.value = 'Ce fichier n’est pas un APK lisible. Choisissez le fichier de la nouvelle version (extension .apk).'
  }
  finally {
    lecture.value = false
  }
}

async function publier() {
  const m = manifeste.value
  if (!fichier.value || !m || blocages.value.length) return
  if (obligatoire.value && !confirm(`Rendre la version ${m.versionName} obligatoire ? Les téléphones en version plus ancienne seront bloqués jusqu’à la mise à jour.`)) return
  envoi.value = true
  try {
    etape.value = 'Étape 1 sur 3 : préparation de l’envoi…'
    const { chemin, jeton } = await $fetch<{ chemin: string, jeton: string }>('/api/admin/apk/url-envoi', {
      method: 'POST', body: { versionName: m.versionName, versionCode: m.versionCode },
    })
    etape.value = `Étape 2 sur 3 : envoi de l’APK (${(fichier.value.size / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo)…`
    const { error } = await supabase.storage.from('apk').uploadToSignedUrl(chemin, jeton, fichier.value, {
      contentType: 'application/vnd.android.package-archive', cacheControl: '60',
    })
    if (error) throw error
    etape.value = 'Étape 3 sur 3 : vérification du fichier et publication…'
    const res = await $fetch<{ url: string }>('/api/admin/apk/publier', {
      method: 'POST', body: { versionName: m.versionName, versionCode: m.versionCode, obligatoire: obligatoire.value, message: message.value },
    })
    etape.value = `Version publiée. Lien de téléchargement : ${res.url}`
    toast.add({
      title: `Version ${m.versionName} publiée`,
      description: obligatoire.value ? 'Elle est obligatoire : les anciennes versions sont bloquées.' : 'Les téléphones en 1.0.12 ou plus récente proposent la mise à jour sans bloquer.',
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
    toast.add({ title: 'Version non publiée', description: messageUtilisateur(e), color: 'red' })
  }
  finally {
    envoi.value = false
  }
}

onMounted(charger)
</script>
