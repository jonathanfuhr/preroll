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

Der **Produktionsbuild wird ohne laufende Datenbank geprüft** — mit laufender
verdeckte er einmal ein fehlendes `force-dynamic`. Aus demselben Grund trägt
`(team)/layout.tsx` die Zeile `export const dynamic = 'force-dynamic'`: Unter
`(team)` steht nichts ohne Anmeldung, statisch kann dort also nichts sein.
Ohne die Zeile versucht Next es beim Bauen trotzdem, und jede Seite, die ihre
Daten holt, **bevor** sie `cookies()` oder `searchParams` anfasst, setzt dabei
eine Datenbankabfrage ab, die ins Leere läuft. Die Reihenfolge in jeder neuen
Seite zu bewachen wäre die schlechtere Regel.

## Fachliche Regeln, die leicht verloren gehen

- **Typ und Format sind getrennt.** Der Typ sagt, **woraus** ein Beitrag
  besteht (ein Bild, mehrere Bilder, ein Video), das `Verhaeltnis` daneben,
  **wie er aussieht**. Zur Wahl steht je Typ ein fester Satz, das Erste ist
  der Standard (`src/lib/verhaeltnis.ts`):
  Beitrag **4:5**, 1:1, 3:4 · Karussell **4:5**, 1:1, 9:16, 3:4 · Reel
  **9:16**, 1:1, 16:9. Ein Beitrag quer gibt es nicht — im Feed bliebe ein
  Streifen, im Raster ein Ausschnitt. **3:4 steht hinten** und nur für den
  Bestand aus den zehn Tagen, in denen es Standard war.
- **Ein hochkantes Video heißt Reel, dasselbe quer heißt Video.** Der Typ in
  der Datenbank bleibt `REEL`, nur das Wort ändert sich —
  `postBezeichnung(typ, verhaeltnis)`, und zwar überall: Etikett, Kalender,
  Liste, Kundenseite und ZIP-Dateiname. Nur 9:16 füllt außerdem den
  Geräteschirm; quer oder quadratisch steht das Video im Feed zwischen
  Kopfzeile und Caption, weil es dort auch erscheint. Abweichungen werden **gewarnt, nicht blockiert** — der
  Hinweis nennt erkanntes und erwartetes Format.
- **Gestaltet wird in 4:5 — das Raster ist trotzdem 3:4.** Zwei Fragen, die
  einmal in einem Wert steckten (`VERHAELTNIS.hochkant`) und genau deshalb
  falsch beantwortet wurden. Zwischen dem 07. und 17.08.2026 war **3:4** das
  erwartete Format für Beiträge und Slides, weil Instagrams Profilraster seit
  2025 so aussieht und dieses Werkzeug im Raster plant. Der Gedanke war einen
  Schritt zu weit: **Posten lässt sich nur bis 4:5.** Ein in 3:4 gestaltetes
  Bild verliert oben und unten, bevor es überhaupt im Raster landet — der
  Verlust liegt also im Beitrag, den der Kunde sieht, nicht bloß in der
  Kachel. Erwartet wird deshalb **4:5 (1080 × 1350)**; `VERHAELTNIS.raster`
  bleibt 3:4 und heißt jetzt so, damit die Vermischung nicht zurückkommt.
- **Beschnitten wird nur, was höher ist als das Raster.** Ein 9:16-Reel-
  Thumbnail bekommt den **mittigen 3:4-Ausschnitt**, wie bei Instagram — das
  ist die einzige Stelle, an der der Zuschnitt *an der Datei* etwas tut. Ein
  Beitrag in 4:5 ist *breiter* als 3:4 und bleibt **unangetastet**; im Raster
  erscheint er ebenfalls als Ausschnitt, aber der entsteht an der Kachel
  (`aspect-[3/4]` mit `object-cover`). Ihn schon beim Upload zu schneiden
  hieße, seitlich wegzunehmen, was jemand bewusst gestaltet hat — und im
  Geräterahmen, wo derselbe Beitrag in voller Breite steht, fehlte es dann
  (`brauchtZuschnitt`). Logos und Profilbilder fallen ebenfalls heraus: sie
  sind quadratisch und standen nie im Raster.
- **3:4 bleibt wählbar und hochladbar.** Für den Bestand aus jenen zehn Tagen.
  Ein 3:4-Bild an einem 4:5-Beitrag löst die übliche Formatwarnung aus —
  gewarnt, nicht blockiert; das ist nach der Umstellung der häufigste Fall
  (eine Canva-Vorlage im alten Maß). Der Wert der vorhandenen Beiträge wird
  **nicht** umgestellt: Ihre Dateien liegen in 3:4, und in einer 4:5-Fläche
  gezeigt fehlte oben und unten etwas.
- **Ein Wechsel des Zielformats schneidet nichts nach.** Für den Weg von 4:5
  auf 3:4 gab es in den Einstellungen einen Knopf, der den Bestand neu
  zuschnitt (Vorlage: Commit `440f70e`); zurück brauchte es ihn nicht, weil
  4:5 ohnehin nie beschnitten wurde. Käme das Raster einmal in Bewegung,
  gehört er neu gebaut. Den Rasterausschnitt liefert `thumbUrl()` als fertige
  Datei, erzeugt beim Upload. Dieselbe Adresse kann anderen Inhalt tragen,
  deshalb ist die Vorschau-Variante **nicht** `immutable` gecacht, sondern
  kurzlebig mit ETag. Überall dort, wo das Bild in voller Höhe steht —
  Geräterahmen, Medien-Dialog —, gehört `medienUrl()` hin: das schon
  geschnittene Thumbnail in eine 9:16-Fläche gelegt wird ein zweites Mal
  beschnitten, und übrig bleibt die Mitte der Mitte.
- **Ohne Kanal keine Marke.** Die Plattform-Zeichen an einem Beitrag sind
  eine Aussage über die Wirklichkeit — „erscheint auf Instagram und
  Facebook". Ist beim Kunden keine Facebook-Seite zugeordnet, plant die
  Agentur bloß und postet von Hand; dann darf **nirgends** ein Zeichen
  stehen: nicht in der Post-Liste, nicht im Kunden- und nicht im
  Gesamtkalender, nicht auf der Kundenseite. Keine Anzeige nimmt
  `post.plattformen` roh — die rohe Wahl ist die **Absicht** und bleibt
  stehen, auch wenn der Kanal fehlt. Gezeigt wird `angezeigtePlattformen`,
  dieselbe Rechnung, mit der `veroeffentlichung.ts` die Läufe anlegt.
- **Meta-Zugänge sind mehrere.** Nicht jeder Kunde liegt im selben
  Portfolio; wer Seiten aus zwei Business Managern bespielt, braucht aus
  jedem einen eigenen Systemnutzer. In den Einstellungen steht deshalb eine
  **Liste** von Zugängen, jeder mit eigenem Prüfen und Entfernen. Nach außen
  sieht man davon möglichst wenig: Die Seitenauswahl in den Stammdaten zeigt
  **alle** Seiten aus **allen** Zugängen in einer Liste
  (`fasseSeitenZusammen`) — wer einen Kunden einrichtet, sucht seine Seite,
  nicht seinen Business Manager. Eine doppelt zugewiesene Seite erscheint
  einmal, am ältesten Zugang; welcher Zugang gilt, kommt beim Zuordnen von
  **der Seite** (`seite.zugangId`), nicht von „dem einen".
- **Karussell-Auftrennung.** Geht die Breite nicht glatt im 4:5-Raster auf, gibt
  es **keine manuellen Schnittkanten**, sondern eine Fehlermeldung. Bewusst
  simpel: korrekt exportierte Canva-Dateien passen immer. Die Bedienelemente
  „Schnittkanten ausrichten" und „Überlappung" aus Mockup 2g sind bewusst
  **nicht** gebaut — der einzige Punkt, an dem die Optik dem Konzept weicht.
- **Transparente Pixel** in Post-Grafiken sind praktisch immer ein Versehen und
  werden gewarnt. Geprüft wird mit `stats().isOpaque`, nicht mit `hasAlpha` —
  viele PNGs tragen einen deckenden Alphakanal.
- **In der Post-Liste führen drei Wege in den Beitrag** — Vorschaubild, Typ
  und Titel. Das Bild allein war ein zu kleines Ziel. Der **Termin dagegen
  öffnet ein kleines Fenster** mit Datum, Uhrzeit, OK und Abbrechen: Umplanen
  war sonst nur über den Kalender oder das Formular im Beitrag zu haben, und
  für „der geht doch erst Donnerstag raus" ist beides zu weit. Bewusst kein
  Speichern beim Tippen — ein Zwischenstand aus neuem Tag und alter Uhrzeit
  wäre ein Termin, den niemand gewollt hat. Ein **leeres Datum** stellt den
  Beitrag zurück auf „Ungeplant" (`postTerminSetzen`); das ist ein gültiger
  Stand und braucht keinen eigenen Knopf.
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
- **`#intern` behält einen Kommentar im Haus.** Für Abstimmungen, die den
  Kunden nichts angehen. Die Marke am Wortanfang genügt (`istIntern`), und
  **nur das Team** setzt sie — beim Gast ist `#intern` gewöhnlicher Text.
  Was daran hängt: keine Anzeige beim Kunden, keine Mail, kein Push, keine
  Erwähnung nach außen, nicht in seiner Kommentarzahl. Eine **Antwort erbt**
  den Zustand ihres Strangs: Ohne die Erbregel stünde ein „ja, machen wir"
  plötzlich allein beim Kunden. Abgeleitet wird beim Schreiben und in
  `Kommentar.intern` festgehalten (`kommentar-intern.ts`), damit schon die
  **Abfrage** filtert — Vertraulichkeit, die an einer vergessenen Bedingung
  im Bauteil hängt, ist keine. Auf der Kundenseite sieht das Team seine
  internen Kommentare trotzdem, markiert: Sonst verschwände die eigene
  Antwort im Moment des Abschickens.
- **@-Erwähnungen stehen im Text.** Format `@[Name](n:<id>)` für Team,
  `(g:<id>)` für Gäste — der Name liegt mit im Text, damit ein Kommentar auch
  nach einer Umbenennung lesbar bleibt. Der Text ist die **einzige** Quelle
  dafür, wer erwähnt wurde; eine zweite Tabelle könnte auseinanderlaufen.
  Wer benachrichtigt wird, entscheidet trotzdem nicht der Text:
  `meldeNeuenKommentar` gleicht die Kennungen gegen den Kreis ab, der ohnehin
  Zutritt hat. Erwähnte bekommen eine eigene Meldung und sind vom allgemeinen
  Verteiler ausgenommen — zwei Mails zum selben Kommentar liest niemand gern.
  In Mail, Push und PDF steht schlichtes `@Name` (`alsKlartext`).
- **Ein Freigabelink je Kunde, nicht je Monat.** `Export` ist `@@unique` auf
  `kundeId`; der Monat steht in der Adresse (`/f/<token>?monat=2026-08`).
  Zwischenzeitlich war jeder Monat eine eigene Zeile mit eigenem Token — das
  hieß jeden Monat eine neue Einladung, und ein Gast aus dem August kam im
  September nicht mehr hinein. Der Monat ist keine Eigenschaft des Zugangs,
  sondern eine Sicht darin.
- **Welche Monate es gibt, sagen die Beiträge** (`monateAusPosts`): Ein Monat
  erscheint, sobald ein vorzeigbarer Beitrag mit Termin darin steht —
  `ENTWURF` und Ungeplantes zählen nicht. Vorher konnte ein Monat mit
  Beiträgen unerreichbar sein, weil niemand eine Freigabe dafür angelegt
  hatte, und ein angelegter leerer Monat stand in der Leiste. Ohne Angabe
  zeigt die Seite den **neuesten** Monat: Wer einen Link bekommt, will den
  Plan sehen, für den er ihn bekommen hat (`gewaehlterMonat`). Ein Monat, den
  es nicht gibt, fällt still auf diesen zurück statt zu scheitern.
- Der Kunde wechselt über die **Monats-Seitenleiste** — am linken
  Bildschirmrand, über die volle Höhe, gebaut wie die Navigation im Backend
  (samt Marke; die Topbar lässt ihre dann weg). Am Telefon wird daraus eine
  waagerechte Reihe unter der Kopfzeile. Was früher je Link einstellbar war,
  ist entfallen: Kommentare sind immer erlaubt, Freigaben richten sich nach
  `Kunde.freigabenNoetig`, Konzepte werden immer gezeigt, und eine
  Ablauffrist gibt es nicht mehr. Heißt in der Oberfläche **Freigaben**,
  nicht mehr Export.
- **Der ZIP-Zeitraum ist frei wählbar, der des Kunden nicht.** Das Team gibt
  `von`/`bis` in der Adresse mit — „von der Konzeptrunde bis zum Dreh" hält
  sich nicht an Monatsgrenzen. Ein Gast bekommt immer genau einen Monat und
  nur `FINAL`: Ihm einen freien Zeitraum zu erlauben hieße, ihm über die
  Adresse den ganzen Bestand zu geben.
- **Export ist eine Live-Sicht, kein Schnappschuss.** Änderungen an Posts
  erscheinen sofort im Freigabe-Link.
- **Sprungmarken sind schlichte `<a>`, kein `next/link`.** Kalender und
  Feed-Kacheln der Kundenseite zeigen mit `#post-<id>` auf den Beitrag
  weiter unten. Über `next/link` behandelt der Router den Klick als
  Navigation: Er springt zwar zur Marke, setzt danach aber die Rollposition
  zurück auf 0 — man landet wieder ganz oben. `Sprung` (`sprung.tsx`)
  wählt anhand des `#` das Richtige. Gerollt wird sanft
  (`scroll-behavior`), außer bei `prefers-reduced-motion`: Zwischen Kachel
  und Beitrag liegt schnell ein ganzer Bildschirm, und ohne Bewegung wirkt
  das wie ein Seitenwechsel. Verlinkt sind nur Kacheln **des Zeitraums** —
  zu den älteren gibt es auf der Seite nichts, wohin man springen könnte.
- **Feed-Vorschau extern vs. intern.** Der Kunde sieht ältere/veröffentlichte
  Posts und die freigegebenen des Zeitraums — nichts, was zeitlich **nach** dem
  letzten Post des Zeitraums liegt. Intern sind alle Posts sichtbar, inkl. der
  noch nicht freigegebenen, mit Status je Kachel.
- **ZIP-Dateinamen.** `JJMMTT_HHMM_Post`, `_Reel` bzw. `_Video`,
  `_Reel_Thumbnail`,
  `_Carousel_Slide1` … Da nie zwei Posts exakt zeitgleich erscheinen, sind sie
  ohne Zusatz eindeutig.
- **Status-Farben.** Konzept grau, Vorschau orange, Final grün, Gepostet
  dunkelgrün und als **volle** Fläche statt zarter — überall identisch. Zwei
  ähnlich helle Grüntöne wären schlechter zu unterscheiden als hell gegen
  dunkel. Post-Typen: Reel rot, Karussell blau, Beitrag grün. **Ausnahme:** Im
  Kalender über alle Kunden trägt der Punkt die **Kundenfarbe**
  (`kundenFarbe`, aus dem Slug abgeleitet), nicht die Typfarbe — dort ist die
  Frage „von wem" wichtiger als „was".
- **Uploads laufen in 4-MB-Blöcken.** Vor Preroll hängt ein
  Cloudflare-Tunnel, der keine Anfrage über 100 MB durchlässt — ein Reel am
  Stück lief in einen Abbruch, der sich wie ein Hänger anfühlte. Der Browser
  schickt Blöcke an `/api/upload/teil`, der Abschluss über `/api/upload` setzt
  sie zusammen (`upload-sitzung.ts`). Nebenbei gibt es dadurch einen echten
  Fortschrittsbalken. Bewusst **ohne** Wiederaufnahme nach Verbindungsabriss
  wie in Klappe: Preroll lädt Reels, keine 40-GB-Rushes.
- **Fünf Phasen intern, vier beim Kunden.** Entwurf → Konzept → Vorschau →
  Final, dazu berechnet „Gepostet". **`ENTWURF` verlässt das Haus nie:** in
  keiner Freigabe, in keinem Raster, ohne Gegenstück in der Kunden-Zeitleiste
  (`postsImZeitraum` siebt ihn aus). Neu angelegte Posts starten dort. Das
  ersetzt den früheren Schalter „Konzepte mitzeigen" am Link — ob ein Beitrag
  vorzeigbar ist, hängt am Beitrag, nicht am Monat.
- **„Gepostet" wird berechnet, innen wie außen.** Final plus Termin in der
  Vergangenheit ergibt „Gepostet". Die Stufe steht **nicht** in der Datenbank:
  Ein fünfter Wert müsste nachgezogen werden und stünde falsch, sobald ein
  Termin nachträglich verschoben wird — so ergibt ein Termin in der Zukunft
  automatisch wieder „Final". Gerechnet wird an einer Stelle
  (`anzeigePhase`); `abgeleiteteStufe` ist nur die Kundensicht darauf und
  bildet zusätzlich `ENTWURF` auf Konzept ab. Beim Kunden sind es damit vier
  Stufen (Konzept → Vorschau → Final → Gepostet), intern fünf.
  **`StatusBadge` verlangt `postenAm` und die Veröffentlichungszeilen als
  Pflichtangaben** — ohne den Termin ließe sich ein veröffentlichter Beitrag
  nicht von einem wartenden unterscheiden, und der Typ zwingt jede
  Fundstelle, beides mitzugeben. Ein leeres Array heißt ausdrücklich „hier
  postet Preroll nicht"; dann entscheidet allein die Uhr. Wo Preroll postet,
  schlägt der Beleg die Uhr, und intern kommt **Fehlgeschlagen** als sechste
  Anzeigephase dazu — beim Kunden nie, `abgeleiteteStufe` bekommt die Zeilen
  gar nicht erst. Setzen lassen sich weiterhin nur die vier echten Phasen; im
  Editor steht „Gepostet" deshalb als Etikett neben dem Umschalter, nicht als
  fünfter Knopf. Bei Kunden ohne Freigabepflicht fällt in den Erklärungen der
  Satz zur Freigabe weg.
- **Plattformen: wählbar ist nur, was eingerichtet ist.** Die Wahl in den
  Stammdaten (`Kunde.plattformen`) ist die **Vorbelegung**, die am Beitrag
  (`Post.plattformen`) die **Entscheidung** — mehr als sein Kunde kann ein
  Beitrag nie. Darüber steht die Zuordnung (`fbSeitenId`, `igKontoId`): Ohne
  zugeordneten Kanal lässt sich eine Plattform **gar nicht erst anhaken**.
  Sie steht gesperrt da, mit Grund — ein Häkchen, das nichts bewirkt, wäre
  eine Falle, und Warnen statt Verhindern ist hier die schwächere Lösung
  (anders als bei Formatabweichungen beim Upload, die gewarnt und nicht
  blockiert werden). Gerechnet wird an einer Stelle: `moeglichePlattformen`
  (was eingerichtet ist), `effektivePlattformen` (Wahl ∩ eingerichtet) und
  `zielPlattformen` (was der Abgleich einplant). **Abgeleitet, nicht
  nachgeführt** — fällt ein Kanal weg, schrumpft die Wahl von selbst und
  steht wieder da, sobald er zurück ist; deshalb räumt auch niemand die
  gespeicherte Liste auf. Der Preis ist die Kopplung: Ein Kunde ohne
  zugeordnete Seite hat keine Plattformen und damit keine Marken. Wer nur
  planen und weiter von Hand posten will, ordnet die Seite trotzdem zu —
  `postenAktiv` bleibt davon unberührt. Die Wahl am Beitrag zieht **nicht**
  automatisch mit, wenn sie am Kunden wechselt: Das erledigt ein eigener
  Haken, und nur für Beiträge, die noch nicht draußen sind. Gezeigt wird sie
  einfarbig (`PlattformMarken`, nie in Markenfarben) in Post-Liste, beiden
  Kalendern und in der Kopfzeile jedes Beitrags auf der Kundenseite.
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

**Das Backend ist Desktop-first, aber nicht Desktop-only.** Unterwegs
schaut jemand nach, was ansteht, oder schiebt einen Beitrag weiter — das
muss gehen. Ab **`md` (768 px)** steht die Seitenleiste am Rand, darunter
liegt derselbe Inhalt in einer **Schublade** hinter dem Knopf in der
Kopfzeile (`Navigationsknopf`); 224 px feste Leiste ließen von 390 px
nichts übrig. Was breiter ist als der Bildschirm — **Post-Tabelle und
Monatskalender** — rollt **waagerecht in seiner Karte**, nie die Seite.
Spalten werden dabei nicht weggelassen, nur umsortiert nach Wichtigkeit:
Die KW steht am Telefon nicht mit (sie ist aus dem Datum ablesbar), die
Uhrzeit rutscht unter das Datum, und das Vorschaubild wird kleiner —
zusammen genug, damit **Datum, Typ und Titel ohne Rollen im Bild sind**.
Zweispaltige Formulare stapeln unter `sm`. Dialoge tragen am Telefon
schmalere Ränder (`px-3`, `p-5`).

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
nicht bedienbar. In der Feed-Planung ist er um 22 % vergrößert
(`.geraet-gross`); dort ist er Arbeitsmittel, nicht bloß Vorschau.

**Das Profilraster rollt im Gerät, das Gerät wächst nicht.** Bei 3:4 passen
in die festen 621 px nur 2,8 Reihen — vorher verschwand der Rest unter dem,
was folgte. Der Rahmen behält trotzdem seine Maße: Ein Telefon, das mit dem
Raster mitwächst, ist irgendwann kein Telefon mehr. Gerollt wird deshalb
**im Schirm** (`overflow-y`), und zwar alles ab dem Profilnamen. Die
**Statusleiste bleibt stehen** und liegt auf Weiß — Uhrzeit und Akku
wandern am echten Telefon auch nicht mit.

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
