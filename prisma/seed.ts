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
    create: {
      id: 'singleton',
      workspaceName: 'THD Video',
      agenturName: 'THD Video',
      agenturAdresse: 'Musterstraße 1, 12345 Musterstadt',
      agenturWebsite: 'www.thdvideo.de',
    },
  })

  const helena = await prisma.nutzer.upsert({
    where: { email: 'helena@thdvideo.de' },
    update: {},
    create: {
      email: 'helena@thdvideo.de',
      name: 'Helena Avdijaj',
      initialen: 'HA',
      rolle: 'ADMIN',
      position: 'Projektleitung',
      telefon: '07024 4699830',
      passwortHash: await hashePasswort(START_PASSWORT),
    },
  })

  const marco = await prisma.nutzer.upsert({
    where: { email: 'marco@thdvideo.de' },
    update: {},
    create: {
      email: 'marco@thdvideo.de',
      name: 'Marco Denk',
      initialen: 'MD',
      rolle: 'DESIGNER',
      position: 'Gestaltung',
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
      bio: 'Beispielbranche · Musterstadt',
      website: 'www.beispiel-handwerk.de',
      follower: 2847,
      gefolgt: 312,
      beitraege: 148,
      kennzahlenAm: new Date('2026-08-05T04:00:00Z'),
    },
  })

  // Ansprechpartner sind Nutzerkonten. Der Hauptansprechpartner steht auf
  // jeder Export-Seite dieses Kunden und bekommt jede Rückmeldung.
  await prisma.kunde.update({
    where: { id: kunde.id },
    data: { hauptAnsprechpartnerId: helena.id },
  })

  await prisma.kundeBetreuer.upsert({
    where: { kundeId_nutzerId: { kundeId: kunde.id, nutzerId: marco.id } },
    update: {},
    create: { kundeId: kunde.id, nutzerId: marco.id },
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
          '#beispiel #handwerk #ausbildung #jobs',
        laenge: 'ca. 30–35 Sek.',
        ziel: 'Recruiting',
        stil: 'nahbar, direkt',
        verantwortlichId: helena.id,
        szenenplanAktiv: true,
        referenzVideoUrl: 'https://www.instagram.com/reel/CxK2f8pM1qA/',
        referenzVideoTitel: 'Referenz-Reel eines anderen Betriebs',
        szenen: {
          create: [
            {
              position: 0,
              abschnitt: 'Hook',
              bildSzene:
                'Drei Mitarbeitende stehen vor dem Firmengebäude, eine Person dreht sich in die Kamera.',
              sprechertext: '„Wir suchen Verstärkung — und zwar dich."',
              texteinblendung: 'VERSTÄRKUNG GESUCHT!',
            },
            {
              position: 1,
              abschnitt: 'Intro',
              bildSzene: 'Schwenk über den Arbeitsplatz, Team bei der Arbeit.',
              sprechertext:
                '„Bei uns arbeitest du im Team — und siehst abends, was du geschafft hast."',
              texteinblendung: null,
            },
            {
              position: 2,
              abschnitt: 'Szene',
              bildSzene: 'Nahaufnahmen aus dem Arbeitsalltag — schneller Schnitt.',
              sprechertext: '„Moderne Maschinen, feste Teams, klare Aufgaben."',
              texteinblendung: 'Maschinen · Team · Alltag',
            },
            {
              position: 3,
              abschnitt: 'Szene',
              bildSzene: 'Mitarbeitende im Gespräch, kurze Pause.',
              sprechertext: '„Lasst uns endlich anfangen."',
              texteinblendung: 'LASST UNS ENDLICH …',
            },
            {
              position: 4,
              abschnitt: 'Abbinder',
              bildSzene: 'Logo-Animation, Bewerbungs-Hinweis.',
              sprechertext: '„Bewirb dich jetzt bei uns."',
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
        titel: 'Deine Aufgaben bei uns',
        kurzbeschreibung: 'Leistungs-Karussell mit vier Tätigkeitsfeldern.',
        caption:
          'Was dich bei uns erwartet. Swipe dich durch.\n\n' +
          '#beispiel #jobs #teamwork',
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
        titel: 'Vorher / Nachher: Musterprojekt',
        kurzbeschreibung: 'Ein abgeschlossenes Projekt, zweigeteiltes Bild.',
        caption:
          'Ein abgeschlossenes Projekt im Vorher-Nachher-Vergleich.\n\n' +
          '#vorhernachher #referenz #beispiel',
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
        titel: 'Zweiter Leistungsbereich',
        kurzbeschreibung: 'Einzelbild mit kurzem Leistungsüberblick.',
        caption:
          'Ein zweiter Leistungsbereich, kurz vorgestellt.\n\n' +
          '#leistungen #beispiel',
        ziel: 'Leistungen zeigen',
        stil: 'sachlich',
        verantwortlichId: helena.id,
      },
    })

    // Zwei Posts ohne Termin — sie zeigen die Spalte „Ungeplant" im Kalender.
    await prisma.post.create({
      data: {
        kundeId: kunde.id,
        typ: 'BEITRAG',
        status: 'KONZEPT',
        postenAm: null,
        titel: 'Team-Vorstellung Werkstatt',
        kurzbeschreibung: 'Idee ohne Termin — wartet auf einen freien Tag.',
        verantwortlichId: helena.id,
      },
    })

    await prisma.post.create({
      data: {
        kundeId: kunde.id,
        typ: 'REEL',
        status: 'KONZEPT',
        postenAm: null,
        titel: 'Maschinenpark im Zeitraffer',
        kurzbeschreibung: 'Noch nicht eingeplant.',
        szenenplanAktiv: true,
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
      },
    })
  }

  console.log('Beispieldaten angelegt.')
  console.log(`Anmeldung: helena@thdvideo.de / ${START_PASSWORT}`)
  console.log('Freigabe-Link: /f/beispiel-aug26')
}

await main()
await prisma.$disconnect()
