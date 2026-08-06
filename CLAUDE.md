# Preroll

Internes Web-Tool der Werbeagentur **THD Video**. Damit plant das Team
Social-Media-Content für seine Kunden (Reels, Karussells, Einzelbeiträge), legt
Posting-Termine fest und schickt dem Kunden einen Link zur Freigabe. Der Kunde
sieht dort einen Monatskalender, eine Vorschau seines künftigen Instagram-Feeds
und darunter jeden geplanten Post so, wie er später auf Instagram aussehen wird
— im iPhone-Rahmen mit Profilbild, Grafik und Caption — und kann direkt
kommentieren. Ersetzt einen bisherigen Canva-Workflow.

Zwei Nutzergruppen: das **Agentur-Team** (Backend, Desktop) und der **Kunde**
(Export-Seite, oft mobil). Gehört zur Produktfamilie mit
[Klappe](https://github.com/jonathanfuhr/klappe); Deployment läuft analog.

---

## Alles Gearbeitete wird in Notion dokumentiert

**Das ist die wichtigste Regel in diesem Repo.** Nach jedem abgeschlossenen
Arbeitsschritt — jeder Phase, jeder Fehlerbehebung, jeder Entscheidung — wird
der Stand in Notion nachgetragen, bevor die Arbeit als erledigt gilt.

| Seite | Zweck |
| --- | --- |
| [Preroll — Konzept & Claude-Design-Auftrag](https://app.notion.com/p/3b3c7929606a8140b85ef35a4113ca6a) | Elternseite: Konzept, Datenmodell, Phasenplan |
| [Baufortschritt](https://app.notion.com/p/3b3c7929606a81d6bb2cda42df54085a) | Was wann gebaut wurde, mit Commit und Prüfergebnis |
| [Entscheidungen](https://app.notion.com/p/3b3c7929606a8102b821f6e93bee70e2) | Technische Festlegungen samt Begründung |

**So wird dokumentiert:**

- In den **Baufortschritt** gehört pro Eintrag: Datum, Phase, was gebaut wurde,
  Branch und Commit, wie geprüft wurde (Testanzahl, Typecheck, Build) und was
  bewusst offengeblieben ist.
- In die **Entscheidungen** gehört alles, was später jemand hinterfragen könnte:
  warum ein Weg gewählt wurde und was die Alternative gewesen wäre.
- Weicht die Umsetzung vom Konzept ab, wird **die Konzeptseite mitgezogen** —
  nicht nur der Baufortschritt. Sonst driften Plan und Code auseinander.
- Geschrieben wird in ganzen Sätzen und auf Deutsch, ohne Marketing-Ton.
  Kein „erfolgreich implementiert" — lieber „gebaut, 47 Tests grün, ZIP-Export
  noch ohne Kommentar-PDF".
- Notion ist über den MCP-Connector erreichbar; die Seiten werden dort
  angelegt und fortgeschrieben, nicht als Kopie im Repo geführt.

Wenn eine Änderung klein genug scheint, um sie nicht zu dokumentieren, ist sie
klein genug für einen Einzeiler im Baufortschritt.

---

## Sprache

- **Alle Oberflächentexte auf Deutsch.** Auch Fehlermeldungen, Leerzustände,
  Mailvorlagen und Knopfbeschriftungen.
- **Auch der Code ist deutsch benannt** — Modelle, Felder, Funktionen,
  Variablen (`kunde`, `postenAm`, `berechneAuftrennung`). Das Datenmodell
  spiegelt die Begriffe, die das Team im Alltag benutzt. Englische Fachbegriffe
  bleiben, wo sie etabliert sind (`Token`, `Session`, `Slug`, `Push`).
- Kommentare erklären das **Warum**, nicht das Was, und sind sparsam gesetzt.

## Technik

| | |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, Server Components) |
| Sprache | TypeScript, `strict` |
| Datenbank | PostgreSQL über Prisma 7 (`@prisma/adapter-pg`) |
| Styling | Tailwind CSS 4, Tokens in `src/app/globals.css` |
| Bilder | sharp (Auftrennen, Zuschnitt, Vorschaubilder) |
| Mail | SMTP · Microsoft Graph · Gmail API — umschaltbar |
| Push | Web Push (VAPID), Schlüssel werden selbst erzeugt |
| Betrieb | Docker (`docker-compose.yml`), analog zu Klappe |
| Medien | Bind-Mount auf einen Host-Pfad (`MEDIEN_PFAD`), kein Volume |

Bewusst **kein** getrennter API-Service, kein Redis, kein Worker: Preroll
verarbeitet Bilder, keine Videos. Die Bildoperationen laufen schnell genug
direkt im Request. Kommt später etwas Langlaufendes dazu (z. B. das Laden von
Referenzvideos), wird ein Worker nachgezogen — vorher nicht.

### Entwicklung ohne Docker

Auf dem Mac liegt kein Postgres. `npm run dev:db` startet stattdessen PGlite
(Postgres als WASM-Modul) hinter einem TCP-Socket, der das Postgres-Protokoll
spricht — Prisma und die App merken keinen Unterschied.

```bash
npm run dev:db      # Terminal 1 — Datenbank auf 127.0.0.1:5432
npm run db:migrate  # Migrationen einspielen
npm run db:seed     # Beispielkunde Beispiel Handwerk GmbH
npm run dev         # Terminal 2 — App auf :3000
```

Prismas eigene Migrations-Engine braucht eine Shadow-Datenbank und kommt damit
nicht zurecht. Deshalb: Migrationen mit `prisma migrate diff` erzeugen und mit
`npm run db:migrate` einspielen. Beide Wege schreiben in dieselbe Tabelle
`_prisma_migrations`, in Produktion läuft weiterhin `prisma migrate deploy`.

### Vor jedem Commit

```bash
npm run check   # Typecheck + Tests
```

## Fachliche Regeln, die leicht verloren gehen

- **Seitenverhältnisse.** Beiträge und Karussell-Slides 4:5, Reels und
  Reel-Thumbnails 9:16. Abweichungen werden **gewarnt, nicht blockiert** — der
  Hinweis nennt erkanntes und erwartetes Format.
- **Reel-Thumbnails im Raster.** In allen Grid-/Feed-Ansichten wird vom
  9:16-Thumbnail der **mittige 4:5-Ausschnitt** gezeigt, wie bei Instagram.
- **Karussell-Auftrennung.** Geht die Breite nicht glatt im 4:5-Raster auf, gibt
  es **keine manuellen Schnittkanten**, sondern eine Fehlermeldung. Bewusst
  simpel: korrekt exportierte Canva-Dateien passen immer. Die Bedienelemente
  „Schnittkanten ausrichten" und „Überlappung" aus Mockup 2g sind bewusst
  **nicht** gebaut — der einzige Punkt, an dem die Optik dem Konzept weicht.
- **Transparente Pixel** in Post-Grafiken sind praktisch immer ein Versehen und
  werden gewarnt. Geprüft wird mit `stats().isOpaque`, nicht mit `hasAlpha` —
  viele PNGs tragen einen deckenden Alphakanal.
- **Posts dürfen ungeplant sein.** `postenAm` ist optional. Der Anlegen-Dialog
  fragt bewusst kein Datum ab — ein erfundener Termin ist schlechter als gar
  keiner. Ungeplante Posts stehen im Kalender in der Spalte „Ungeplant" und
  werden von dort auf einen Tag gezogen. Sie erscheinen in **keinem** Export
  (`postsImZeitraum` und `feedVorschau` sieben sie aus).
- **Uhrzeit beim Verschieben.** Aus „Ungeplant" auf einen Tag gezogen bekommt
  ein Post die `standardUhrzeit` des Kunden aus den Stammdaten. Wird ein bereits
  terminierter Post umgelegt, **bleibt seine Uhrzeit** — wer ihn zwei Tage
  schiebt, will die Zeit nicht neu setzen (`postTerminieren`).
- **Freigaben hängen am einzelnen Post, nicht am Link** — und es sind zwei:
  Konzept vor dem Dreh, Vorschau danach. Welche ansteht, ergibt sich aus dem
  Status (`src/lib/freigabe.ts`), nie aus dem Formular. Das Team kann eine
  Freigabe stellvertretend eintragen; solche Einträge lösen keine
  Benachrichtigung aus.
- **Freigabe-Links öffnen sich nie ohne Anmeldung.** Dreistufig wie in Klappe:
  E-Mail → Code → Name. Die Gast-Sitzung gilt 40 Tage. Ein Gast mit leerem
  Namen bedeutet „Anmeldung noch nicht abgeschlossen". **Ausnahme:** Wer am
  Team angemeldet ist, kommt ohne Gast-Anmeldung durch und sieht dieselbe
  Seite — mit Vorschau-Banner. Solche Besuche zählen nicht als Aufruf, und
  eine so eingetragene Freigabe löst keine Benachrichtigung aus.
- **Die Anmeldeseite hat eine Mailzeile für alle.** Was folgt, entscheidet die
  Adresse: eigene Domäne (`m365Domaenen`) → Microsoft, bekannter Gast → Code
  per Mail, sonst Passwort — und das nur, wenn lokale Konten eingeschaltet
  sind. Über Microsoft entsteht ein Konto beim ersten Anmelden, aber **nur**
  für eingetragene Domänen; leeres Feld heißt: keine Selbstregistrierung.
  Position, Telefon und Profilbild kommen aus Graph (`User.Read`) und nur in
  Felder, die noch leer sind.
- **Klappe-Videos sind immer projektbezogen.** Die Auswahl zeigt nur Videos aus
  dem Klappe-Projekt des Kunden; ohne Zuordnung in den Stammdaten bleibt sie
  leer. Beim Anlegen eines Reels entsteht dort automatisch das Video.
- **Export ist eine Live-Sicht, kein Schnappschuss.** Änderungen an Posts
  erscheinen sofort im Freigabe-Link.
- **Feed-Vorschau extern vs. intern.** Der Kunde sieht ältere/veröffentlichte
  Posts und die freigegebenen des Zeitraums — nichts, was zeitlich **nach** dem
  letzten Post des Zeitraums liegt. Intern sind alle Posts sichtbar, inkl. der
  noch nicht freigegebenen, mit Status je Kachel.
- **ZIP-Dateinamen.** `JJMMTT_HHMM_Post`, `_Reel`, `_Reel_Thumbnail`,
  `_Carousel_Slide1` … Da nie zwei Posts exakt zeitgleich erscheinen, sind sie
  ohne Zusatz eindeutig.
- **Status-Farben.** Konzept grau, Vorschau orange, Final grün — überall
  identisch. Post-Typen: Reel rot, Karussell blau, Beitrag grün.
- **Medien-Upload läuft über den Geräterahmen.** Kein eigener Ablagebereich im
  Formular: Die leere Fläche im iPhone-Mockup ist der Knopf, ein Klick öffnet
  `MedienDialog` — und der zeigt je Post-Typ etwas anderes (Beitrag: eine
  Ablage; Karussell: Einzelslides oder Gesamtbild mit erkannter Slide-Zahl;
  Reel: Video, Thumbnail, Referenzvideo-Link und das finale Video aus Klappe).
  Die Slide-Zahl wird schon im Browser aus den Bildmaßen ermittelt, damit sie
  vor dem Upload dasteht.
- **Instagram gibt Reels nur an eine angemeldete Sitzung heraus** — auch die,
  die im privaten Browserfenster laufen. Weder eine neuere yt-dlp-Fassung noch
  ein Browser-User-Agent ändern das. Der dokumentierte Weg ist eine
  `cookies.txt`; sie liegt in den Einstellungen (`instagramCookies`) und wird
  nur für die Dauer des Laufs in den Temp-Ordner geschrieben. YouTube, TikTok
  und Vimeo brauchen sie nicht.
- **Referenzvideo lädt im Hintergrund.** `yt-dlp` und `ffmpeg` stecken im
  Abbild. Der Download läuft außerhalb der Anfrage weiter, sein Stand liegt am
  Post (`referenzVideoStand`, `-Fortschritt`, `-Meldung`) — nur so überlebt er
  das Schließen des Dialogs. Der Editor fragt über `/api/posts/<id>/referenz`
  nach. Bewusst **kein** Worker: siehe `src/lib/referenz-auftrag.ts`. Ein
  Neustart des Containers verliert einen laufenden Download; er steht dann auf
  `LAEUFT` und wird neu angestoßen.
- **Reel ohne Thumbnail bekommt ein Standbild.** Beim Video-Upload zieht
  `ffmpeg` ein Bild bei Sekunde 1 — Sekunde 0 ist oft schwarz. Nur wenn noch
  keins hinterlegt ist.
- **Referenzvideo und Länge nur beim Reel.** Beides ergibt bei Standbildern
  keinen Sinn. Der Referenz-Link lebt im Medien-Dialog, nicht im Hauptformular —
  `postSpeichern` darf ihn deshalb nur schreiben, wenn das Feld auch mitkommt
  (`formular.has('referenzVideoUrl')`), sonst löscht ein Speichern ihn still.

## Design

**Funktionalität kommt aus Notion, Optik aus Claude Design.** Wo Mockup und
Konzepttext auseinandergehen, entscheidet das Konzept, *was* etwas tut — und das
Mockup, *wie* es aussieht. Vor einem neuen Bildschirm erst das passende Mockup
öffnen, Maße und Abstände dort ablesen, dann bauen. Nicht umgekehrt.

Die Mockups liegen unter `design/` und sind die verbindliche Vorlage:

| Datei | Inhalt |
| --- | --- |
| `Export-Seite Kunde.dc.html` | 1a Desktop, 1b Mobile, 1c Kommentare |
| `Backend.dc.html` | 2a–2i: Kundenübersicht bis Ansprechpartner |
| `iPhone-Layer.dc.html` | 3a–3d: Geräterahmen je Post-Typ |

Die **Arbeitsfläche des Backends ist weiß**, die Seitenleiste leicht getönt
(`flaeche-leise`) — wie in den Mockups. Karten tragen ihren Rahmen, nicht den
Kontrast zum Hintergrund. Umgekehrt (graue Fläche, weiße Karten) wirkt
schwerer und war nie so gezeichnet.

Optik: hell, zurückhaltend, white-label-nah — die **Kundenmarke** steht im
Vordergrund, nicht das Werkzeug. Eine dezente Akzentfarbe (`#b00900`), Poppins
als Schrift, großzügige Abstände. Die Tokens stehen in `globals.css`; neue
Farben werden dort ergänzt statt im Bauteil hartkodiert.

Geräterahmen: 344 × 645 px außen, 320 × 621 px Bildschirm, Reel-Fläche
320 × 569 px (9:16), Kommentarzeile 52 px — **nur beim Reel**, sichtbar, aber
nicht bedienbar. In der Feed-Planung wächst der Rahmen mit dem Raster mit und
ist um 22 % vergrößert (`.geraet-gross`, `.geraet-waechst`); dort ist er
Arbeitsmittel, nicht bloß Vorschau.

## Struktur

```
src/
  app/
    (team)/          Agentur-Backend, Desktop-first, Login nötig
    f/[token]/       Öffentliche Export-Seite für Kunden
    portal/          Gast-Übersicht: alle eigenen Freigabe-Links
    api/             Route Handler (Upload, Medien, ZIP, Push)
  components/        Wiederverwendbare Bauteile
  lib/               Fachlogik, Datenbank, Mail, Push
design/              Mockups aus Claude Design (Vorlage, nicht anfassen)
prisma/              Schema, Migrationen, Beispieldaten
scripts/             Entwicklungs-Datenbank, Migrationslauf
```

## Zugänge

- **Team:** lokale Konten (E-Mail + Passwort). Microsoft 365 über Entra ID ist
  vorbereitet und wird in den Einstellungen scharfgeschaltet.
- **Kunden:** öffentlicher Freigabe-Link, wahlweise mit passwortloser Anmeldung
  per sechsstelligem Mail-Code. Angemeldete Gäste sehen unter `/portal` alle
  Links, zu denen sie eingeladen wurden, samt Freigabestatus.
- **Konfiguration** (Mail, M365, Klappe) liegt in der Datenbank, nicht in
  Umgebungsvariablen — damit sie ohne Neustart änderbar ist.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
