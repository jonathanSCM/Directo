// Corre, en cada arranque del contenedor, los archivos .sql de
// prisma/migrations/manual/ que todavía no se hayan aplicado a esta base de
// datos — así los ALTER TABLE de una feature nueva llegan solos con el
// deploy, sin entrar a mano a la Terminal de Coolify.
//
// Los archivos que ya estaban en el repo antes de este script se marcan
// como "ya aplicados" vía .baseline.json (fueron aplicados a mano en su
// momento) sin volver a correrlos — varios de ellos no son re-ejecutables
// (CREATE TYPE, RENAME COLUMN, etc.). Cualquier archivo .sql nuevo que se
// agregue de acá en adelante debe poder correr una sola vez; si necesita
// volver a aplicarse, usa ADD COLUMN IF NOT EXISTS / CREATE ... IF NOT
// EXISTS como todos los agregados desde add_ad_placement.sql en adelante.

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations', 'manual');
const BASELINE_FILE = path.join(MIGRATIONS_DIR, '.baseline.json');

/**
 * Prisma ejecuta cada $executeRawUnsafe como sentencia preparada, que no
 * acepta varias sentencias separadas por ";" en una sola llamada — hay que
 * partir el archivo. Reconoce bloques $$...$$ (DO $$ ... END $$;) para no
 * partir un ; que esté adentro, e ignora BEGIN/COMMIT sueltos (cada archivo
 * ya corre dentro de una transacción de Prisma).
 */
function splitStatements(sql) {
  const withoutComments = sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');

  const statements = [];
  let current = '';
  let inDollarBlock = false;

  for (const line of withoutComments.split('\n')) {
    current += line + '\n';
    const dollarMatches = line.match(/\$\$/g);
    if (dollarMatches) {
      for (let i = 0; i < dollarMatches.length; i++) inDollarBlock = !inDollarBlock;
    }
    if (!inDollarBlock && /;\s*$/.test(line.trim())) {
      statements.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());

  return statements
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^(begin|commit)\s*;?$/i.test(s));
}

async function main() {
  const prisma = new PrismaClient();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS _manual_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const appliedRows = await prisma.$queryRawUnsafe('SELECT filename FROM _manual_migrations;');
  const applied = new Set(appliedRows.map((r) => r.filename));

  if (applied.size === 0 && fs.existsSync(BASELINE_FILE)) {
    const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    for (const filename of baseline) {
      await prisma.$executeRawUnsafe(
        'INSERT INTO _manual_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING;',
        filename,
      );
      applied.add(filename);
    }
    console.log(`[migrations] baseline: ${baseline.length} archivo(s) marcados como ya aplicados`);
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('[migrations] nada pendiente');
  }

  for (const filename of pending) {
    console.log(`[migrations] aplicando ${filename}...`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
    const statements = splitStatements(sql);
    try {
      await prisma.$transaction(async (tx) => {
        for (const statement of statements) {
          await tx.$executeRawUnsafe(statement);
        }
        await tx.$executeRawUnsafe(
          'INSERT INTO _manual_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING;',
          filename,
        );
      });
      console.log(`[migrations] ${filename} OK (${statements.length} sentencia(s))`);
    } catch (err) {
      console.error(`[migrations] FALLÓ ${filename}:`, err);
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[migrations] error inesperado:', err);
  process.exit(1);
});
