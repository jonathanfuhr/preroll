import type { Mail } from './typen'

function huelle(titel: string, inhalt: string, fusszeile?: string): string {
  return `<!doctype html>
<html lang="de"><body style="margin:0;background:#eceae7;padding:32px 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1c1a18;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #e6e3df;border-radius:8px;">
      <tr><td style="padding:28px 32px 8px;">
        <div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#8b8783;">preroll</div>
        <h1 style="margin:12px 0 0;font-size:20px;font-weight:600;letter-spacing:-0.01em;">${titel}</h1>
      </td></tr>
      <tr><td style="padding:12px 32px 28px;font-size:14.5px;line-height:1.7;color:#57534f;">${inhalt}</td></tr>
    </table>
    ${
      fusszeile
        ? `<div style="max-width:520px;margin-top:16px;font-size:12px;line-height:1.6;color:#8b8783;">${fusszeile}</div>`
        : ''
    }
  </td></tr></table>
</body></html>`
}

function knopf(url: string, beschriftung: string): string {
  return `<p style="margin:24px 0 8px;"><a href="${url}" style="display:inline-block;background:#b00900;color:#fff;font-size:14px;font-weight:500;text-decoration:none;padding:11px 22px;border-radius:5px;">${beschriftung}</a></p>`
}

export function vorlageAnmeldecode(an: string, code: string, workspace: string): Mail {
  const gesperrt = code.split('').join(' ')
  return {
    an,
    betreff: `${code} ist dein Anmeldecode für ${workspace}`,
    text: `Dein Anmeldecode lautet ${code}.\n\nEr gilt 15 Minuten. Wenn du dich nicht anmelden wolltest, kannst du diese Mail ignorieren.`,
    html: huelle(
      'Dein Anmeldecode',
      `<p style="margin:0;">Gib diesen Code ein, um fortzufahren:</p>
       <p style="margin:20px 0;font-size:30px;font-weight:600;letter-spacing:.22em;font-family:ui-monospace,'SF Mono',Menlo,monospace;color:#1c1a18;">${gesperrt}</p>
       <p style="margin:0;">Der Code gilt 15 Minuten.</p>`,
      'Wenn du dich nicht anmelden wolltest, kannst du diese Mail ignorieren.',
    ),
  }
}

export function vorlageEinladung(
  an: string,
  kunde: string,
  zeitraum: string,
  url: string,
): Mail {
  return {
    an,
    betreff: `Content-Plan ${zeitraum} für ${kunde} liegt zur Freigabe bereit`,
    text: `Der Content-Plan ${zeitraum} für ${kunde} steht zur Durchsicht bereit.\n\n${url}`,
    html: huelle(
      'Zur Freigabe bereit',
      `<p style="margin:0;">Der Content-Plan <strong>${zeitraum}</strong> für <strong>${kunde}</strong> steht zur Durchsicht bereit. Du siehst dort den Kalender, eine Vorschau des Feeds und jeden geplanten Beitrag — und kannst direkt kommentieren.</p>
       ${knopf(url, 'Plan ansehen')}`,
      'Diesen Link bitte nicht weitergeben — er gilt persönlich für dich.',
    ),
  }
}

export function vorlageNeuerKommentar(
  an: string,
  autor: string,
  kunde: string,
  postTitel: string,
  text: string,
  url: string,
): Mail {
  const gekuerzt = text.length > 400 ? `${text.slice(0, 400)} …` : text
  return {
    an,
    betreff: `Neuer Kommentar von ${autor} — ${postTitel}`,
    text: `${autor} hat „${postTitel}" (${kunde}) kommentiert:\n\n${gekuerzt}\n\n${url}`,
    html: huelle(
      'Neuer Kommentar',
      `<p style="margin:0 0 14px;"><strong>${autor}</strong> hat <strong>${postTitel}</strong> (${kunde}) kommentiert:</p>
       <blockquote style="margin:0;padding:12px 16px;border-left:3px solid #e6e3df;background:#faf9f7;color:#3a3733;">${gekuerzt.replace(/\n/g, '<br>')}</blockquote>
       ${knopf(url, 'Kommentar öffnen')}`,
    ),
  }
}

/**
 * Eine Erwähnung ist etwas anderes als ein neuer Kommentar: Sie ist an eine
 * Person gerichtet. Das gehört in den Betreff, sonst geht sie im Strom der
 * übrigen Kommentar-Mails unter.
 */
export function vorlageErwaehnung(
  an: string,
  autor: string,
  kunde: string,
  postTitel: string,
  text: string,
  url: string,
): Mail {
  const gekuerzt = text.length > 400 ? `${text.slice(0, 400)} …` : text
  return {
    an,
    betreff: `${autor} hat Sie erwähnt — ${postTitel}`,
    text: `${autor} hat Sie in einem Kommentar zu „${postTitel}" (${kunde}) erwähnt:\n\n${gekuerzt}\n\n${url}`,
    html: huelle(
      'Sie wurden erwähnt',
      `<p style="margin:0 0 14px;"><strong>${autor}</strong> hat Sie in einem Kommentar zu <strong>${postTitel}</strong> (${kunde}) erwähnt:</p>
       <blockquote style="margin:0;padding:12px 16px;border-left:3px solid #e6e3df;background:#faf9f7;color:#3a3733;">${gekuerzt.replace(/\n/g, '<br>')}</blockquote>
       ${knopf(url, 'Kommentar öffnen')}`,
    ),
  }
}

export function vorlageFreigabe(
  an: string,
  autor: string,
  kunde: string,
  zeitraum: string,
  url: string,
): Mail {
  return {
    an,
    betreff: `${kunde} hat den Plan ${zeitraum} freigegeben`,
    text: `${autor} hat den Content-Plan ${zeitraum} für ${kunde} freigegeben.\n\n${url}`,
    html: huelle(
      'Freigabe erteilt',
      `<p style="margin:0;"><strong>${autor}</strong> hat den Content-Plan <strong>${zeitraum}</strong> für <strong>${kunde}</strong> freigegeben.</p>
       ${knopf(url, 'Freigabe ansehen')}`,
    ),
  }
}

/**
 * Ein Beitrag ist nicht rausgegangen.
 *
 * Betreff und erster Satz nennen Kunde und Beitrag — wer die Mail am Telefon
 * in der Vorschau sieht, soll ohne Öffnen wissen, ob es dringend ist.
 */
export function vorlageVeroeffentlichungFehlgeschlagen(
  an: string,
  kunde: string,
  beitrag: string,
  plattform: string,
  termin: string,
  grund: string,
  url: string,
): Mail {
  return {
    an,
    betreff: `Nicht veröffentlicht: ${beitrag} (${kunde})`,
    text:
      `Der Beitrag „${beitrag}" für ${kunde} sollte am ${termin} auf ${plattform} erscheinen ` +
      `und ist nicht rausgegangen.\n\nGrund: ${grund}\n\n${url}`,
    html: huelle(
      'Beitrag nicht veröffentlicht',
      `<p style="margin:0;"><strong>${beitrag}</strong> für <strong>${kunde}</strong> sollte am
         <strong>${termin}</strong> auf <strong>${plattform}</strong> erscheinen — und ist nicht
         rausgegangen.</p>
       <p style="margin:16px 0 0;padding:12px 14px;background:#fbeceb;border-radius:5px;color:#8a1810;">${grund}</p>
       ${knopf(url, 'Beitrag öffnen')}`,
      'Im Beitrag steht ein Knopf „Erneut versuchen". Alternativ genügt es, ihm einen neuen Termin zu geben.',
    ),
  }
}

/**
 * Der Meta-Zugang wird abgelehnt. Eine Mail statt einer je Beitrag: Die
 * Ursache ist dieselbe, und zwanzig Mails über dasselbe tote Token liest
 * niemand.
 */
export function vorlageZugangAbgelehnt(
  an: string,
  grund: string,
  kunden: string[],
  url: string,
): Mail {
  const betroffen =
    kunden.length === 0
      ? 'Zurzeit veröffentlicht Preroll für keinen Kunden — es geht also nichts verloren.'
      : `Betroffen: ${kunden.join(', ')}. Für diese Kunden geht bis zur Erneuerung nichts raus.`

  return {
    an,
    betreff: 'Preroll: Meta-Zugang erneuern',
    text: `Meta lehnt den hinterlegten Zugang ab.\n\n${grund}\n\n${betroffen}\n\n${url}`,
    html: huelle(
      'Meta-Zugang erneuern',
      `<p style="margin:0;">Meta lehnt den hinterlegten Zugang ab.</p>
       <p style="margin:16px 0 0;padding:12px 14px;background:#fbeceb;border-radius:5px;color:#8a1810;">${grund}</p>
       <p style="margin:16px 0 0;">${betroffen}</p>
       ${knopf(url, 'Einstellungen öffnen')}`,
    ),
  }
}

export function vorlageTestmail(an: string, transport: string): Mail {
  return {
    an,
    betreff: 'Testmail aus Preroll',
    text: `Der Mailversand über ${transport} funktioniert.`,
    html: huelle(
      'Mailversand funktioniert',
      `<p style="margin:0;">Diese Nachricht kam über <strong>${transport}</strong> bei dir an. Damit ist der Versand richtig eingerichtet.</p>`,
    ),
  }
}
