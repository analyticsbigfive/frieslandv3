// utils/apkManifest.ts
// Lit versionCode, versionName et package dans un APK Android, sans outil
// externe : l'APK est une archive zip dont AndroidManifest.xml est stocké en
// XML binaire (format AXML). Sert à Référentiels › Publier une version, côté
// navigateur (contrôle avant envoi) ET côté serveur (contrôle du fichier
// réellement déposé avant de toucher à la version minimale).
import JSZip from 'jszip'

export interface ManifesteApk {
  versionCode: number
  versionName: string | null
  package: string | null
}

const RES_STRING_POOL_TYPE = 0x0001
const RES_XML_TYPE = 0x0003
const RES_XML_RESOURCE_MAP_TYPE = 0x0180
const RES_XML_START_ELEMENT_TYPE = 0x0102
const TYPE_STRING = 0x03
const TYPE_INT_DEC = 0x10
const TYPE_INT_HEX = 0x11
// Identifiants de ressource android:versionCode / android:versionName.
const ATTR_VERSION_CODE = 0x0101021B
const ATTR_VERSION_NAME = 0x0101021C
const FLAG_UTF8 = 0x100

function lirePoolDeChaines(dv: DataView, u8: Uint8Array, debut: number): string[] {
  const enTete = dv.getUint16(debut + 2, true)
  const nombre = dv.getUint32(debut + 8, true)
  const drapeaux = dv.getUint32(debut + 16, true)
  const debutChaines = dv.getUint32(debut + 20, true)
  const utf8 = (drapeaux & FLAG_UTF8) !== 0
  const decodeur = new TextDecoder('utf-8')
  const chaines: string[] = []
  for (let i = 0; i < nombre; i++) {
    let p = debut + debutChaines + dv.getUint32(debut + enTete + i * 4, true)
    if (utf8) {
      // Longueur en caractères puis en octets, chacune sur 1 ou 2 octets.
      if (u8[p++] & 0x80) p++
      let octets = u8[p++]
      if (octets & 0x80) octets = ((octets & 0x7F) << 8) | u8[p++]
      chaines.push(decodeur.decode(u8.subarray(p, p + octets)))
    }
    else {
      let longueur = dv.getUint16(p, true)
      p += 2
      if (longueur & 0x8000) {
        longueur = ((longueur & 0x7FFF) << 16) | dv.getUint16(p, true)
        p += 2
      }
      let s = ''
      for (let k = 0; k < longueur; k++) s += String.fromCharCode(dv.getUint16(p + k * 2, true))
      chaines.push(s)
    }
  }
  return chaines
}

/** Décode le AndroidManifest.xml binaire et renvoie les attributs de <manifest>. */
export function lireManifesteBinaire(donnees: ArrayBuffer | Uint8Array): ManifesteApk {
  const u8 = donnees instanceof Uint8Array ? donnees : new Uint8Array(donnees)
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  if (u8.byteLength < 8 || dv.getUint16(0, true) !== RES_XML_TYPE) {
    throw new Error('AndroidManifest.xml n’est pas au format binaire attendu')
  }
  let chaines: string[] = []
  const idsRessource: number[] = []
  let decalage = dv.getUint16(2, true)
  while (decalage + 8 <= u8.byteLength) {
    const type = dv.getUint16(decalage, true)
    const enTete = dv.getUint16(decalage + 2, true)
    const taille = dv.getUint32(decalage + 4, true)
    if (!taille) break
    if (type === RES_STRING_POOL_TYPE) {
      chaines = lirePoolDeChaines(dv, u8, decalage)
    }
    else if (type === RES_XML_RESOURCE_MAP_TYPE) {
      for (let i = decalage + enTete; i < decalage + taille; i += 4) idsRessource.push(dv.getUint32(i, true))
    }
    else if (type === RES_XML_START_ELEMENT_TYPE) {
      const ext = decalage + enTete
      if (chaines[dv.getUint32(ext + 4, true)] === 'manifest') {
        const debutAttributs = dv.getUint16(ext + 8, true)
        const tailleAttribut = dv.getUint16(ext + 10, true)
        const nombreAttributs = dv.getUint16(ext + 12, true)
        const resultat: ManifesteApk = { versionCode: Number.NaN, versionName: null, package: null }
        for (let k = 0; k < nombreAttributs; k++) {
          const a = ext + debutAttributs + k * tailleAttribut
          const indexNom = dv.getUint32(a + 4, true)
          const brut = dv.getUint32(a + 8, true)
          const typeDonnee = dv.getUint8(a + 15)
          const donnee = dv.getUint32(a + 16, true)
          const nom = chaines[indexNom] || ''
          const id = idsRessource[indexNom]
          const texte = () => (brut !== 0xFFFFFFFF ? chaines[brut] : typeDonnee === TYPE_STRING ? chaines[donnee] : String(donnee)) ?? null
          if (nom === 'versionCode' || id === ATTR_VERSION_CODE) {
            resultat.versionCode = typeDonnee === TYPE_INT_DEC || typeDonnee === TYPE_INT_HEX ? donnee : Number(texte())
          }
          else if (nom === 'versionName' || id === ATTR_VERSION_NAME) {
            resultat.versionName = texte()
          }
          else if (nom === 'package') {
            resultat.package = texte()
          }
        }
        return resultat
      }
    }
    decalage += taille
  }
  throw new Error('Balise <manifest> introuvable dans AndroidManifest.xml')
}

/** Lit le manifeste d'un APK (fichier choisi dans le navigateur, ou contenu téléchargé côté serveur). */
export async function lireManifesteApk(fichier: Blob | ArrayBuffer | Uint8Array): Promise<ManifesteApk> {
  const contenu = typeof Blob !== 'undefined' && fichier instanceof Blob ? await fichier.arrayBuffer() : fichier
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(contenu as ArrayBuffer | Uint8Array)
  }
  catch {
    throw new Error('Ce fichier n’est pas un APK lisible (archive invalide)')
  }
  const entree = zip.file('AndroidManifest.xml')
  if (!entree) throw new Error('Ce fichier n’est pas un APK (AndroidManifest.xml absent)')
  return lireManifesteBinaire(await entree.async('uint8array'))
}

/** Nom du fichier publié pour une version : friesland-bonnet-rouge-1.0.11.apk */
export const nomFichierApk = (versionName: string) => `friesland-bonnet-rouge-${versionName}.apk`
export const NOM_APK_LATEST = 'friesland-bonnet-rouge-latest.apk'
export const PACKAGE_APP = 'com.bdco.bonnetrouge'
