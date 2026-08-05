import process from 'node:process'
import { defineConfig } from 'prisma/config'

// Prisma 7 lädt .env nicht mehr von selbst; in Docker kommen die Werte
// ohnehin aus der Umgebung, lokal aus der Datei.
try {
  process.loadEnvFile('.env')
} catch {
  // Keine .env vorhanden — dann zählt allein die Prozessumgebung.
}

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL ist nicht gesetzt (siehe .env.example).')
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
  datasource: { url },
})
