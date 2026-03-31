/**
 * Découpe 004_seed_visites.sql en morceaux de CHUNK_SIZE visites
 * pour exécution dans Supabase SQL Editor
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const INPUT = join(ROOT, 'supabase', '004_seed_visites.sql');
const OUTPUT_DIR = join(ROOT, 'supabase', '004_parts');

const CHUNK_SIZE = 2000; // visites par fichier

// Lire le fichier
console.log('Lecture de 004_seed_visites.sql...');
const content = readFileSync(INPUT, 'utf-8');
const lines = content.split('\n');

// Extraire toutes les lignes SELECT
const selectLines = [];
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('SELECT import_visite_from_csv(')) {
    selectLines.push(trimmed);
  }
}

console.log(`Total visites trouvées: ${selectLines.length}`);

// Créer le répertoire de sortie
mkdirSync(OUTPUT_DIR, { recursive: true });

// Découper en morceaux
const totalParts = Math.ceil(selectLines.length / CHUNK_SIZE);
console.log(`Découpage en ${totalParts} fichiers de ${CHUNK_SIZE} visites max...\n`);

for (let i = 0; i < totalParts; i++) {
  const start = i * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, selectLines.length);
  const partNum = String(i + 1).padStart(2, '0');
  const filename = `004_part_${partNum}.sql`;
  const filepath = join(OUTPUT_DIR, filename);

  const partContent = [
    `-- ============================================================`,
    `-- 004_seed_visites - Part ${i + 1}/${totalParts}`,
    `-- Visites ${start + 1} à ${end} (sur ${selectLines.length})`,
    `-- ============================================================`,
    ``,
  ];

  // Désactiver le trigger seulement dans le premier fichier
  if (i === 0) {
    partContent.push(`-- Désactiver les triggers pour la performance`);
    partContent.push(`ALTER TABLE public.visites DISABLE TRIGGER set_updated_at_visites;`);
    partContent.push(``);
  }

  // PAS de BEGIN/COMMIT — pour que les erreurs individuelles ne bloquent pas tout
  partContent.push(``);

  // Ajouter les SELECT
  for (let j = start; j < end; j++) {
    partContent.push(selectLines[j]);
  }

  partContent.push(``);

  // Réactiver le trigger seulement dans le dernier fichier
  if (i === totalParts - 1) {
    partContent.push(`-- Réactiver les triggers`);
    partContent.push(`ALTER TABLE public.visites ENABLE TRIGGER set_updated_at_visites;`);
    partContent.push(``);
    partContent.push(`-- Vérification`);
    partContent.push(`SELECT count(*) as total_visites FROM public.visites;`);
  }

  partContent.push(``);

  writeFileSync(filepath, partContent.join('\n'), 'utf-8');

  const sizeMB = (Buffer.byteLength(partContent.join('\n'), 'utf-8') / 1024 / 1024).toFixed(1);
  console.log(`  ✅ ${filename} — visites ${start + 1}-${end} (${sizeMB} Mo)`);
}

console.log(`\n🎉 ${totalParts} fichiers créés dans supabase/004_parts/`);
console.log(`\nOrdre d'exécution dans Supabase SQL Editor:`);
for (let i = 0; i < totalParts; i++) {
  const partNum = String(i + 1).padStart(2, '0');
  console.log(`  ${i + 1}. 004_part_${partNum}.sql`);
}
