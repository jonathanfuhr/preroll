/**
 * Spielt die Migrationen aus prisma/migrations ein.
 *
 * In Produktion übernimmt das `prisma migrate deploy`. Lokal läuft die
 * Entwicklungs-Datenbank auf PGlite, dessen Socket die Migrations-Engine von
 * Prisma nicht bedienen kann (sie braucht eine Shadow-Datenbank). Dieses
 * Skript schreibt in dieselbe Tabelle `_prisma_migrations`, damit beide Wege
 * denselben Stand ergeben.
 *
 *   node --experimental-strip-types scripts/db-migrate.ts
 */
import { createHash, randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import pg from 'pg'

try {
  process.loadEnvFile('.env')
} catch {
  // In Docker kommen die Werte aus der Umgebung.
}

const MIGRATIONSORDNER = path.resolve('prisma/migrations')

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

await client.query(`
  CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    id                      VARCHAR(36) PRIMARY KEY,
    checksum                VARCHAR(64) NOT NULL,
    finished_at             TIMESTAMPTZ,
    migration_name          VARCHAR(255) NOT NULL,
    logs                    TEXT,
    rolled_back_at          TIMESTAMPTZ,
    started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_steps_count     INTEGER NOT NULL DEFAULT 0
  )
`)

const { rows } = await client.query<{ migration_name: string }>(
  'SELECT migration_name FROM "_prisma_migrations" WHERE rolled_back_at IS NULL',
)
const bereitsAngewendet = new Set(rows.map((r) => r.migration_name))

const ordner = readdirSync(MIGRATIONSORDNER, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort()

let angewendet = 0
for (const name of ordner) {
  if (bereitsAngewendet.has(name)) continue

  const sql = readFileSync(path.join(MIGRATIONSORDNER, name, 'migration.sql'), 'utf8')
  const checksum = createHash('sha256').update(sql).digest('hex')

  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query(
      `INSERT INTO "_prisma_migrations"
         (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
       VALUES ($1, $2, now(), $3, now(), 1)`,
      [randomUUID(), checksum, name],
    )
    await client.query('COMMIT')
    console.log(`✔ ${name}`)
    angewendet++
  } catch (fehler) {
    await client.query('ROLLBACK')
    console.error(`✘ ${name}`)
    throw fehler
  }
}

console.log(
  angewendet === 0
    ? 'Datenbank ist aktuell — nichts einzuspielen.'
    : `${angewendet} Migration(en) eingespielt.`,
)

await client.end()
