<template>
  <UModal v-model="isOpen" :ui="{ width: 'max-w-lg' }">
    <div class="p-6">
      <div class="mb-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Nouveau PDV</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Créez un point de vente et utilisez-le immédiatement pour une visite.
        </p>
      </div>

      <!-- 1.0.17 : PDV déjà là ? Les voisins à moins de « Rayon des doublons », avec leur devanture. -->
      <div v-if="etape === 'doublons'" class="space-y-4">
        <div>
          <h4 class="text-base font-bold text-gray-900 dark:text-gray-100">Ce point de vente existe peut-être déjà</h4>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {{ voisins.length === 1 ? 'Un point de vente est enregistré' : `${voisins.length} points de vente sont enregistrés` }}
            à moins de {{ parametres.doublon_rayon_m }} m. Comparez les devantures.
          </p>
        </div>
        <div v-if="photoApercu" class="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-700/50">
          <img :src="photoApercu" alt="Votre photo de la devanture" class="h-16 w-16 shrink-0 rounded-lg object-cover">
          <p class="text-sm text-gray-700 dark:text-gray-200"><strong>Votre photo</strong> · {{ form.nom_pdv }}</p>
        </div>
        <ul class="space-y-2">
          <li v-for="(v, i) in voisins" :key="v.pdv_id || `autre-${i}`" class="flex gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-600">
            <img v-if="v.image_url" :src="v.image_url" :alt="`Devanture de ${v.nom_pdv || 'ce point de vente'}`" class="h-20 w-20 shrink-0 rounded-lg object-cover" loading="lazy">
            <div v-else class="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-center text-[11px] text-gray-500 dark:bg-gray-700 dark:text-gray-400">Pas de photo</div>
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold text-gray-900 dark:text-gray-100">
                {{ v.dans_perimetre === false ? 'Point de vente d\'un autre secteur' : (v.nom_pdv || 'Point de vente sans nom') }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ v.distance_m != null ? `à ${v.distance_m} m` : `à moins de ${parametres.doublon_rayon_m} m` }}{{ v.quartier ? ` · ${v.quartier}` : '' }}
              </p>
              <UButton size="sm" variant="soft" class="mt-2" icon="i-heroicons-check" @click="choisirExistant(v)">C'est ce PDV</UButton>
            </div>
          </li>
        </ul>
        <div v-if="voisinProche" class="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p class="text-sm font-semibold text-amber-900 dark:text-amber-100">
            « {{ voisinProche.nom_pdv }} », à {{ voisinProche.distance_m }} m, porte presque le même nom.
          </p>
          <UCheckbox v-model="confirmeNouveau" class="mt-2" label="Je confirme que c'est un autre point de vente." />
        </div>
        <div class="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <UButton type="button" variant="ghost" @click="etape = 'saisie'">Revenir</UButton>
          <UButton type="button" class="bg-fc-blue justify-center" :loading="saving" :disabled="!!voisinProche && !confirmeNouveau" @click="creer">
            C'est un nouveau PDV
          </UButton>
        </div>
      </div>

      <form v-else class="space-y-4" @submit.prevent="handleSave">
        <UFormGroup label="Nom du PDV" required>
          <UInput
            v-model="form.nom_pdv"
            placeholder="Nom du point de vente"
            size="lg"
          />
        </UFormGroup>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormGroup label="Canal" help="Déduit de la catégorie choisie">
            <UInput :model-value="derivedCanal" disabled />
          </UFormGroup>

          <UFormGroup label="Catégorie">
            <USelectMenu
              v-model="form.categorie_pdv"
              :options="categorieOptions"
              value-attribute="value"
              option-attribute="label"
              searchable
              placeholder="Catégorie..."
              @update:model-value="onCategorieChange"
            />
          </UFormGroup>

          <UFormGroup label="Sous-catégorie">
            <USelectMenu
              v-model="form.sous_categorie_pdv"
              :options="sousCategorieOptions"
              value-attribute="value"
              option-attribute="label"
              :disabled="!form.categorie_pdv"
              searchable
              placeholder="Type de PDV..."
            />
          </UFormGroup>

          <UFormGroup label="Quartier" :required="quartierOptions.length > 0">
            <USelectMenu
              v-if="quartierOptions.length > 0"
              v-model="form.quartier"
              :options="quartierOptionsGroupees"
              value-attribute="value"
              option-attribute="label"
              searchable
              searchable-placeholder="Rechercher un quartier…"
              placeholder="Choisir un quartier"
            >
              <template #option="{ option }">
                <span class="flex min-w-0 items-center gap-2">
                  <span class="truncate">{{ option.value }}</span>
                  <span class="ml-auto shrink-0 text-[10px] uppercase text-gray-400">{{ option.territoire }}</span>
                </span>
              </template>
            </USelectMenu>
            <UInput
              v-else
              v-model="form.quartier"
              placeholder="Quartier"
            />
          </UFormGroup>

          <UFormGroup label="Zone" required>
            <UInput
              v-model="form.zone"
              :disabled="isMerchandiser && !!defaultZone"
              placeholder="Zone"
            />
          </UFormGroup>

          <UFormGroup label="Région" required>
            <UInput
              v-model="form.region"
              :disabled="isMerchandiser && !!defaultRegion"
              placeholder="Région"
            />
          </UFormGroup>

          <UFormGroup label="Distributeur" hint="Nationaux + liés au territoire" class="sm:col-span-2">
            <USelectMenu
              v-model="form.distributor_name"
              :options="distributorOptions"
              option-attribute="label"
              value-attribute="value"
              placeholder="Distributeur..."
              searchable
              searchable-placeholder="Rechercher..."
            />
          </UFormGroup>
        </div>

        <UFormGroup label="Adressage">
          <UInput
            v-model="form.adressage"
            placeholder="Adresse ou repère"
          />
        </UFormGroup>

        <div class="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-medium text-gray-800 dark:text-gray-100">Coordonnées GPS</p>
              <p v-if="hasCoordinates" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {{ form.geolocation_lat?.toFixed(6) }}, {{ form.geolocation_lng?.toFixed(6) }}
                <span v-if="form.gps_precision_m != null">· précision {{ form.gps_precision_m }} m</span>
              </p>
              <p v-else class="text-xs font-medium text-amber-700 dark:text-amber-300 mt-1">
                Position obligatoire : placez-vous devant le point de vente.
              </p>
            </div>

            <UButton
              type="button"
              size="sm"
              variant="outline"
              :loading="gpsLoading"
              @click.prevent="fillWithCurrentPosition"
            >
              {{ hasCoordinates ? 'Reprendre ma position' : 'Prendre ma position' }}
            </UButton>
          </div>
        </div>

        <div class="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-medium text-gray-800 dark:text-gray-100">Photo de la devanture <span class="text-red-500">*</span></p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Obligatoire : elle permet de reconnaître le point de vente et d'éviter les doublons.</p>
            </div>
            <UButton type="button" size="sm" variant="outline" icon="i-heroicons-camera" @click.prevent="prendrePhoto">
              {{ photo ? 'Reprendre' : 'Prendre la photo' }}
            </UButton>
          </div>
          <img v-if="photoApercu" :src="photoApercu" alt="Devanture du nouveau point de vente" class="h-40 w-full rounded-lg object-cover">
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <UButton type="button" variant="ghost" @click="isOpen = false">
            Annuler
          </UButton>
          <UButton type="submit" class="bg-fc-blue" :loading="saving">
            Créer le PDV
          </UButton>
        </div>
      </form>
    </div>
  </UModal>
</template>

<script setup lang="ts">
import { grouperQuartiersParTerritoire, resoudreTerritoirePdv } from '~/utils/territoires'
import type { PDV } from '~/types'
import { voisinNomProche, voisinsDansRayon, type VoisinPdv } from '~/utils/doublonPdv'
import { estErreurReseau } from '~/utils/supabaseErrors'

const props = defineProps<{
  modelValue: boolean
  /** PDV déjà chargés par l'écran : contrôle des doublons hors ligne. */
  pdvConnus?: { pdv_id: string, nom_pdv?: string | null, quartier?: string | null, image_url?: string | null, geolocation_lat?: number | null, geolocation_lng?: number | null }[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'created', value: PDV): void
  /** « C'est ce PDV » : rien n'est créé, l'écran ouvre le PDV existant. */
  (e: 'existant', value: VoisinPdv): void
}>()

const authStore = useAuthStore()
const pdvStore = usePDVStore()
const user = useSupabaseUser()
const toast = useToast()
const { parametres } = useParametresApp()
const { isOnline, addToQueue } = useOfflineSync()
// 1.0.17 : position prise sur place, à l'ouverture, avec la précision exigée
// (plus de position gardée en mémoire) ; elle devient le repère du PDV
// (gps_source = 'creation').
const { exigerPosition } = useGpsVisite()
const supabase = useSupabaseClient()
const { compressImage, capturePhoto } = useImageUpload()

const saving = ref(false)
const gpsLoading = ref(false)

// 1.0.17 (29/10) : photo de la devanture obligatoire, et contrôle des
// doublons avant de créer (utils/doublonPdv.ts).
const photo = ref<File | null>(null)
const photoApercu = ref('')
const etape = ref<'saisie' | 'doublons'>('saisie')
const voisins = ref<VoisinPdv[]>([])
const confirmeNouveau = ref(false)
const voisinProche = computed(() => voisinNomProche(form.nom_pdv, voisins.value, parametres.value.doublon_nom_rayon_m))

const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const isMerchandiser = computed(() => authStore.profile?.role === 'merchandiser')
const defaultZone = computed(() => authStore.profile?.zone_assignee || '')
const defaultRegion = computed(() => authStore.profile?.region || '')
const quartierOptions = computed(() => authStore.profile?.quartiers_assignes?.filter(Boolean) || [])
// Groupés par territoire (utils/territoires.ts) : un merchandiser multi-
// territoires retrouve ses quartiers rangés, pas une liste plate de 50 noms.
const quartierOptionsGroupees = computed(() =>
  grouperQuartiersParTerritoire(quartierOptions.value, quartiers.value, areas.value, territories.value)
    .flatMap(g => g.quartiers.map(q => ({ value: q, label: `${q} · ${g.territoire}`, territoire: g.territoire }))),
)

// Géo Système B : zone = territoire (name), quartier = quartier.nom. L'area est
// résolue depuis le quartier choisi (quartier -> zone_id -> zone.code) ; le
// distributeur découle de cette area (zone_distributeur), repli territoire ;
// les nationaux sont toujours proposés.
const { distributeurs, territories, areas, quartiers, territoireDistributeurs, zoneDistributeurs, territoireAliases, posTypes, fetchReferentiels } = useReferentiels()

// Territoire résolu sans tenir compte de la casse (« KOUMASSI » ↔ « koumassi »)
// ni des alias, en partant du quartier choisi : sinon un profil Atom en
// MAJUSCULES n'avait aucun territoire, donc que les distributeurs nationaux.
const territoryCode = computed(() => resoudreTerritoirePdv({
  zone: form.zone,
  quartier: form.quartier,
  territoiresProfil: authStore.profile?.territoires_assignes || [],
  quartiers: quartiers.value,
  areas: areas.value,
  territoires: territories.value,
  aliases: territoireAliases.value,
}))
const scopedAreas = computed(() => areas.value.filter(a => !territoryCode.value || a.territory_code === territoryCode.value))
const selectedQuartier = computed(() => {
  const zoneIds = new Set(scopedAreas.value.map(a => a.id))
  return quartiers.value.find(q => q.nom === form.quartier && zoneIds.has(q.zone_id))
})
const selectedArea = computed(() =>
  scopedAreas.value.find(a => a.id === selectedQuartier.value?.zone_id)
  // Repli legacy : profil dont quartiers_assignes contient encore un nom d'area.
  || scopedAreas.value.find(a => a.name === form.quartier)
)

const nationalDistributors = computed(() => distributeurs.value.filter(d => d.national))
const territoryDistributors = computed(() => {
  if (!territoryCode.value) return []
  const linked = new Set(
    territoireDistributeurs.value
      .filter(td => td.territory_code === territoryCode.value)
      .map(td => td.distributor_name)
  )
  return distributeurs.value.filter(d => linked.has(d.name) && !d.national)
})
// Distributeurs rattachés à l'area sélectionnée (zone_distributeur). Permet de
// varier le distributeur d'une area à l'autre dans un même territoire.
const areaDistributors = computed(() => {
  const zid = selectedArea.value?.id
  if (!zid) return []
  const linked = new Set(
    zoneDistributeurs.value
      .filter(zd => zd.zone_id === zid)
      .map(zd => zd.distributor_name)
  )
  return distributeurs.value.filter(d => linked.has(d.name) && !d.national)
})
// Portée locale = area si elle a des distributeurs propres, sinon repli territoire.
const scopedDistributors = computed(() =>
  areaDistributors.value.length ? areaDistributors.value : territoryDistributors.value
)
const distributorOptions = computed(() => {
  const out: { value: string, label: string }[] = []
  const seen = new Set<string>()
  for (const d of [...scopedDistributors.value, ...nationalDistributors.value]) {
    if (seen.has(d.name)) continue
    seen.add(d.name)
    out.push({ value: d.name, label: d.national ? `${d.name} · national` : d.name })
  }
  if (form.distributor_name && !seen.has(form.distributor_name)) {
    out.push({ value: form.distributor_name, label: form.distributor_name })
  }
  return out
})

// Cascade Catégorie (level3 / groupe) → Sous-catégorie (level4 / type de PDV),
// lues depuis posTypes (référentiel type_pdv) → uniquement des valeurs valides.
// Le level4 pilote le scoring Perfect Store.
// Options {label: nom_fr, value: nom EN} : l'affichage est en français mais la
// valeur stockée reste le nom EN du référentiel (matching Perfect Store).
const categorieOptions = computed(() => {
  const byNom = new Map(posTypes.value.filter(p => p.level3_group).map(p => [p.level3_group, p.level3_fr]))
  return [...byNom.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
})
// Le canal se déduit de la catégorie (categorie_pdv.canal), comme dans le
// calcul Perfect Store — il n'est plus saisi pour éviter toute divergence.
const derivedCanal = computed(() => {
  const pos = posTypes.value.find(p => p.level3_group === form.categorie_pdv)
  return canalLabelFromCode((pos as any)?.canal)
})
const sousCategorieOptions = computed(() => posTypes.value
  .filter(p => !form.categorie_pdv || p.level3_group === form.categorie_pdv)
  .map(p => ({ value: p.level4_type, label: p.level4_fr })))
function onCategorieChange() {
  if (!sousCategorieOptions.value.some(o => o.value === form.sous_categorie_pdv)) {
    form.sous_categorie_pdv = ''
  }
}

const form = reactive({
  nom_pdv: '',
  categorie_pdv: '' as string,
  sous_categorie_pdv: '' as string,
  zone: '',
  quartier: '',
  region: '',
  distributor_name: '',
  adressage: '',
  geolocation_lat: null as number | null,
  geolocation_lng: null as number | null,
  gps_precision_m: null as number | null,
})

const hasCoordinates = computed(() =>
  form.geolocation_lat !== null && form.geolocation_lng !== null
)

function resetForm() {
  form.nom_pdv = ''
  form.categorie_pdv = ''
  form.sous_categorie_pdv = ''
  form.zone = defaultZone.value
  form.quartier = quartierOptions.value[0] || ''
  form.region = defaultRegion.value
  form.distributor_name = scopedDistributors.value[0]?.name || nationalDistributors.value[0]?.name || ''
  form.adressage = ''
  form.geolocation_lat = null
  form.geolocation_lng = null
  form.gps_precision_m = null
  choisirPhoto(null)
  etape.value = 'saisie'
  voisins.value = []
  confirmeNouveau.value = false
}

function choisirPhoto(fichier: File | null) {
  if (photoApercu.value) URL.revokeObjectURL(photoApercu.value)
  photo.value = fichier
  photoApercu.value = fichier ? URL.createObjectURL(fichier) : ''
}

async function prendrePhoto() {
  const fichier = await capturePhoto()
  if (fichier) choisirPhoto(fichier)
}

/** En ligne : tous les PDV proches (fonction pdv_voisins). Sinon : ceux déjà chargés. */
async function chercherVoisins(): Promise<VoisinPdv[]> {
  const position = { lat: form.geolocation_lat as number, lng: form.geolocation_lng as number }
  const rayon = parametres.value.doublon_rayon_m
  if (isOnline.value) {
    const { data, error } = await (supabase.rpc as any)('pdv_voisins', { p_lat: position.lat, p_lng: position.lng, p_rayon: rayon })
    if (!error) return ((data || []) as VoisinPdv[]).map(v => ({ ...v, distance_m: v.distance_m == null ? null : Math.round(Number(v.distance_m)) }))
    console.warn('[PDV] pdv_voisins', error.message)
  }
  return voisinsDansRayon(position, props.pdvConnus || [], rayon)
}

function choisirExistant(v: VoisinPdv) {
  emit('existant', v)
  isOpen.value = false
}

watch(() => props.modelValue, async (open) => {
  if (open) {
    // Rechargé à chaque ouverture : un distributeur ajouté entre-temps apparaît
    // sans redémarrer l'app. Hors ligne, on garde la liste déjà chargée.
    await fetchReferentiels(isOnline.value)
    resetForm()
    void fillWithCurrentPosition()
  }
})

onMounted(() => { fetchReferentiels() })

async function fillWithCurrentPosition() {
  gpsLoading.value = true

  try {
    const position = await exigerPosition()
    if (!position) return

    form.geolocation_lat = position.lat
    form.geolocation_lng = position.lng
    form.gps_precision_m = Math.round(position.accuracy)
  }
  finally {
    gpsLoading.value = false
  }
}

function buildPayload() {
  const pdvId = crypto.randomUUID().substring(0, 8)
  const creator = authStore.profile?.nom || user.value?.email || 'Utilisateur mobile'
  const timestamp = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    pdv_id: pdvId,
    nom_pdv: form.nom_pdv.trim(),
    canal: derivedCanal.value,
    categorie_pdv: form.categorie_pdv,
    sous_categorie_pdv: form.sous_categorie_pdv,
    autre_sous_categorie: null,
    region: form.region.trim(),
    zone: form.zone.trim(),
    quartier: form.quartier.trim(),
    territory_code: territoryCode.value || null,
    area_code: selectedArea.value?.code || null,
    distributor_name: form.distributor_name || null,
    geolocation_lat: form.geolocation_lat,
    geolocation_lng: form.geolocation_lng,
    gps_source: 'creation',
    gps_precision_m: form.gps_precision_m,
    gps_maj_par: user.value?.id || null,
    gps_maj_le: timestamp,
    rayon_geofence: parametres.value.geofence_rayon_m,
    adressage: form.adressage.trim() || null,
    image_url: null,
    date_creation: new Date().toISOString().slice(0, 10),
    ajoute_par: creator,
    jour_routing: null,
    position_routing: null,
    canal_routing: null,
    sales_rep_routing: null,
    mdm: null,
    is_active: true,
    created_at: timestamp,
    updated_at: timestamp,
  } as PDV
}

async function handleSave() {
  if (!form.nom_pdv.trim()) {
    toast.add({
      title: 'Nom du PDV requis',
      color: 'red',
    })
    return
  }

  if (!form.zone.trim() || !form.region.trim()) {
    toast.add({
      title: 'Zone et région requises',
      color: 'red',
    })
    return
  }

  if (!hasCoordinates.value) {
    toast.add({
      title: 'Position obligatoire',
      description: 'Appuyez sur « Prendre ma position » devant le point de vente.',
      color: 'red',
    })
    return
  }

  if (quartierOptions.value.length > 0 && !form.quartier.trim()) {
    toast.add({
      title: 'Quartier requis',
      description: 'Choisissez un quartier pour que le PDV soit rattaché à votre zone.',
      color: 'red',
    })
    return
  }

  if (!photo.value) {
    toast.add({
      title: 'Photo de la devanture obligatoire',
      description: 'Appuyez sur « Prendre la photo » face au point de vente.',
      color: 'red',
    })
    return
  }

  saving.value = true
  try {
    voisins.value = await chercherVoisins()
  }
  finally {
    saving.value = false
  }
  confirmeNouveau.value = false
  if (voisins.value.length) {
    etape.value = 'doublons'
    return
  }
  await creer()
}

async function creer() {
  if (voisinProche.value && !confirmeNouveau.value) return
  saving.value = true

  try {
    const payload = buildPayload()
    // Photo rangée sous le PDV ; son adresse se calcule sans réseau, la fiche
    // la porte dès la création (hors ligne, le fichier part dans la file).
    const chemin = `pdv/${payload.pdv_id}/devanture-${Date.now()}.jpg`
    payload.image_url = supabase.storage.from('visite-images').getPublicUrl(chemin).data.publicUrl
    const fichier = await compressImage(photo.value as File)
    let photoEnFile = !isOnline.value
    if (!photoEnFile) {
      const { error } = await supabase.storage.from('visite-images').upload(chemin, fichier, { contentType: 'image/jpeg', upsert: false })
      if (error) photoEnFile = true
    }

    let createdPDV: PDV
    let pdvEnFile = !isOnline.value
    if (!pdvEnFile) {
      try {
        createdPDV = await pdvStore.createPDV(payload) as PDV
      }
      catch (err) {
        if (!estErreurReseau(err)) throw err
        pdvEnFile = true
      }
    }
    if (pdvEnFile) {
      addToQueue({ type: 'pdv', data: payload })
      createdPDV = payload
    }
    if (photoEnFile) {
      addToQueue({ type: 'image', data: { pdvId: payload.pdv_id, path: chemin, file: fichier } })
    }

    emit('created', createdPDV!)
    isOpen.value = false

    toast.add({
      title: pdvEnFile ? 'PDV enregistré hors ligne' : 'PDV créé',
      description: pdvEnFile
        ? 'Le PDV sera synchronisé dès le retour de la connexion.'
        : photoEnFile ? 'La photo sera envoyée dès que le réseau le permettra.' : 'Le PDV est disponible immédiatement.',
      color: 'green',
    })
  }
  catch (err: any) {
    toast.add({
      title: 'Erreur de création',
      description: err.message || 'Impossible de créer le PDV.',
      color: 'red',
    })
  }
  finally {
    saving.value = false
  }
}
</script>
