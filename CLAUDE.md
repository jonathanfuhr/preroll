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
  simpel: korrekt exportierte Canva-Dateien passen immer.
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

## Design

Die Mockups liegen unter `design/` und sind die verbindliche Vorlage:

| Datei | Inhalt |
| --- | --- |
| `Export-Seite Kunde.dc.html` | 1a Desktop, 1b Mobile, 1c Kommentare |
| `Backend.dc.html` | 2a–2i: Kundenübersicht bis Ansprechpartner |
| `iPhone-Layer.dc.html` | 3a–3d: Geräterahmen je Post-Typ |

Optik: hell, zurückhaltend, white-label-nah — die **Kundenmarke** steht im
Vordergrund, nicht das Werkzeug. Eine dezente Akzentfarbe (`#b00900`), Poppins
als Schrift, großzügige Abstände. Die Tokens stehen in `globals.css`; neue
Farben werden dort ergänzt statt im Bauteil hartkodiert.

Geräterahmen: 344 × 645 px außen, 320 × 621 px Bildschirm, Reel-Fläche
320 × 569 px (9:16), Kommentarzeile 52 px — **nur beim Reel**, sichtbar, aber
nicht bedienbar.

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
