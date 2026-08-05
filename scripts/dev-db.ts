/**
 * Entwicklungs-Datenbank ohne Docker.
 *
 * Startet PGlite (Postgres als WASM-Modul) hinter einem TCP-Socket, der das
 * Postgres-Wire-Protokoll spricht. Damit funktionieren `prisma migrate`, der
 * pg-Treiber und die App unverändert — der Produktivbetrieb nutzt dasselbe
 * DATABASE_URL, nur eben gegen echtes Postgres aus docker-compose.
 *
 *   node --experimental-strip-types scripts/dev-db.ts
 */
import process from 'node:process'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const DATENVERZEICHNIS = process.env.PGLITE_DIR ?? './data/pglite'
const PORT = Number(process.env.PGLITE_PORT ?? 5432)

const db = await PGlite.create(DATENVERZEICHNIS)
const server = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1' })

await server.start()
console.log(`PGlite lauscht auf 127.0.0.1:${PORT} (Daten: ${DATENVERZEICHNIS})`)
console.log('Beenden mit Strg+C.')

const beenden = async () => {
  await server.stop()
  await db.close()
  process.exit(0)
}

process.on('SIGINT', beenden)
process.on('SIGTERM', beenden)
