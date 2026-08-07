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

- **Typ und Format sind getrennt.** Der Typ sagt, **woraus** ein Beitrag
  besteht (ein Bild, mehrere Bilder, ein Video), das `Verhaeltnis` daneben,
  **wie er aussieht**. Zur Wahl steht je Typ ein fester Satz, das Erste ist
  der Standard (`src/lib/verhaeltnis.ts`):
  Beitrag **3:4**, 1:1 · Karussell **3:4**, 1:1, 9:16 · Reel **9:16**, 1:1,
  16:9. Ein Beitrag quer gibt es nicht — im Feed bliebe ein Streifen, im
  Raster ein Ausschnitt.
- **Ein hochkantes Video heißt Reel, dasselbe quer heißt Video.** Der Typ in
  der Datenbank bleibt `REEL`, nur das Wort ändert sich —
  `postBezeichnung(typ, verhaeltnis)`, und zwar überall: Etikett, Kalender,
  Liste, Kundenseite und ZIP-Dateiname. Nur 9:16 füllt außerdem den
  Geräteschirm; quer oder quadratisch steht das Video im Feed zwischen
  Kopfzeile und Caption, weil es dort auch erscheint. Abweichungen werden **gewarnt, nicht blockiert** — der
  Hinweis nennt erkanntes und erwartetes Format.
- **Instagrams Profilraster ist 3:4, nicht 4:5.** Seit der Umstellung 2025
  beschneidet Instagram dort jedes 4:5-Bild seitlich. Weil dieses Werkzeug
  im Raster plant, ist **3:4 (1080 × 1440) das erwartete Format** für
  Beiträge und Slides — dann ist der Ausschnitt im Raster das ganze Bild.
  Der Preis ist bewusst gewählt: Anderswo gilt 4:5 weiter als Standard, im
  Feed werden beide unbeschnitten gezeigt.
- **Beschnitten wird nur, was höher ist als das Raster.** Ein 9:16-Reel-
  Thumbnail bekommt den **mittigen 3:4-Ausschnitt**, wie bei Instagram — das
  ist die einzige Stelle, an der der Zuschnitt wirklich etwas tut. Ein
  Beitrag in 4:5 ist dagegen *breiter* als 3:4 und bleibt **unangetastet**:
  Ihn zu beschneiden hieße, seitlich wegzunehmen, was jemand bewusst
  gestaltet hat. Wie die Kachel ihn zeigt, entscheidet die Anzeige, nicht
  die Datei (`brauchtZuschnitt`). Logos und Profilbilder fallen damit auch
  heraus — sie sind quadratisch und standen nie im Raster.
- **4:5 bleibt hochladbar.** Für Altbestand. Es gibt nur eine Warnung, dass
  das aktuelle Format 3:4 ist — wie bei jeder Formatabweichung: gewarnt,
  nicht blockiert.
  Diesen Ausschnitt liefert `thumbUrl()` als fertige Datei. Er entsteht beim
  Upload — ändert sich das Zielformat, müssen Bestandsbilder über
  **Einstellungen → Vorschaubilder** neu zugeschnitten werden. Dieselbe
  Adresse trägt dann anderen Inhalt, deshalb ist die Vorschau-Variante
  **nicht** `immutable` gecacht, sondern kurzlebig mit ETag. Überall dort, wo
  das Thumbnail in voller Höhe steht — Geräterahmen, Medien-Dialog —, gehört
  deshalb `medienUrl()` hin: Das 4:5-Bild in eine 9:16-Fläche gelegt wird ein
  zweites Mal beschnitten, und übrig bleibt die Mitte der Mitte.
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
- **Kommentare: erledigen, antworten, ändern, erwähnen.** „Erledigt" schließt
  den ganzen Strang (Antworten zählen mit) und nimmt ihn aus der
  Benachrichtigungsseite — das macht **nur das Team**, denn es entscheidet,
  wann eine Anmerkung umgesetzt ist. **Ändern und löschen darf jede Person
  nur bei sich selbst, die Administration überall** (`kommentar-rechte.ts`);
  geprüft wird am Server, die Knöpfe sind Bequemlichkeit. Ein Strang ist
  flach: Auf eine Antwort wird nicht noch einmal geantwortet.
- **@-Erwähnungen stehen im Text.** Format `@[Name](n:<id>)` für Team,
  `(g:<id>)` für Gäste — der Name liegt mit im Text, damit ein Kommentar auch
  nach einer Umbenennung lesbar bleibt. Der Text ist die **einzige** Quelle
  dafür, wer erwähnt wurde; eine zweite Tabelle könnte auseinanderlaufen.
  Wer benachrichtigt wird, entscheidet trotzdem nicht der Text:
  `meldeNeuenKommentar` gleicht die Kennungen gegen den Kreis ab, der ohnehin
  Zutritt hat. Erwähnte bekommen eine eigene Meldung und sind vom allgemeinen
  Verteiler ausgenommen — zwei Mails zum selben Kommentar liest niemand gern.
  In Mail, Push und PDF steht schlichtes `@Name` (`alsKlartext`).
- **Export ist eine Live-Sicht, kein Schnappschuss.** Änderungen an Posts
  erscheinen sofort im Freigabe-Link.
- **Feed-Vorschau extern vs. intern.** Der Kunde sieht ältere/veröffentlichte
  Posts und die freigegebenen des Zeitraums — nichts, was zeitlich **nach** dem
  letzten Post des Zeitraums liegt. Intern sind alle Posts sichtbar, inkl. der
  noch nicht freigegebenen, mit Status je Kachel.
- **ZIP-Dateinamen.** `JJMMTT_HHMM_Post`, `_Reel` bzw. `_Video`,
  `_Reel_Thumbnail`,
  `_Carousel_Slide1` … Da nie zwei Posts exakt zeitgleich erscheinen, sind sie
  ohne Zusatz eindeutig.
- **Status-Farben.** Konzept grau, Vorschau orange, Final grün — überall
  identisch. Post-Typen: Reel rot, Karussell blau, Beitrag grün.
- **Uploads laufen in 4-MB-Blöcken.** Vor Preroll hängt ein
  Cloudflare-Tunnel, der keine Anfrage über 100 MB durchlässt — ein Reel am
  Stück lief in einen Abbruch, der sich wie ein Hänger anfühlte. Der Browser
  schickt Blöcke an `/api/upload/teil`, der Abschluss über `/api/upload` setzt
  sie zusammen (`upload-sitzung.ts`). Nebenbei gibt es dadurch einen echten
  Fortschrittsbalken. Bewusst **ohne** Wiederaufnahme nach Verbindungsabriss
  wie in Klappe: Preroll lädt Reels, keine 40-GB-Rushes.
- **Vier Stufen beim Kunden, „Gepostet" wird berechnet.** Konzept → Vorschau
  → Final → Gepostet. Die letzte steht **nicht** in der Datenbank: Final plus
  Termin in der Vergangenheit ergibt „Gepostet" (`abgeleiteteStufe`). Ein
  fünfter Wert müsste nachgezogen werden und könnte falsch stehen. Bei Kunden
  ohne Freigabepflicht fällt in den Erklärungen der Satz zur Freigabe weg.
- **Ein Video-Platz, drei Wege.** Upload, Klappe und Link-Download füllen
  beim Reel denselben Platz — das Video im Geräterahmen; ein eigenes
  „Referenzvideo" gibt es **nicht**, auch nicht als Extra-Anzeige beim
  Kunden. Upload und Download hängen die Datei als `MEDIUM` an und ersetzen,
  was dort lag; Klappe wird **nicht kopiert**, sondern über `/api/klappe`
  gestreamt, und die Fassungswahl räumt dafür das `MEDIUM` weg
  (`holeFassung`). Was gerade gilt, sagt `reelVideoQuelle`: eigenes `MEDIUM`
  vor Klappe-Fassung — so gewinnt immer die zuletzt getroffene Wahl.
  **Übernehmen heißt räumen:** Die anderen beiden Quellen werden dabei
  gelöst, nicht überdeckt — ein laufender Download wird abgebrochen und der
  Link geleert (sonst überschriebe der fertige Download später das frische
  Video), die Fassungswahl genullt. Ein überholter Download-Lauf erkennt das
  am Link (`videoDownloadUrl !== url`) und schreibt nichts mehr. In den
  **ZIP-Export** kommt eine Klappe-Fassung im Moment des Exports als
  Durchreiche (`klappeVideoFuersZip`) — Team: Original, Gast: Abspielfassung.
- **Medien-Upload läuft über den Geräterahmen.** Kein eigener Ablagebereich im
  Formular: Die leere Fläche im iPhone-Mockup ist der Knopf, ein Klick öffnet
  `MedienDialog` — und der zeigt je Post-Typ etwas anderes (Beitrag: eine
  Ablage; Karussell: Einzelslides oder Gesamtbild mit erkannter Slide-Zahl;
  Reel: zwei Spalten — links das Video mit seinen drei Quellen, rechts das
  Thumbnail).
  Die Slide-Zahl wird schon im Browser aus den Bildmaßen ermittelt, damit sie
  vor dem Upload dasteht.
- **Instagram gibt Reels nur an eine angemeldete Sitzung heraus** — auch die,
  die im privaten Browserfenster laufen. Weder eine neuere yt-dlp-Fassung noch
  ein Browser-User-Agent ändern das. Der dokumentierte Weg ist eine
  mitgebrachte Sitzung. **Ein Login-Fenster in Preroll ist unmöglich** — ein
  Fenster auf `instagram.com` gehört einer fremden Herkunft, deren Cookies
  Preroll nicht lesen darf, und `sessionid` ist zusätzlich `HttpOnly`. Wer
  danach fragt, bekommt diese Begründung, keinen Versuch.
  Hinterlegt wird entweder eine ganze `cookies.txt` oder nur der Wert von
  `sessionid` (`alsCookiedatei` baut daraus die Datei). Sie liegt in den
  Einstellungen und wird nur für die Dauer eines Laufs in den Temp-Ordner
  geschrieben. Scheitert ein Download an der Anmeldung, steht das danach in
  den Einstellungen — nicht nur an dem einen Post, und als rotes Band über dem
  ganzen Backend. Preroll prüft die Sitzung **höchstens einmal am Tag** an
  einem hinterlegten Reel-Link (`wacheUeberSitzung`, angestoßen vom
  Team-Layout — Preroll hat keinen Zeitplaner) und meldet den Ablauf **einmal**
  an die Administration. YouTube, TikTok und Vimeo brauchen nichts davon.
- **Profil-Kennzahlen kommen ohne Anmeldung.** Follower, Gefolgt, Beiträge,
  Bio, Website und — nur falls noch keins da ist — das Profilbild, über
  `web_profile_info`. **Gefragt wird ohne Cookie**; nachgemessen antwortet
  der Endpunkt so mit 200. Die für die Videos hinterlegte Sitzung bleibt
  damit aus dem Spiel und kommt nur als zweiter Versuch, falls die anonyme
  Anfrage abgewiesen wird. Ein Fehlschlag hier löst deshalb **nie** das
  Warnband für abgelaufene Sitzungen aus — er sagt nichts über sie aus.
  Umgekehrt gebaut ging es schief: Eine Sitzung aus nur `sessionid` (ohne
  `csrftoken`) quittiert dieser Endpunkt mit **400**, während derselbe
  Cookie im Reel-Download klaglos funktionierte. Wer angemeldet fragt, muss
  `csrftoken` doppelt schicken — im Cookie und als `x-csrftoken`. Der
  Abrufrhythmus bleibt trotzdem sparsam: ein Profil je Lauf, Läufe alle 20
  Minuten, jedes Profil höchstens einmal am Tag, angestoßen vom Team-Layout.
  Die Graph API bleibt der Plan, sobald das App Review durch ist
  (`KennzahlenQuelle.GRAPH_API` steht schon).
- **`#HttpOnly_` gehört zur cookies.txt.** Browser-Erweiterungen schreiben
  HttpOnly-Cookies mit diesem Präfix — und ausgerechnet `sessionid` ist
  HttpOnly. Wer die Zeile für einen Kommentar hält, wirft genau das weg,
  worauf es ankommt (`cookieKopfzeile`).
- **Der Link-Download läuft im Hintergrund.** `yt-dlp` und `ffmpeg` stecken
  im Abbild. Der Download läuft außerhalb der Anfrage weiter, sein Stand
  liegt am Post (`videoDownloadStand`, `-Fortschritt`, `-Meldung`) — nur so
  überlebt er das Schließen des Dialogs. Der Editor fragt über
  `/api/posts/<id>/video-download` nach. Bewusst **kein** Worker: siehe
  `src/lib/video-download.ts`. Ein Neustart des Containers verliert einen
  laufenden Download; er steht dann auf `LAEUFT` und wird neu angestoßen.
- **Reel ohne Thumbnail bekommt ein Standbild.** Beim Video-Upload zieht
  `ffmpeg` ein Bild bei Sekunde 1 — Sekunde 0 ist oft schwarz. Nur wenn noch
  keins hinterlegt ist.
- **Link-Download und Länge nur beim Reel.** Beides ergibt bei Standbildern
  keinen Sinn. Das Link-Feld lebt im Medien-Dialog mit eigener Aktion
  (`videoVonLinkLaden`) — `postSpeichern` fasst es nie an.

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

Die Kundenseite wird oft am Telefon geöffnet. Was dort anders läuft:
Karussells lassen sich **wischen** (nur waagerecht, sonst blättert jedes
Scrollen), die Statusleiste steht **mittig** und öffnet ihre Erklärung per
**Tipp** statt Überfahren, und das Portrait im Kontakt-Fuß steht **rechts an
der Kante** — sein Namensschild ragt nach links heraus und liefe links
angeschlagen aus dem Bild.

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
