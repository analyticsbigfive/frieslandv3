import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { lireManifesteApk, nomFichierApk, PACKAGE_APP } from '../utils/apkManifest'

// L'APK 1.0.10 livré est versionné dans dist-apk/ : il sert de référence.
const APK_1_0_10 = resolve(__dirname, '../dist-apk/friesland-bonnet-rouge-1.0.10-release.apk')

describe('lecture du manifeste APK', () => {
  it.skipIf(!existsSync(APK_1_0_10))('lit versionCode, versionName et package de l’APK 1.0.10', async () => {
    const m = await lireManifesteApk(new Uint8Array(readFileSync(APK_1_0_10)))
    expect(m).toEqual({ versionCode: 13, versionName: '1.0.10', package: PACKAGE_APP })
  })

  it('refuse un fichier qui n’est pas un APK', async () => {
    await expect(lireManifesteApk(new TextEncoder().encode('pas un zip'))).rejects.toThrow(/APK/)
  })

  it('nomme le fichier publié d’après la version', () => {
    expect(nomFichierApk('1.0.11')).toBe('friesland-bonnet-rouge-1.0.11.apk')
  })
})
