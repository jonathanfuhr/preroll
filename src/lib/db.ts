import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import process from 'node:process'
import { env } from './env'

// Next lädt Module im Dev-Modus bei jeder Änderung neu — ohne diesen Cache
// entstünde pro Reload ein neuer Verbindungspool.
const global_ = globalThis as unknown as { prisma?: PrismaClient }

// Die Entwicklungs-Datenbank (PGlite) bedient genau eine Verbindung zur Zeit.
// Echtes Postgres verträgt mehr; der Wert steht deshalb in der Umgebung.
const poolGroesse = Number(process.env.DATABASE_POOL_MAX ?? (env.istProduktion ? 10 : 1))

export const prisma =
  global_.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: env.datenbankUrl,
      max: poolGroesse,
    }),
    log: env.istProduktion ? ['error'] : ['error', 'warn'],
  })

if (!env.istProduktion) global_.prisma = prisma
