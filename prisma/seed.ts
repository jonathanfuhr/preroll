/**
 * Beispieldaten: der Kunde Beispiel Handwerk GmbH mit dem Content-Plan August 2026 —
 * dieselben Inhalte wie in den Mockups unter design/.
 *
 *   npm run db:seed
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
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

async function hashePasswort(passwort: string): Promise<string> {
  const salz = randomBytes(16)
  const abgeleitet = (await scryptAsync(passwort, salz, 64)) as Buffer
  return `scrypt:${salz.toString('hex')}:${abgeleitet.toString('hex')}`
}

const START_PASSWORT = process.env.SEED_PASSWORT ?? 'preroll'

async function main() {
  await prisma.einstellungen.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', workspaceName: 'THD Video' },
  })

  const helena = await prisma.nutzer.upsert({
    where: { email: 'helena@thdvideo.de' },
    update: {},
    create: {
      email: 'helena@thdvideo.de',
      name: 'Helena Avdijaj',
      initialen: 'HA',
      rolle: 'ADMIN',
      passwortHash: await hashePasswort(START_PASSWORT),
    },
  })

  await prisma.nutzer.upsert({
    where: { email: 'marco@thdvideo.de' },
    update: {},
    create: {
      email: 'marco@thdvideo.de',
      name: 'Marco Denk',
      initialen: 'MD',
      rolle: 'MITGLIED',
      passwortHash: await hashePasswort(START_PASSWORT),
    },
  })

  const kunde = await prisma.kunde.upsert({
    where: { slug: 'beispiel-handwerk' },
    update: {},
    create: {
      name: 'Beispiel Handwerk GmbH',
      slug: 'beispiel-handwerk',
      handle: 'beispiel.handwerk',
      bio: 'Garten- & Landschaftsbau · Facility Management · Wendlingen',
      website: 'www.beispiel-handwerk.de',
      follower: 2847,
      gefolgt: 312,
      beitraege: 148,
      kennzahlenAm: new Date('2026-08-05T04:00:00Z'),
    },
  })

  const ansprechpartner = await prisma.ansprechpartner.upsert({
    where: { id: 'seed-helena' },
    update: {},
    create: {
      id: 'seed-helena',
      kundeId: kunde.id,
      name: 'Helena Avdijaj',
      rolle: 'Ansprechpartnerin · THD Video',
      telefon: '07024 4699830',
      email: 'helena@thdvideo.de',
      adresse: 'Stuttgarter Str. 1, 73240 Wendlingen',
      website: 'www.thdvideo.de',
      standard: true,
    },
  })

  // Eigene Felder, wie im Reel-Editor gezeigt.
  const felder = [
    { name: 'Drehort', typ: 'TEXT' as const, position: 0 },
    { name: 'Drehtermin', typ: 'DATUM' as const, position: 1 },
    { name: 'Musik-Lizenz', typ: 'TEXT' as const, position: 2 },
    { name: 'Untertitel geprüft', typ: 'JANEIN' as const, position: 3 },
  ]
  for (const feld of felder) {
    await prisma.customFeldDefinition.upsert({
      where: { kundeId_name: { kundeId: kunde.id, name: feld.name } },
      update: {},
      create: { kundeId: kunde.id, ...feld },
    })
  }

  const bestehende = await prisma.post.count({ where: { kundeId: kunde.id } })
  if (bestehende === 0) {
    const reel = await prisma.post.create({
      data: {
        kundeId: kunde.id,
        typ: 'REEL',
        status: 'VORSCHAU',
        postenAm: new Date(2026, 7, 5, 11, 0),
        titel: 'Recruiting-Reel: Wir suchen Verstärkung',
        kurzbeschreibung: 'Kurzes Recruiting-Reel ohne festes Storyboard.',
        caption:
          'Wir suchen Verstärkung! 🌿 Bei Beispiel arbeitest du draußen, im Team — und siehst abends, ' +
          'was du geschafft hast. Moderne Maschinen, feste Teams, klare Aufgaben.\n\n' +
          'Jetzt bewerben über den Link in der Bio.\n\n' +
          '#galabau #handwerk #ausbildung #jobs #wendlingen #gartenundlandschaftsbau',
        laenge: 'ca. 30–35 Sek.',
        ziel: 'Recruiting',
        stil: 'nahbar, direkt',
        verantwortlichId: helena.id,
        szenenplanAktiv: true,
        referenzVideoUrl: 'https://www.instagram.com/reel/CxK2f8pM1qA/',
        referenzVideoTitel: 'Referenz: „Handwerk sucht dich" — @gruen.kollektiv',
        szenen: {
          create: [
            {
              position: 0,
              abschnitt: 'Hook',
              bildSzene:
                'Drei Mitarbeiter stehen vor dem Firmengelände, einer dreht sich in die Kamera.',
              sprechertext: '„Wir suchen Verstärkung — und zwar dich."',
              texteinblendung: 'GARTEN- & LANDSCHAFTSBAUER GESUCHT!',
            },
            {
              position: 1,
              abschnitt: 'Intro',
              bildSzene: 'Schwenk über die Baustelle, Team beim Setzen der Randsteine.',
              sprechertext:
                '„Bei Beispiel arbeitest du draußen, im Team — und siehst abends, was du geschafft hast."',
              texteinblendung: null,
            },
            {
              position: 2,
              abschnitt: 'Szene',
              bildSzene: 'Nahaufnahmen: Heckenschere, Radlader, Pflanzarbeiten — schneller Schnitt.',
              sprechertext: '„Moderne Maschinen, feste Teams, klare Aufgaben."',
              texteinblendung: 'Grünflächen · Maschinen · Team',
            },
            {
              position: 3,
              abschnitt: 'Szene',
              bildSzene: 'Mitarbeiter im Gespräch, lachen, Wasserflasche in der Pause.',
              sprechertext: '„Lasst uns endlich anfangen."',
              texteinblendung: 'LASST UNS ENDLICH …',
            },
            {
              position: 4,
              abschnitt: 'Abbinder',
              bildSzene: 'Logo-Animation auf grünem Grund, Bewerbungs-Hinweis.',
              sprechertext: '„Bewirb dich jetzt bei Beispiel."',
              texteinblendung: 'JETZT BEWERBEN',
            },
          ],
        },
      },
    })

    await prisma.post.create({
      data: {
        kundeId: kunde.id,
        typ: 'KARUSSELL',
        status: 'VORSCHAU',
        postenAm: new Date(2026, 7, 11, 10, 0),
        titel: 'Deine Aufgaben bei Beispiel',
        kurzbeschreibung: 'Leistungs-Karussell mit den vier Tätigkeitsfeldern.',
        caption:
          'Was dich bei uns erwartet — von der Pflanzung bis zur Pflege. Swipe dich durch. 🌱\n\n' +
          '#galabau #jobs #teamwork #wendlingen',
        ziel: 'Recruiting',
        stil: 'sachlich, klar',
        verantwortlichId: helena.id,
      },
    })

    await prisma.post.create({
      data: {
        kundeId: kunde.id,
        typ: 'BEITRAG',
        status: 'KONZEPT',
        postenAm: new Date(2026, 7, 20, 17, 30),
        titel: 'Vorher / Nachher: Innenhof Wendlingen',
        kurzbeschreibung: 'Ein Projekt aus dem Juli, zweigeteiltes Bild.',
        caption:
          'Aus grauem Beton wird ein Ort zum Bleiben. Innenhof in Wendlingen, fertiggestellt im Juli.\n\n' +
          '#vorhernachher #galabau #referenz #wendlingen',
        ziel: 'Referenz zeigen',
        stil: 'ruhig, bildstark',
        verantwortlichId: helena.id,
      },
    })

    await prisma.post.create({
      data: {
        kundeId: kunde.id,
        typ: 'BEITRAG',
        status: 'KONZEPT',
        postenAm: new Date(2026, 7, 27, 9, 0),
        titel: 'Facility Management — das zweite Standbein',
        kurzbeschreibung: 'Einzelbild mit kurzem Leistungsüberblick.',
        caption:
          'Nicht nur draußen: Unser Facility-Team hält Gebäude und Außenanlagen das ganze Jahr in Schuss.\n\n' +
          '#facilitymanagement #hausmeisterservice #wendlingen',
        ziel: 'Leistungen zeigen',
        stil: 'sachlich',
        verantwortlichId: helena.id,
      },
    })

    void reel
  }

  const bestehenderExport = await prisma.export.findFirst({ where: { kundeId: kunde.id } })
  if (!bestehenderExport) {
    await prisma.export.create({
      data: {
        kundeId: kunde.id,
        token: 'beispiel-aug26',
        titel: 'Content-Plan August 2026',
        zeitraumVon: new Date('2026-08-01T00:00:00.000Z'),
        zeitraumBis: new Date('2026-08-31T00:00:00.000Z'),
        gueltigBis: new Date('2026-09-30T00:00:00.000Z'),
        ansprechpartnerId: ansprechpartner.id,
      },
    })
  }

  console.log('Beispieldaten angelegt.')
  console.log(`Anmeldung: helena@thdvideo.de / ${START_PASSWORT}`)
  console.log('Freigabe-Link: /f/beispiel-aug26')
}

await main()
await prisma.$disconnect()
