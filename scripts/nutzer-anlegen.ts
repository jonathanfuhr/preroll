/**
 * Legt ein Team-Konto an — vor allem das erste einer frischen Installation,
 * denn ohne Konto kommt niemand in die Oberfläche, und über die Oberfläche
 * selbst lässt sich keines anlegen.
 *
 *   node --experimental-strip-types scripts/nutzer-anlegen.ts \
 *     helena@thdvideo.de "Helena Avdijaj" [passwort]
 *
 * Ohne Passwort wird eines erzeugt und einmalig ausgegeben. Das erste Konto
 * eines leeren Systems wird automatisch Administrator.
 *
 * Arbeitet bewusst direkt über `pg` statt über den Prisma-Client: Der
 * Standalone-Build bündelt den Datenbank-Adapter in den Server, sodass er
 * aus einem eigenständigen Skript nicht auflösbar ist — genau wie bei
 * scripts/db-migrate.ts.
 */
import { randomBytes, scrypt } from 'node:crypto'
import process from 'node:process'
import { promisify } from 'node:util'
import pg from 'pg'

try {
  process.loadEnvFile('.env')
} catch {
  // In Docker kommen die Werte aus der Umgebung.
}

const scryptAsync = promisify(scrypt)
const [email, name, uebergebenesPasswort] = process.argv.slice(2)

if (!email || !name) {
  console.error('Aufruf: nutzer-anlegen.ts <e-mail> <name> [passwort]')
  process.exit(1)
}

function initialen(voll: string): string {
  const teile = voll.trim().split(/\s+/).filter(Boolean)
  if (teile.length === 0) return '??'
  if (teile.length === 1) return teile[0].slice(0, 2).toUpperCase()
  return (teile[0][0] + teile[teile.length - 1][0]).toUpperCase()
}

/** Kennung in der Form, die Prisma sonst vergibt. */
function kennung(): string {
  const zeichen = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = randomBytes(24)
  return `c${Array.from(bytes, (b) => zeichen[b % zeichen.length]).join('')}`
}

async function hashePasswort(passwort: string): Promise<string> {
  const salz = randomBytes(16)
  const abgeleitet = (await scryptAsync(passwort, salz, 64)) as Buffer
  return `scrypt:${salz.toString('hex')}:${abgeleitet.toString('hex')}`
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const adresse = email.trim().toLowerCase()

const { rows: vorhanden } = await client.query('SELECT id FROM nutzer WHERE email = $1', [adresse])
if (vorhanden.length > 0) {
  console.error(`Es gibt bereits ein Konto für ${adresse}.`)
  await client.end()
  process.exit(1)
}

// Ein leeres System braucht zuerst jemanden, der die Einstellungen aufmachen darf.
const { rows: anzahl } = await client.query<{ count: string }>('SELECT count(*) FROM nutzer')
const rolle = Number(anzahl[0].count) === 0 ? 'ADMIN' : 'MITGLIED'

const passwort = uebergebenesPasswort ?? randomBytes(9).toString('base64url')

await client.query(
  `INSERT INTO nutzer (id, email, name, initialen, "passwortHash", rolle, "aktualisiertAm")
   VALUES ($1, $2, $3, $4, $5, $6, now())`,
  [kennung(), adresse, name.trim(), initialen(name), await hashePasswort(passwort), rolle],
)

console.log(`Konto angelegt: ${name.trim()} <${adresse}>`)
console.log(`Rolle: ${rolle === 'ADMIN' ? 'Administrator' : 'Mitglied'}`)
if (!uebergebenesPasswort) {
  console.log(`Passwort: ${passwort}`)
  console.log('Bitte nach der ersten Anmeldung ändern.')
}

await client.end()
