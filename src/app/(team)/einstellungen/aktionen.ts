'use server'

import type { MailTransport } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { aworkPruefen } from '@/lib/awork'
import { alsCookiedatei, pruefeInstagram } from '@/lib/instagram'
import { erneuereVorschaubild, loescheDatei } from '@/lib/medien'
import { prisma } from '@/lib/db'
import { leseDomaenen, schreibeDomaenen } from '@/lib/domaenen'
import { ladeEinstellungen, speichereEinstellungen } from '@/lib/einstellungen'
import { sendeMail } from '@/lib/mail'
import { vorlageTestmail } from '@/lib/mail/vorlagen'
import { vapidSchluessel } from '@/lib/push'

async function adminOderRaus() {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')
  if (nutzer.rolle !== 'ADMIN') redirect('/kunden')
  return nutzer
}

function text(formular: FormData, feld: string): string | null {
  const wert = String(formular.get(feld) ?? '').trim()
  return wert === '' ? null : wert
}

/**
 * Geheimnisse werden nur überschrieben, wenn tatsächlich etwas eingegeben
 * wurde — die Oberfläche zeigt sie nie im Klartext an.
 */
function geheimnis(formular: FormData, feld: string): string | undefined {
  const wert = String(formular.get(feld) ?? '').trim()
  return wert === '' ? undefined : wert
}

export async function workspaceSpeichern(formular: FormData) {
  await adminOderRaus()
  await speichereEinstellungen({
    workspaceName: text(formular, 'workspaceName') ?? 'Preroll',
    akzentfarbe: text(formular, 'akzentfarbe') ?? '#b00900',
    ...(formular.has('agenturName')
      ? {
          agenturName: text(formular, 'agenturName'),
          agenturAdresse: text(formular, 'agenturAdresse'),
          agenturWebsite: text(formular, 'agenturWebsite'),
        }
      : {}),
  })
  revalidatePath('/einstellungen')
}

/**
 * Instagram gibt viele Reels nur an eine angemeldete Sitzung heraus. Der von
 * yt-dlp dokumentierte Weg dagegen ist eine cookies.txt — sie liegt hier wie
 * ein Geheimnis und wird nie im Klartext zurückgezeigt.
 */
export async function instagramSitzungSpeichern(formular: FormData) {
  await adminOderRaus()

  if (formular.get('cookiesLoeschen') === 'on') {
    await speichereEinstellungen({
      instagramCookies: null,
      instagramCookiesAm: null,
      instagramGeprueftAm: null,
      instagramGemeldetAm: null,
      instagramFehler: null,
    })
    // Das Warnbanner hängt im Layout — ohne dies bliebe es bis zum nächsten
    // Seitenwechsel stehen, obwohl das Problem behoben ist.
    revalidatePath('/', 'layout')
    redirect('/einstellungen')
  }

  const eingabe = String(formular.get('instagramCookies') ?? '')
  const datei = alsCookiedatei(eingabe)

  if (datei) {
    await speichereEinstellungen({
      instagramCookies: datei,
      instagramCookiesAm: new Date(),
      instagramGeprueftAm: null,
      instagramGemeldetAm: null,
      instagramFehler: null,
    })
    revalidatePath('/', 'layout')
  }

  // Steht eine Adresse im Prüffeld, gleich ausprobieren — sonst merkt man erst
  // beim nächsten Post, ob die Sitzung taugt.
  const testUrl = String(formular.get('testUrl') ?? '').trim()
  // Der Prüf-Link bleibt liegen: Die tägliche Wache braucht ihn.
  await speichereEinstellungen({ instagramTestUrl: testUrl || null })

  if (testUrl) {
    const ergebnis = await pruefeInstagram(testUrl)
    revalidatePath('/', 'layout')
    redirect(
      ergebnis.ok
        ? `/einstellungen?ig=ok&meldung=${encodeURIComponent(ergebnis.titel)}`
        : `/einstellungen?ig=fehler&meldung=${encodeURIComponent(ergebnis.fehler)}`,
    )
  }

  revalidatePath('/einstellungen')
}

/**
 * Kennzahlen über die Instagram-Sitzung ein- oder ausschalten. Getrennt vom
 * Reel-Download, obwohl es dieselbe Sitzung ist: Wer sie nur für Videos
 * hinterlegt hat, soll sie nicht ungefragt zusätzlich belastet sehen.
 */
export async function kennzahlenSpeichern(formular: FormData) {
  await adminOderRaus()

  await speichereEinstellungen({
    kennzahlenAktiv: formular.get('kennzahlenAktiv') === 'on',
  })

  revalidatePath('/einstellungen')
  revalidatePath('/kunden', 'layout')
}

/**
 * Alle Vorschaubilder neu zuschneiden.
 *
 * Einmalig nötig nach dem Wechsel des Rasterausschnitts von 4:5 auf 3:4:
 * Vorschaubilder entstehen sonst nur beim Upload, alles Ältere bliebe im
 * alten Zuschnitt liegen und stünde im Profilraster seitlich beschnitten.
 *
 * Läuft in der Anfrage, nicht im Hintergrund — es sind Bilder, keine Videos,
 * und sharp schafft ein paar hundert in Sekunden. Käme je ein Bestand
 * zusammen, bei dem das nicht mehr trägt, gehört es in einen Auftrag wie den
 * Video-Download.
 */
export async function vorschaubilderNeuErzeugen() {
  await adminOderRaus()

  const medien = await prisma.medium.findMany({
    where: { thumbPfad: { not: null }, mimeTyp: { startsWith: 'image/' } },
    select: { id: true, pfad: true, thumbPfad: true, breite: true, hoehe: true, mimeTyp: true },
  })

  let erneuert = 0
  for (const medium of medien) {
    const neu = await erneuereVorschaubild(medium)
    if (!neu) continue

    const alt = medium.thumbPfad!
    await prisma.medium.update({ where: { id: medium.id }, data: { thumbPfad: neu } })
    await loescheDatei(alt)
    erneuert++
  }

  revalidatePath('/', 'layout')
  redirect(`/einstellungen?thumbs=${erneuert}`)
}

export async function mailSpeichern(formular: FormData) {
  await adminOderRaus()

  const transport = (text(formular, 'mailTransport') ?? 'DEAKTIVIERT') as MailTransport

  await speichereEinstellungen({
    mailTransport: transport,
    mailVonName: text(formular, 'mailVonName'),
    mailVonAdresse: text(formular, 'mailVonAdresse'),

    smtpHost: text(formular, 'smtpHost'),
    smtpPort: text(formular, 'smtpPort') ? Number(text(formular, 'smtpPort')) : null,
    smtpSicher: formular.get('smtpSicher') === 'on',
    smtpBenutzer: text(formular, 'smtpBenutzer'),
    ...(geheimnis(formular, 'smtpPasswort') ? { smtpPasswort: geheimnis(formular, 'smtpPasswort') } : {}),

    msTenantId: text(formular, 'msTenantId'),
    msClientId: text(formular, 'msClientId'),
    msPostfach: text(formular, 'msPostfach'),
    ...(geheimnis(formular, 'msClientSecret')
      ? { msClientSecret: geheimnis(formular, 'msClientSecret') }
      : {}),

    googleClientId: text(formular, 'googleClientId'),
    googleAbsender: text(formular, 'googleAbsender'),
    ...(geheimnis(formular, 'googleClientSecret')
      ? { googleClientSecret: geheimnis(formular, 'googleClientSecret') }
      : {}),
    ...(geheimnis(formular, 'googleRefreshToken')
      ? { googleRefreshToken: geheimnis(formular, 'googleRefreshToken') }
      : {}),
  })

  revalidatePath('/einstellungen')
}

export async function testmailSenden(formular: FormData) {
  const nutzer = await adminOderRaus()

  const an = text(formular, 'testAn') ?? nutzer.email
  const einstellungen = await ladeEinstellungen()
  const ergebnis = await sendeMail(vorlageTestmail(an, einstellungen.mailTransport))

  redirect(
    ergebnis.ok
      ? `/einstellungen?test=ok&an=${encodeURIComponent(an)}`
      : `/einstellungen?test=fehler&meldung=${encodeURIComponent(ergebnis.fehler)}`,
  )
}

export async function anmeldungSpeichern(formular: FormData) {
  await adminOderRaus()
  await speichereEinstellungen({
    lokalerLoginErlaubt: formular.get('lokalerLoginErlaubt') === 'on',
    m365LoginErlaubt: formular.get('m365LoginErlaubt') === 'on',
    m365TenantId: text(formular, 'm365TenantId'),
    m365ClientId: text(formular, 'm365ClientId'),
    // Durchgeputzt speichern, damit die Anmeldung nicht bei jedem Aufruf
    // Tippfehler wegräumen muss.
    m365Domaenen: schreibeDomaenen(leseDomaenen(text(formular, 'm365Domaenen'))) || null,
    ...(geheimnis(formular, 'm365ClientSecret')
      ? { m365ClientSecret: geheimnis(formular, 'm365ClientSecret') }
      : {}),
  })
  revalidatePath('/einstellungen')
}

/** Was Preroll mit Klappe austauscht — die Kopplung selbst liegt woanders. */
export async function klappeSpeichern(formular: FormData) {
  await adminOderRaus()
  await speichereEinstellungen({
    klappeVideoAnlegen: formular.get('klappeVideoAnlegen') === 'on',
    klappeNamenNachziehen: formular.get('klappeNamenNachziehen') === 'on',
    klappeNamensschema: text(formular, 'klappeNamensschema') ?? '{datum} {titel}',
    klappeNurEndfassung: formular.get('klappeNurEndfassung') === 'on',
    klappeInterneZeigen: formular.get('klappeInterneZeigen') === 'on',
    klappeAutoAktualisieren: formular.get('klappeAutoAktualisieren') === 'on',
    klappeNameEnthaelt: text(formular, 'klappeNameEnthaelt'),
  })
  revalidatePath('/einstellungen/klappe')
}

/** Erzeugt das VAPID-Paar, falls noch keines vorliegt. */
export async function pushEinrichten() {
  await adminOderRaus()
  await vapidSchluessel()
  revalidatePath('/einstellungen')
}

export async function benachrichtigungenSpeichern(formular: FormData) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')

  await prisma.nutzer.update({
    where: { id: nutzer.id },
    data: {
      mailBenachrichtigungen: formular.get('mailBenachrichtigungen') === 'on',
      pushBenachrichtigungen: formular.get('pushBenachrichtigungen') === 'on',
    },
  })
  revalidatePath('/einstellungen')
}

// ---------------------------------------------------------------------- awork

export async function aworkSpeichern(formular: FormData) {
  await adminOderRaus()
  await speichereEinstellungen({
    aworkAktiv: formular.get('aworkAktiv') === 'on',
    ...(geheimnis(formular, 'aworkApiKey') ? { aworkApiKey: geheimnis(formular, 'aworkApiKey') } : {}),
  })
  revalidatePath('/einstellungen/awork')
}

/**
 * Verbindungstest. Nimmt einen frisch eingegebenen Schlüssel entgegen, damit
 * er sich prüfen lässt, bevor er gespeichert ist.
 */
export async function aworkTesten(formular: FormData) {
  await adminOderRaus()

  const einstellungen = await ladeEinstellungen()
  const schluessel = geheimnis(formular, 'aworkApiKey') ?? einstellungen.aworkApiKey

  if (!schluessel) {
    redirect('/einstellungen/awork?test=fehler&meldung=' + encodeURIComponent('Kein Schlüssel hinterlegt.'))
  }

  // `redirect()` arbeitet, indem es wirft. Es steht deshalb außerhalb des
  // try-Blocks — sonst finge der eigene catch den Erfolgsfall ab und meldete
  // ihn als Verbindungsfehler.
  let ergebnis: { nutzer: number; projekte: number }
  try {
    ergebnis = await aworkPruefen(schluessel)
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : 'Unbekannter Fehler.'
    redirect(`/einstellungen/awork?test=fehler&meldung=${encodeURIComponent(text)}`)
  }

  await speichereEinstellungen({ aworkGeprueftAm: new Date() })
  redirect(
    `/einstellungen/awork?test=ok&meldung=${encodeURIComponent(
      `${ergebnis.nutzer} Nutzer und ${ergebnis.projekte} Projekte gefunden.`,
    )}`,
  )
}
