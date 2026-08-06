/**
 * Legt ein Team-Konto an — vor allem für das erste Konto einer frischen
 * Installation, denn ohne Konto kommt niemand in die Oberfläche.
 *
 *   node --experimental-strip-types scripts/nutzer-anlegen.ts \
 *     helena@thdvideo.de "Helena Avdijaj" [passwort]
 *
 * Ohne Passwort wird eines erzeugt und einmalig ausgegeben. Das erste Konto
 * einer leeren Installation wird automatisch Administrator.
 */
import { randomBytes, scrypt } from 'node:crypto'
import process from 'node:process'
import { promisify } from 'node:util'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

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

async function hashePasswort(passwort: string): Promise<string> {
  const salz = randomBytes(16)
  const abgeleitet = (await scryptAsync(passwort, salz, 64)) as Buffer
  return `scrypt:${salz.toString('hex')}:${abgeleitet.toString('hex')}`
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

const adresse = email.trim().toLowerCase()
const vorhanden = await prisma.nutzer.findUnique({ where: { email: adresse } })
if (vorhanden) {
  console.error(`Es gibt bereits ein Konto für ${adresse}.`)
  await prisma.$disconnect()
  process.exit(1)
}

// Ein leeres System braucht zuerst jemanden, der die Einstellungen aufmachen darf.
const istErstes = (await prisma.nutzer.count()) === 0
const passwort = uebergebenesPasswort ?? randomBytes(9).toString('base64url')

const nutzer = await prisma.nutzer.create({
  data: {
    email: adresse,
    name: name.trim(),
    initialen: initialen(name),
    rolle: istErstes ? 'ADMIN' : 'MITGLIED',
    passwortHash: await hashePasswort(passwort),
  },
})

console.log(`Konto angelegt: ${nutzer.name} <${nutzer.email}>`)
console.log(`Rolle: ${nutzer.rolle === 'ADMIN' ? 'Administrator' : 'Mitglied'}`)
if (!uebergebenesPasswort) {
  console.log(`Passwort: ${passwort}`)
  console.log('Bitte nach der ersten Anmeldung ändern.')
}

await prisma.$disconnect()
