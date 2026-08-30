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
- **Je Plattform drei Zustände: aus, nur planen, planen und posten.** Der
  mittlere ist der Normalfall — für Instagram planen, von Hand posten. Vorher
  hieß „gewählt" zugleich „Preroll postet das", und wählbar war nur, wofür ein
  Kanal zugeordnet war; damit ließ sich der Normalfall nicht ausdrücken.
  **Einen Kanal braucht nur „planen und posten"** (`moeglichePlattformen`);
  ohne ihn steht die Stufe gesperrt da, und der Server stuft sie auf „planen"
  herunter, falls sie doch ankommt. Gespeichert wird als zwei Listen —
  `plattformen` (bespielt) und `postenPlattformen` (davon selbst gepostet);
  `postenAktiv` bleibt als Spalte, wird aber beim Speichern **abgeleitet**
  (`postenPlattformen.length > 0`), weil Zeitplaner und Einstellungen darauf
  filtern. Wohin Preroll wirklich postet, rechnet `postenZiele`: Beitrag ∩
  Modus ∩ Kanal.
- **Die Marken zeigen die Planung, nicht den Kanal.** „Erscheint auf
  Instagram und Facebook" — ob Preroll das hochlädt oder jemand von Hand,
  ändert daran nichts. Gezeigt wird deshalb `angezeigtePlattformen`: die Wahl
  am Beitrag, geschnitten mit dem, was der Kunde **bespielt** (Modus ≠ aus).
  Keine Anzeige nimmt `post.plattformen` roh — die rohe Wahl ist die
  **Absicht** und bleibt stehen, auch wenn der Kunde die Plattform später
  abschaltet. (Bis zum 17.08.2026 hing die Marke am Kanal; das war richtig,
  solange es „nur planen" nicht gab.)
- **LinkedIn hat einen Zugang, Meta mehrere.** Bei Meta braucht es je
  Business-Portfolio einen Systemnutzer; bei LinkedIn hängt alles an *einem*
  Konto der Agentur, das an den Firmenseiten der Kunden Administrator ist. Ein
  zweites wäre kein anderer Zugang, sondern ein anderer Mensch. Erzwungen wird
  das im Code (`speichereLinkedInZugang` ersetzt), nicht im Schema — ein Unique
  auf `plattform` würde auch Meta auf einen Zugang begrenzen.
- **Der LinkedIn-Token läuft ab, der von Meta nicht.** 60 Tage, dazu ein
  Auffrischungstoken. Erneuert wird **vor** dem Gebrauch (`gueltigesToken`,
  eine Woche Vorlauf), nicht nach dem ersten 401: Ein Token, der mitten in
  einem Upload abläuft, hinterlässt ein halb angelegtes Bild bei LinkedIn und
  einen Fehlschlag, dessen Ursache niemand am Text erkennt. Scheitert das
  Auffrischen, kommt das **alte** Token zurück — es gilt vielleicht noch, und
  der Grund landet am Zugang.
- **LinkedIn hängt an einer eigenen Zuordnung** (`liOrganisationId`), nicht am
  Meta-Kanal. Die Anbieter haben nichts miteinander zu tun: Eine Facebook-Seite
  ist keine LinkedIn-Seite. Deshalb ein eigenes Formular und eine eigene Aktion
  — gemeinsam gespeichert hätte jedes Anfassen des einen das andere
  mitgeschickt.
- **Die Bytes für LinkedIn kommen über die signierte Adresse, die Meta
  bekommt** (`medienFuerPost`), nicht direkt aus der Ablage. Dort steckt die
  Umwandlung nach JPEG und die Durchreiche einer Klappe-Fassung; ein zweiter
  Weg an den Dateien vorbei würde beides umgehen, und irgendwann ginge auf
  einer Plattform ein PNG raus, das die andere ablehnt. Meta lädt selbst,
  LinkedIn will die Bytes — deshalb holt Preroll sie von sich selbst.
- **TikTok bekommt den Geräterahmen von Instagram** (Mockup 4a–4c,
  `TikTokRahmen`) — dieselben Maße, derselbe Verlauf, derselbe Schirm
  (320 × 621). Das ist keine Bequemlichkeit: TikTok *ist* genauso eine
  Telefon-App. Anders ist, was darin steht — Bedienelemente rechts am Rand,
  Caption ohne „mehr" bis zur Kante, unten eine Tab-Leiste statt der
  Kommentarzeile. **Einzelbeiträge kennt TikTok nicht**, nur Video und
  Foto-Karussell; ein Bild erscheint dort deshalb als Karussell mit einem
  Foto. Was flacher ist als 9:16, steht mittig auf Schwarz statt beschnitten.
- **TikTok ist „nur planen", dauerhaft.** Es gibt keinen Zugang und damit
  keinen Kanal — „planen und posten" steht gesperrt da, und der Grund sagt
  ausdrücklich, dass Preroll dort nicht postet, statt eine Aufgabe
  anzudeuten, die niemand erledigen kann.
- **LinkedIn hat einen eigenen Rahmen, aber kein Gerät** (Mockup 5a–5d,
  `LinkedInRahmen`). Das Post-Fenster in Desktop-Breite: 552 px, Kopfzeile mit
  Logo und Firmenseite, Caption nach drei Zeilen eingeklappt mit „… mehr",
  darunter Reaktionszeile und die vier Knöpfe — sichtbar, nicht bedienbar, wie
  die Kommentarzeile im Geräterahmen. Ein Telefon davor wäre falsch: LinkedIn
  wird am Rechner gelesen, und ein Profilraster, in dem sich Kacheln zu einem
  Bild fügen, gibt es dort nicht. Ganz ohne Rahmen fehlte aber der Maßstab —
  wie viel Text vor „mehr" stehen bleibt, sieht man erst im Fenster.
- **Die Höhe kommt vom Inhalt.** Kurze Caption, kurzer Beitrag; ein 16:9-Bild
  macht das Fenster niedriger (591 px) als ein 9:16 (971 px). Die einzige
  feste Grenze ist die von LinkedIn: **höher als 4:5 wird nichts** — bei
  550 px Breite endet es nach 690 px. Was höher ist, behält die Höhe und wird
  schmaler (9:16 → 388 px), beim Video mit unscharfen Seitenflächen, beim Bild
  auf Weiß. **Mehrere Bilder werden geblättert** — LinkedIn hat Karussells;
  die Nachbarn lugen je 47 px hervor, Fuge 6 px. (Bis zum 17.08.2026 stand im
  Code das Gegenteil; die Annahme war falsch.)
- **Was in die Aktionsleiste passt, entscheidet die Karte, nicht das Fenster**
  (`@container`). Die vier Beschriftungen brauchen 510 px; darunter bleiben
  nur die Symbole. Eine Abfrage aufs Fenster träfe daneben, sobald der Rahmen
  in einer schmalen Spalte steht.
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
- **Mehrere Beiträge auf einmal.** Ein Kästchen je Zeile, eines je
  Monatsüberschrift (die häufigste Vorauswahl) und eines in der Kopfzeile für
  alles Sichtbare; Gruppenkästchen zeigen „teilweise" über `indeterminate` —
  drei von acht ist weder an noch aus. Mit der ersten Auswahl erscheint eine
  Leiste, die **oben klebt**: Wer unten in einer langen Liste anhakt, soll
  nicht zurückrollen müssen.
- **Die Auswahl überlebt Suche und Filter, wirkt aber nur auf Sichtbares.**
  Gehalten wird eine Menge von Kennungen — wer nach „Recruiting" sucht, drei
  anhakt und dann nach „Team" sucht, hat die drei noch. Ausgeführt wird gegen
  die gerade gefilterten Zeilen geschnitten: **Was man nicht sieht, löscht man
  nicht.** Die Leiste zeigt deshalb die geschnittene Zahl, nicht die gemerkte.
- **Ein Phasenwechsel sagt vorher, was er beim Kunden bewirkt**
  (`kundenwirkung.ts`) — im Editor wie in der Sammelleiste. Seit es
  Arbeitsphasen gibt, ist ein Wechsel keine reine Hausangelegenheit mehr: Er
  nimmt einen Beitrag von der Kundenseite, stellt ihn dorthin, friert den
  gezeigten Stand ein oder wirft den Kunden auf einen **früheren** Stand
  zurück (Vorschau → Produktion zeigt wieder das Konzept). Gefragt wird
  **nur, wenn wirklich etwas geschieht** — ein Fenster bei jedem Klick wird
  weggeklickt, ohne gelesen zu werden, und schützt dann vor nichts. Gerechnet
  wird allein aus den zwei Phasen und dem Termin, **ohne** Inhaltsvergleich:
  Der bräuchte die Stände aller ausgewählten Beiträge und beantwortete am Ende
  nur, ob sich zufällig etwas unterscheidet — die Frage ist aber, *was der
  Wechsel tut*. Jeder Satz sagt, was **der Kunde** erlebt, nicht was das
  Werkzeug tut. Im Stapel werden die Sätze entdoppelt, und der Fuß nennt, bei
  wie vielen der ausgewählten Beiträge überhaupt etwas passiert.
- **Sammelaktionen laufen als eine Anweisung** (`postsStatusSetzen`,
  `postsLoeschen`), nicht als Schleife im Browser: Ein halb durchgelaufener
  Stapel wäre ein Zustand, den niemand erklären kann. Der Kunde kommt als
  Parameter mit in die Bedingung — die Liste zeigt nur seine Beiträge, aber
  darauf verlässt sich der Server nie. **Löschen fragt nach und nennt die
  Zahl**; ein Phasenwechsel fragt nur, wenn er beim Kunden etwas bewirkt.
  Früher fragte er nie — eine Phase ließ sich ja zurückstellen. Das stimmt nur
  noch halb: Der eingefrorene Stand, den ein Wechsel überschreibt, kommt nicht
  zurück.
- **In der Post-Liste führen drei Wege in den Beitrag** — Vorschaubild, Typ
  und Titel. Das Bild allein war ein zu kleines Ziel. Der **Termin dagegen
  öffnet ein kleines Fenster** mit Datum, Uhrzeit, OK und Abbrechen: Umplanen
  war sonst nur über den Kalender oder das Formular im Beitrag zu haben, und
  für „der geht doch erst Donnerstag raus" ist beides zu weit. Bewusst kein
  Speichern beim Tippen — ein Zwischenstand aus neuem Tag und alter Uhrzeit
  wäre ein Termin, den niemand gewollt hat. Ein **leeres Datum** stellt den
  Beitrag zurück auf „Ungeplant" (`postTerminSetzen`); das ist ein gültiger
  Stand und braucht keinen eigenen Knopf.
- **Ein Posting-Termin ist eine Uhrzeit an der Wand des Büros** und gilt in
  `Europe/Berlin` (`ZONE` in `datum.ts`). Zwei Dinge halten das zusammen: Der
  Container bekommt `TZ` gesetzt — sonst läuft er in UTC und rechnet in einer
  anderen „Ortszeit" als der Browser —, und alles, was **im Browser**
  formatiert wird, nennt die Zone ausdrücklich (`formatiereTermin`,
  `terminFelder`, `terminAusEingabe`). Genau daran hing, dass die Uhrzeit beim
  Speichern um zwei Stunden sprang. Reine Datumsfelder bleiben davon
  unberührt: Sie liegen als `DATE` in UTC und laufen weiter über
  `formatiereTag`.
- **Ein verstrichener Termin wird nicht nachgeholt** (`VERFALL`, 15 Minuten).
  Wer zu spät final setzt, plant um — auf einen Zeitpunkt in der Zukunft — und
  setzt dann final. Ganz auf null geht es nicht: Der Takt prüft ein Fenster,
  kein Wimpernschlag; 15 Minuten decken Takt und Neustart ab. Damit erledigt
  sich auch die Frage, wann ein Beitrag final wurde — sie muss nirgends
  festgehalten werden.
- **Posts dürfen ungeplant sein.** `postenAm` ist optional. Der Anlegen-Dialog
  fragt bewusst kein Datum ab — ein erfundener Termin ist schlechter als gar
  keiner. Ungeplante Posts stehen im Kalender in der Spalte „Ungeplant" und
  werden von dort auf einen Tag gezogen. Sie erscheinen in **keinem** Export
  (`postsImZeitraum` und `feedVorschau` sieben sie aus).
- **Uhrzeit beim Verschieben.** Aus „Ungeplant" auf einen Tag gezogen bekommt
  ein Post die `standardUhrzeit` des Kunden aus den Stammdaten. Wird ein bereits
  terminierter Post umgelegt, **bleibt seine Uhrzeit** — wer ihn zwei Tage
  schiebt, will die Zeit nicht neu setzen (`postTerminieren`).
- **Freigaben hängen am einzelnen Post, nicht am Link** — und es ist eine je
  Phase außer Final. In den **sichtbaren** Phasen (Konzept, Vorschau) kommt
  sie vom Kunden, in den **Arbeitsphasen** (Entwurf, Produktion, Korrektur)
  aus dem Haus: Sie sagt „das kann so zum Kunden", und jede interne Runde
  segnet ab, was in der **nächsten** sichtbaren Phase gezeigt wird. Welche
  ansteht, ergibt sich aus der Phase (`src/lib/freigabe.ts`), nie aus dem
  Formular. **Ein Feld `intern` gibt es nicht** — das sagt schon die Stufe
  (`istInterneStufe`); zwei Angaben über dieselbe Sache können einander
  widersprechen. Interne Freigaben erteilen nur `ADMIN` und
  `PROJEKTMANAGER` (`darfInternFreigeben`), geprüft am Server. Auf der
  Kundenseite ist von den internen **nichts** zu sehen: `freigabeStand` und
  `freigabeFortschritt` nehmen dort `nurKunde`, und in einer Arbeitsphase
  wird von ihm gar nichts verlangt (`offeneKundenstufe`) — eine Freigabe, um
  die zweimal gebeten wird, sät Zweifel an der ersten. Eine fehlende Freigabe
  **blockiert nicht**; sie steht als Haken oder Kreuz in der Beitragsliste,
  bei Final ein Strich. Das Team kann eine Freigabe stellvertretend
  eintragen; solche Einträge lösen keine Benachrichtigung aus.
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
- **Der Speichern-Knopf sagt, dass er gespeichert hat** (`SpeichernKnopf`):
  „Speichern" · „Speichert …" (gesperrt) · „Gespeichert" für zweieinhalb
  Sekunden. Einmal gebaut, überall verwendet — eine Rückmeldung, die nur bei
  der Hälfte der Formulare kommt, ist schlechter als gar keine. Zwei Fallen
  stecken darin: `useFormStatus` gibt zwischendurch **`undefined`** statt
  `false` zurück (ungefiltert ein dritter Zustand, an dem der Wecker für
  „Gespeichert" hängen blieb), und der Wechsel muss **während des Renderns**
  geschehen — ein Effekt läuft erst nach dem Zeichnen, und dazwischen blitzt
  wieder „Speichern" auf. Steht ein Knopf außerhalb seines Formulars (der
  Post-Editor hängt ihn über `form=` an), meldet `SpeichernMelder` von innen.
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
- **Der ZIP kann nach Plattform getrennt werden.** Ohne Wahl bleibt es beim
  Hauptformat und einem Ordner je Beitrag — ein alter Link liefert dasselbe
  wie vorher. Bei **einer** Plattform ebenso: Ein Ordner, in dem nur
  „Instagram" steht, ist eine Ebene ohne Aussage. Erst ab **zwei** kommt
  `Plattform/Beitrag/Dateien`, weil dann dieselben Beiträge mehrfach
  vorkommen und nur der Ordner sie auseinanderhält. Je Plattform gilt ihre
  Fassung (`fassungFuer` — dieselbe Regel wie auf der Kundenseite), und ein
  Beitrag, der eine Plattform nicht ansteuert, fehlt in deren Ordner.
- **Der ZIP-Zeitraum ist frei wählbar, der des Kunden nicht.** Das Team gibt
  `von`/`bis` in der Adresse mit — „von der Konzeptrunde bis zum Dreh" hält
  sich nicht an Monatsgrenzen. Ein Gast bekommt immer genau einen Monat und
  nur `FINAL`: Ihm einen freien Zeitraum zu erlauben hieße, ihm über die
  Adresse den ganzen Bestand zu geben.
- **Export ist eine Live-Sicht — solange die Phase sichtbar ist.** In Konzept,
  Vorschau und Final erscheinen Änderungen sofort im Freigabe-Link. In den
  Arbeitsphasen steht dort der eingefrorene Stand; das ist der einzige Fall,
  in dem der Link nicht das Aktuelle zeigt.
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
- **Uploads laufen in 4-MB-Blöcken.** Der Browser schickt Blöcke an
  `/api/upload/teil`, der Abschluss über `/api/upload` setzt sie zusammen
  (`upload-sitzung.ts`). Bewusst **ohne** Wiederaufnahme nach
  Verbindungsabriss wie in Klappe: Preroll lädt Reels, keine 40-GB-Rushes.
  **Der ursprüngliche Grund ist entfallen, der Blockupload bleibt.** Gebaut
  wurde er gegen den Cloudflare-Tunnel, der keine Anfrage über 100 MB
  durchließ — ein Reel am Stück lief in einen Abbruch, der sich wie ein
  Hänger anfühlte. Seit dem 17.08.2026 läuft Preroll direkt über Klappes
  Reverse Proxy, und der lässt 256 MB durch. Geblieben sind zwei Gründe, die
  nie am Tunnel hingen: Es gibt einen echten Fortschritt zu zeigen, und ein
  verlorener Block kostet vier Megabyte statt der ganzen Datei. Der Tunnel
  bleibt zudem als Rückfahrkarte konfiguriert (`preroll.caddy`, Weg 1) — wer
  ihn wieder einschaltet, hat die Grenze zurück.
- **Sechs Phasen intern, vier beim Kunden.** Entwurf → Konzept → Produktion →
  Vorschau → Korrektur → Final, dazu berechnet „Gepostet". **`ENTWURF`
  verlässt das Haus nie:** in keiner Freigabe, in keinem Raster, ohne
  Gegenstück in der Kunden-Zeitleiste (`postsImZeitraum` siebt ihn aus). Neu
  angelegte Posts starten dort. Das ersetzt den früheren Schalter „Konzepte
  mitzeigen" am Link — ob ein Beitrag vorzeigbar ist, hängt am Beitrag, nicht
  am Monat.
- **Zwei Seiten zeigen den Plan am Stück, und sie zeigen Verschiedenes.**
  Die **Review-Seite** (`/kunden/<slug>/review`) ist die interne Sicht: alle
  Phasen inklusive Entwurf, immer der **aktuelle** Stand statt der
  eingefrorenen, das Etikett aus dem Backend statt der vierstufigen
  Kundenleiste, interne Freigaben und je Beitrag ein „Bearbeiten". Die
  **Kundenvorschau** (`/f/<token>`) ist genau das, was der Kunde sieht. Beide
  stehen nebeneinander in der Beitragsliste und heißen, was sie sind — wer sie
  verwechselt, zieht die falschen Schlüsse. Der **Beitrag selbst** wird in
  beiden mit derselben Rechnung und demselben Bauteil gezeigt
  (`sektionsdaten`, `PostSektion`): Welches Medium für welche Plattform gilt
  und was eine Fassung erbt, ist die kniffligste Stelle der Anzeige — zweimal
  geschrieben liefen die Seiten auseinander, und eine Review-Seite, die etwas
  anderes zeigt als der Kunde sieht, ist schlimmer als keine. Verschieden ist
  nur der Rahmen. Kommentare beginnen dort mit `#intern ` — als **Text**, nicht
  als Schalter: Man sieht, was man schreibt, und kann es herausnehmen.
- **Sichtbare Phasen und Arbeitsphasen** (`src/lib/phasen.ts`). Sichtbar sind
  Konzept, Vorschau und Final — dort liest die Kundenseite **live**. Arbeit
  sind Entwurf, Produktion und Korrektur; dort steht der **eingefrorene
  Stand** der vorangehenden sichtbaren Phase. Zwischen Konzept und Vorschau
  wird gedreht, zwischen Vorschau und Final nachgebessert, und der Kunde
  schaute dabei zu: ein halb ausgetauschtes Karussell, eine Caption mitten im
  Umschreiben. Beim Kunden bleiben es **vier** Stufen — `abgeleiteteStufe`
  bildet Produktion auf Konzept ab und Korrektur auf Vorschau; die Wörter
  „Produktion" und „Korrektur" stehen auf seiner Seite nirgends. Im Editor
  steht neben dem Etikett, was er stattdessen sieht (`arbeitsphaseHinweis`).
  Beide Arbeitsphasen teilen sich **eine** Farbe: Wer die Liste überfliegt,
  liest bei beiden dasselbe — hier wird gearbeitet.
- **Eingefroren wird beim Verlassen einer sichtbaren Phase, nicht beim
  Betreten** (`friereStaendeEin`). Beim Eintritt festgeschrieben wäre der
  Stand in dem Moment überholt, in dem er zum ersten Mal gezeigt wird — die
  ganze Konzeptrunde liegt dazwischen, und der Kunde sähe beim Phasenwechsel
  einen Sprung **zurück**. Beim Verlassen hält er genau das, was zuletzt auf
  seinem Bildschirm stand. Nebenbei bleibt es bei **einer** Schreibstelle:
  Solange die Phase sichtbar ist, wird live gelesen, es gibt also nichts
  fortzuschreiben. Eingefroren wird bei **jedem** Wechsel aus einer sichtbaren
  Phase, nicht nur in eine Arbeitsphase — sonst fehlte nach Konzept →
  Vorschau → Produktion der Konzept-Stand.
- **Je Phase ein Stand, nicht einer je Beitrag** (`PostStand`,
  `@@unique([postId, phase])`). Von Vorschau zurück auf Produktion soll wieder
  das **Konzept** gelten; ein einzelner „letzter Stand" zeigte die Vorschau.
  Der Inhalt liegt als JSON (`Standinhalt`) — relational gespiegelt wären es
  vier weitere Tabellen, und abgefragt wird ein Stand nie nach Feldern,
  sondern immer als Ganzes. **Nicht** hinein gehören der Termin (Planung, keine
  Gestaltung — eingefroren stünde ein umgeplanter Beitrag im Kalender des
  Kunden am falschen Tag), Kommentare, Freigaben und alles, was zum Kunden
  gehört statt zum Beitrag. **Dateien werden nicht kopiert**, nur ihre
  Kennungen. Angewendet wird **einmal**, direkt hinter der Abfrage
  (`fuerKundensicht`): Kalender, Raster, Geräterahmen und ZIP bekommen
  dieselbe Form wie immer. Ohne passenden Stand gilt live — besser der falsche
  Zeitpunkt als eine leere Seite. Einen **Verlauf** alter Stände gibt es
  bewusst nicht; ein Rückweg überschreibt.
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
  nachgeführt** — fällt ein *Kanal* weg, schrumpft die Wahl von selbst und
  steht wieder da, sobald er zurück ist; deshalb räumt dort niemand die
  gespeicherte Liste auf. **Beim Abwählen in den Stammdaten gilt das
  Gegenteil** (`entferneAbgewaehlte`): „Wir bespielen TikTok nicht mehr" ist
  eine Absicht, keine Störung — die Plattform fliegt aus den Beiträgen, sonst
  käme sie beim nächsten Anhaken ungefragt zurück. Angefasst wird nur, was
  noch nicht draußen ist; Fassungen bleiben unberührt, weil sie sonst
  verloren wären, sobald die Plattform zurückkommt. Der Preis ist die Kopplung: Ein Kunde ohne
  zugeordnete Seite hat keine Plattformen und damit keine Marken. Wer nur
  planen und weiter von Hand posten will, ordnet die Seite trotzdem zu —
  `postenAktiv` bleibt davon unberührt. Die Wahl am Beitrag zieht **nicht**
  automatisch mit, wenn sie am Kunden wechselt: Das erledigt ein eigener
  Haken, und nur für Beiträge, die noch nicht draußen sind. Gezeigt wird sie
  einfarbig (`PlattformMarken`, nie in Markenfarben) in Post-Liste, beiden
  Kalendern und in der Kopfzeile jedes Beitrags auf der Kundenseite.
- **Eine Sache, mehrere Fassungen** (`PostVariante`). Dieselbe Sache liest sich
  auf LinkedIn anders als auf Instagram. Ein zweiter Beitrag wäre die
  naheliegende Lösung gewesen und die falsche: Er hätte einen eigenen Termin,
  einen eigenen Freigabestand und eine eigene Zeile im Kalender, obwohl es
  **eine** Sache ist, die einmal freigegeben wird.
- **Leer heißt geerbt, Feld für Feld** (`varianten.ts`). Wer nur die Caption
  ändert, bekommt das Medium des Beitrags; wer nur ein anderes Bild braucht,
  dessen Caption. Deshalb sind die Felder optional — eine Fassung, die alles
  wiederholen müsste, veraltet beim nächsten Umbau des Hauptbeitrags, ohne dass
  es auffällt. Ein eigenes Verhältnis wirkt **nur mit eigenen Medien**: sonst
  stünde das geerbte Bild in einer Fläche, für die es nicht gemacht ist.
  Medien werden als **Ganzes** ersetzt, nicht Stück für Stück — ein Karussell
  aus zwei Quellen hätte niemand so gemeint.
- **Eine Fassung kann alles, was der Beitrag kann** — derselbe
  `MedienDialog`, dieselbe Route (`/api/upload` mit `varianteId`), dieselben
  drei Video-Quellen. Eine Weile stand dort nur ein Dateiwähler; damit fehlte
  der Fassung das Auftrennen eines Karussell-Gesamtbildes, die zweite Spalte
  fürs Thumbnail und die Wahl zwischen Upload, Klappe und Downloadlink. Ein
  zweiter, ärmerer Weg zu denselben Medien ist keine Vereinfachung.
  Geschrieben wird über **ein** gebündeltes Ziel (`ziel` in der Route), weil
  es fünf Schreibwege sind — wer einen vergisst, legt still am falschen Ort
  ab. Geprüft wird gegen das Verhältnis **der Fassung**, sonst das des
  Beitrags.
- **Der Video-Platz hat eine Adresse, keine zwei Kopien** (`video-platz.ts`).
  `PostVariante` trägt dieselben Klappe- und Download-Spalten wie `Post`, und
  Download, Klappe-Verknüpfung und Aufräumen bekommen einen `VideoPlatz`
  (`{art, id}`) statt einer `postId`. Über den Beitrag geführt zöge ein
  Download für LinkedIn das Instagram-Video mit um. Die Fachlogik steht
  weiterhin einmal da; nur die Tabelle wechselt. Ein laufender Download hängt
  am `platzSchluessel`, nicht an der Post-Kennung — sonst blockierten sich
  zwei Fassungen desselben Beitrags gegenseitig.
- **Geerbt wird der Video-Platz als Ganzes** — mit allen drei Quellen. Eine
  Fassung, deren Video aus Klappe kommt, hat gar kein eigenes `Medium`; nur
  die Medienliste zu prüfen schöbe ihr das Video des Beitrags unter. Deshalb
  trägt `Fassung` auch `klappeVersionId`, und `eigeneMedien` heißt „eigene
  Medien **oder** eigene Klappe-Fassung". „Verwerfen" räumt entsprechend den
  ganzen Platz: Medien, Link, Download-Stand und Klappe-Wahl. Entfernt wird
  nur die Zuordnung, nicht die Datei — und bleibt nichts übrig, erbt die
  Fassung wieder.
- **Der Medien-Dialog hängt am Seitenkörper** (`createPortal`). Beim Beitrag
  gleichgültig, bei einer Fassung nicht: Ihre Karte **ist** ein Formular, und
  die Klappe- und Link-Formulare im Dialog lägen darin verschachtelt. Ein
  `<form>` im `<form>` wirft der Browser still weg — die Knöpfe säßen da und
  täten nichts. Dieselbe Falle wie seinerzeit bei „Fassung anlegen"; wo ein
  Knopf im Fassungsformular etwas auslösen soll, gehört `formAction` hin,
  kein eigenes Formular.
- **Eine Plattform steht in höchstens einer Fassung.** Welche von zwei gälte,
  wäre nicht entscheidbar. Geprüft am Server (`freiePlattformen`), im Enum lässt
  sich ein Array nicht eindeutig machen; die Sperre im Formular ist
  Bequemlichkeit. Findet die Anzeige trotzdem zwei, nimmt sie die erste nach
  Position statt zu werfen — an einer widersprüchlichen Eingabe abzustürzen wäre
  schlechter.
- **Die Medien einer Fassung liegen in einer eigenen Tabelle**
  (`PostVarianteMedium`), nicht als `varianteId` an `PostMedium`. Dort bewacht
  `@@unique([postId, rolle, position])`, dass ein Beitrag nicht zwei Slides auf
  derselben Position hat; eine zusätzliche, meist leere Spalte hätte das
  aufgehoben, weil Postgres NULL-Werte für verschieden hält.
- **Ein Profilraster zeigt nur die Beiträge seiner Plattform.** Es gibt zwei
  — Instagram (3:4-Kacheln) und TikTok (9:16, Mockup 4d) —, und zwischen
  ihnen wird umgeschaltet wie bei den Beitragsvorschauen. Ein Beitrag, der nur
  auf LinkedIn erscheint, gehört in keines: Er würde dem Kunden ein Profil
  zeigen, das es nicht gibt. `feedVorschau` nimmt dafür einen Filter;
  gefiltert wird über `angezeigtePlattformen`, also über das, was wirklich
  rausgeht. Der Filter wirkt **vor** der Obergrenze — sonst setzte ein
  weggelassener Beitrag das Ende des Zeitraums. **Ein Raster hat nur, wer ein
  Profil hat:** Für Facebook und LinkedIn gibt es keines, in dem sich Kacheln
  zu einem Bild fügen; bespielt ein Kunde weder Instagram noch TikTok, fällt
  die Spalte weg. Im TikTok-Raster steht das **Original**, nicht `thumbUrl()`
  — das ist der mittige 3:4-Ausschnitt für Instagram und würde in einer
  9:16-Kachel ein zweites Mal beschnitten.
- **Die Kopfzeile der Kundenseite nennt alle bespielten Kanäle**, nicht das
  eine, das dort einmal fest stand. Gerechnet über `effektivePlattformen` —
  was in den Stammdaten auf „aus" steht, fehlt. Dieselbe Liste steht im
  Einleitungssatz, damit dort nicht „so, wie sie auf Instagram erscheinen"
  behauptet wird, während der Plan auch auf LinkedIn geht.
- **Beim Kunden steht das Hauptformat zuerst, dann jede Abweichung einmal.**
  Gruppiert statt je Plattform aufgelistet: Gilt eine Fassung für LinkedIn und
  Facebook, steht sie einmal da und nennt beide. Das Hauptformat bleibt auch
  dann vorn, wenn keine Plattform es unverändert nimmt — eine Abweichung ohne
  Bezugspunkt wäre nicht verständlich. Und **kein zweiter Geräterahmen**: Er
  stellte die Abweichung auf dieselbe Stufe wie den Beitrag.
- **Die Player spielen wirklich ab.** Im LinkedIn-Fenster war die Leiste
  zuerst nachgezeichnet — sie sah aus wie bei LinkedIn und tat nichts. Für
  eine Vorschau, in der der Kunde ein Video freigeben soll, ist das die
  falsche Hälfte. Play/Pause, Zeitleiste (ein `input[type=range]`, damit
  Ziehen, Tastatur und Vorlesehilfen ohne Nachbau funktionieren), Ton und
  Vollbild sind gebaut; **Geschwindigkeit und Untertitel bewusst nicht** —
  das Mockup zeichnet sie, aber ein Knopf, der nichts tut, ist eine Falle.
- **Der Ton-Knopf sitzt im Handy, oben rechts** — weißes Zeichen ohne
  Scheibe, in der Kopfzeile neben der Kamera, wie bei Instagram. Vorher stand
  er außerhalb des Rahmens; der Kommentar dort behauptete, innen ginge es
  wegen `overflow: hidden` nicht — das stimmte nicht, solange er im Schirm
  liegt. Im Medien-Dialog, wo es keinen Rahmen gibt, steht er weiter daneben
  (`tonKnopfAussen`).
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
- **Ein Weg zu den Medien, nicht zwei.** Der Knopf unter dem Rahmen heißt
  „Hochladen/Ersetzen"; den zweiten oben rechts **im** Schirm gibt es nicht
  mehr — er tat dasselbe und war im Bild versteckt.
- **Der Medien-Dialog einer Fassung kennt das Format, das gerade gewählt ist**,
  nicht das gespeicherte. Sonst sagte er nach der Wahl von 1:1 weiter 4:5 an,
  solange niemand gespeichert hat — und man lud gegen die falsche Vorgabe
  hoch. Das Auswahlfeld ist deshalb kontrolliert, und die Fassungskarte trägt
  einen Schlüssel mit dem gespeicherten Format, damit sie nach dem Speichern
  frisch startet.
- **Kommentare lassen sich auch im Post-Editor schreiben**, nicht nur über den
  Freigabe-Link. Das Feld steht **oben** in der Liste: Ein neuer Strang gehört
  an den Anfang. Es liegt in einem eigenen Bauteil
  (`KommentarSchreiben`), weil es nach dem Senden **zurückgesetzt** werden
  muss — `KommentarFeld` hält seinen Text für die @-Erwähnungen in eigenem
  Zustand, und React leert nur unkontrollierte Felder. Ohne das Zurücksetzen
  schriebe der zweite Klick denselben Kommentar noch einmal.
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
- **Profil, Handle und Kennzahlen liegen je Plattform** (`PlattformProfil`,
  `@@unique([kundeId, plattform])`). Vorher standen `handle`, `bio`,
  `website`, `follower`, `gefolgt` und `beitraege` flach am Kunden und meinten
  stillschweigend Instagram; mit Facebook und LinkedIn wären daraus
  `fbFollower`, `liFollower` und so weiter geworden — dieselbe Sache in drei
  Sätzen Spalten. Geladen wird als **vollständige Karte** (`profilKarte`), in
  der jede Plattform vorkommt, auch die ohne Zeile: Sonst stünde an jeder
  Anzeigestelle dieselbe Suche, und eine davon vergäße den
  Plattform-Vergleich. **Instagram bleibt trotzdem besonders** — nur seine
  Werte holt Preroll selbst, und nur sie stehen über der Feed-Vorschau; die
  ist ein Instagram-Profil und wird keines von LinkedIn. Auch die
  Follower-Kurve (`KennzahlVerlauf`) trägt die Plattform, sonst überschriebe
  ein zweiter Kanal die Reihe des ersten.
- **Je Plattform ein eigenes Formular** in den Stammdaten
  (`profilSpeichern(kundeId, plattform, …)`). Ein gemeinsames hätte beim
  Speichern von LinkedIn die Instagram-Felder mitgeschickt — und wer dort
  nichts eingetragen hat, hätte gepflegte Werte geleert. `standAm` und
  `quelle` wandern nur mit, wenn sich eine **Zahl** ändert: Sonst stünde nach
  jedem Tippen am Handle „heute von Hand aktualisiert", und der automatische
  Abruf käme 20 Stunden zu spät.
- **Die Stammdaten sind nach Plattform gegliedert:** *Profil* (Logo, Name,
  Plattformwahl, Notiz, die zwei Schalter), *Meta* (Instagram, Facebook, die
  Kanalzuordnung), *LinkedIn*. Das Auswahlfeld je Plattform trägt einen
  **Schlüssel mit dem gespeicherten Stand**: React setzt ein Formular nach
  einer Server-Aktion auf den Wert zurück, mit dem das Feld eingehängt wurde
  — ohne den Schlüssel stand nach dem Abwählen wieder „nur planen" da, obwohl
  gespeichert war, und es sah aus, als ließe sich die Plattform gar nicht
  abschalten. Die Plattformwahl steht damit in einem anderen
  Abschnitt als die Kanalzuordnung, von der ihre Sperre abhängt — der
  Hinweistext benennt das, und `sperren()` rechnet es an einer Stelle. Beide
  Formulare gehen weiter durch **dieselbe** Aktion und tragen je ein
  Merkerfeld (`plattformenGesetzt`, `kanalGesetzt`); die Aktion fasst nur an,
  was mitgeschickt wurde. Deshalb reist `postenAktiv` versteckt im
  Kanal-Formular mit, obwohl sein Schalter im Profil steht.
- **Instagram kann beide Wege — und Graph ist der bessere.** Ist dem Kunden
  eine Facebook-Seite mit verknüpftem Instagram-Konto zugeordnet
  (`igKontoId` + `fbSeitenToken`), kommen Follower, Gefolgt, Beiträge, Bio,
  Website und Profilbild über `holeInstagramKennzahlen` — offiziell, ohne
  Drosselung, ohne Bruch beim nächsten Umbau der Profilseite und ohne den
  400er aus Metas eigenem Haus, an dem das Auslesen für einen Teil der
  Business-Konten scheitert. Nachgemessen liefern beide Wege **dieselben
  Zahlen**. Ein **App Review braucht es dafür nicht** — das gilt nur für
  Business Discovery, also fremde Profile; ein zugewiesenes Konto genügt
  `instagram_basic`. Ohne Zuordnung bleibt es beim Auslesen; das ist kein
  Notbehelf, sondern der einzige Weg für nicht zugewiesene Profile. **Scheitert
  Graph, wird nicht still zurückgefallen**, solange kein Handle da ist: Eine
  zugeordnete Seite ohne Zahlen ist ein Zustand, den jemand ansehen muss.
  Welcher Weg es war, steht als `quelle` am Profil.
- **Facebook geht über die Graph API, nicht übers Auslesen** — als einzige der
  drei. Der Unterschied ist kein Zufall: Bei Instagram und TikTok beobachtet
  Preroll *fremde* Profile, und der dokumentierte Weg setzte eine Anmeldung
  des Kontoinhabers voraus. Eine Facebook-Seite dagegen ist dem Systemnutzer
  der Agentur zugewiesen, und ihr Token liegt ohnehin am Kunden
  (`fbSeitenToken`). Geholt werden `followers_count`, `fan_count`, `about`,
  `website` und das Profilbild; **Follower und „Gefällt mir" sind zwei
  Zahlen**, seit man einer Seite folgen kann, ohne sie zu mögen — `fan_count`
  landet in derselben Spalte wie TikToks Likes. Fehlt dem Systemnutzer
  `pages_read_engagement`, scheitert die **ganze** Anfrage; ein zweiter
  Versuch mit weniger Feldern brächte Bio und Bild und ließe die Zahlen still
  leer.
- **Woran ein Abruf hängt, steht einmal da** (`kennzahlen-bereit.ts`) — bei
  Instagram und TikTok am Handle, bei Facebook an der Seitenzuordnung. Die
  Bedingung wird an drei Stellen gebraucht: in der Warteschlange als SQL, im
  Abruf als Prüfung, in der Oberfläche als Satz. Getrennt gepflegt liefen sie
  auseinander, und ein Knopf wäre bedienbar, wo der Lauf nichts mehr findet.
  Deshalb liegt sie **ohne** `server-only` und ist geprüft; nur der Abruf
  selbst steht daneben.
- **Die Facebook-Profilzeile entsteht mit der Kanalzuordnung.** Der Lauf sucht
  fällige *Profile* — ohne Zeile gäbe es nichts nachzuziehen, und der
  automatische Abruf käme für Facebook nie in Gang. Aus demselben Grund
  schreibt `aktualisiereKennzahlen` per `upsert`: Ein Knopf, der mit „Zeile
  nicht gefunden" scheitert, ist keine Auskunft.
- **TikToks Zahlen kommen aus der Profilseite.** `tiktok.com/@handle` trägt
  den Zustand der Seite als JSON in einem
  `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">`; darin stehen Follower,
  Folge-ich, Videos, Likes, Bio und Profilbild. **`statsV2` schlägt `stats`**
  — Letzteres rundet (95300000 statt 95315669), und gerundete Zahlen bewegen
  sich in einer Verlaufskurve erst nach Hunderttausenden. Gelesen wird ohne
  Cookie; eine hinterlegte Sitzung gibt es für TikTok gar nicht. Die
  offizielle Display API scheidet aus: Sie setzt eine OAuth-Anmeldung des
  Kontoinhabers voraus, und Preroll beobachtet fremde Kundenprofile.
- **TikTok liefert auch mal eine Sperrseite** — dann fehlt der Datenblock
  ganz. Das ist kein Fehler im Code und löst **kein** Warnband aus; der
  nächste Lauf versucht es wieder. Davon zu unterscheiden ist ein Konto, das
  es nicht gibt: Dort antwortet TikTok mit **200** und einem `statusCode` im
  Block (`10221 · user banned`, auch für einen frei erfundenen Namen). Ohne
  die Unterscheidung (`statusAus`) hieße ein Tippfehler im Handle
  „Sperrseite", und man suchte den Fehler bei TikTok statt bei sich.
- **Eine Warteschlange für alle abrufbaren Plattformen**, nicht eine je
  Anbieter (`ABRUFBAR` in `kennzahlen-auftrag.ts`). Sonst käme TikTok bei
  vielen Kunden nie an die Reihe, weil Instagram den Takt belegt. Der
  Rhythmus bleibt: ein Profil je Lauf, Läufe alle 20 Minuten, jedes Profil
  höchstens einmal am Tag. **Likes führt nur TikTok** — die Spalte steht an
  `PlattformProfil` und `KennzahlVerlauf` und bleibt bei den anderen leer.
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
- **Ein gescheiterter Kennzahlen-Abruf hinterlässt eine Spur**
  (`letzterVersuchAm`, `letzterFehler` an `PlattformProfil`). Vorher kehrte
  `aktualisiereKennzahlen` vor dem Schreiben um: `standAm` blieb leer, in den
  Stammdaten stand „Noch nichts eingetragen" — und der Lauf zog dasselbe
  aussichtslose Profil **alle 20 Minuten** wieder heran, weil es damit das
  älteste blieb. Rund siebzig sinnlose Anfragen am Tag gegen dieselbe Adresse;
  Instagram drosselt daraufhin **alles**, und dann fallen auch die Profile
  aus, die vorher gingen. Nach einem Fehlschlag gilt deshalb `FEHLERPAUSE`
  (zwei Stunden), und die Warteschlange sortiert zuerst nach
  `letzterVersuchAm`.
- **Instagram liefert für manche Business-Konten 400 aus eigenem Haus.** Der
  Rumpf nennt ein gelöschtes Schema (`ig_business_category_subvertical`);
  betroffen ist eine Teilmenge der Profile — nachgemessen antworteten @adidas
  und @puma mit 400, während @nike und @thdvideo im selben Moment 200 lieferten.
  Weder ein anderer Endpunkt (`i.instagram.com`, GraphQL, `?__a=1`) noch eine
  Anmeldung kommen daran vorbei. `deuteFehler` benennt den Fall ausdrücklich —
  ohne ihn stand dort „abgewiesen (400)", und man suchte den Fehler beim
  Handle. Der Rohtext von Instagram reist bei jedem Fehlschlag mit; ohne ihn
  beginnt das Raten.
- **Ein Feld für alle Formen der Sitzung** — `alsCookiedatei` nimmt eine ganze
  `cookies.txt`, eine Liste `name=wert; name=wert` oder den blanken
  `sessionid`-Wert. Ein zweites Feld für `csrftoken` gäbe es also nichts zu
  bauen; was fehlte, war der **Hinweis darauf**: Der Platzhalter zeigte
  `sessionid=…` und lotste damit in die halbe Form. Die Einstellungen nennen
  jetzt, **welche** Cookies hinterlegt sind (`sitzungsumfang`), und warnen,
  wenn `csrftoken` fehlt — „hinterlegt" allein sagt zu wenig, wenn die Sitzung
  für die Hälfte ihrer Aufgaben untauglich ist.
- **Eine Sitzung ohne `csrftoken` wird für Kennzahlen gar nicht erst
  versucht.** Sie quittiert diesen Endpunkt zuverlässig mit 400 und verdeckte
  damit den echten Grund des ersten, anonymen Versuchs hinter einem zweiten,
  falschen.
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
- **Die Länge eines Reels kommt aus der Datei.** Beim Hochladen und beim
  Link-Download misst `ffprobe` sie und schreibt sie ins Freifeld
  (`laengeAusVideoUebernehmen`) — überschreibend, denn wer ein Video
  austauscht, hat eine neue Länge. Nur beim **Reel** und nur am **Beitrag**:
  Eine Fassung hat kein solches Feld, ihr Video überschriebe sonst die Länge
  des Hauptvideos. Angezeigt wird sie in Entwurf und Konzept mit **„ca."**, ab
  der Produktion ohne (`laengeAnzeige`): Dort ist sie ein Vorhaben, hier eine
  Tatsache. Ein schon eingeschränkter Wert („etwa eine Minute") bleibt, wie er
  ist. Für eine **Klappe-Fassung** wird nichts gemessen — die Datei liegt
  nicht lokal.
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
| `TikTok-Layer.dc.html` | 4a–4d: TikTok-Gerät je Medienart, Profilraster |
| `LinkedIn-Layer.dc.html` | 5a–5d: LinkedIn-Post-Fenster je Medienart |

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

**Auf der Kundenseite gibt es je Inhalt eine Zeile:** links die Vorschau,
rechts daneben ihr Text — Marken, Caption, Format. Das Hauptformat ist die
erste Zeile und trägt zusätzlich, was für den ganzen Beitrag gilt (Eckdaten,
alle Slides, Ablauf). Jede Fassung bekommt ihre eigene; zusammengelegt stünde
die abweichende Caption unter einem Bild, das sie nicht meint. Ein
Hauptformat ohne eigene Plattform fällt weg.

**Gleicher Inhalt auf mehreren Plattformen heißt eine Vorschau mit
Umschalter** (`VorschauWahl`) — nicht zwei untereinander; das zeigte
denselben Text zweimal. Instagram und Facebook teilen sich dabei den
Geräterahmen: Für Facebook ist kein eigenes Fenster gezeichnet, und zwei
gleich aussehende Ansichten wären eine Wahl ohne Unterschied. Die
Vorschauspalte ist **fest 344 px** breit, sonst spränge das Layout bei jedem
Umschalten — der LinkedIn-Rahmen ist deshalb auf dieselbe Breite begrenzt,
obwohl das Mockup 552 px zeichnet.

**Rechts steht ein Block: Termin, Stand, Freigabe, Kommentare — und der
klebt oben**, bis der nächste Beitrag kommt. Sie gehören zusammen: Wer unten
etwas sieht, will es dort freigeben und kommentieren. **Einer je Beitrag,
nicht je Zeile** — Freigabe und Kommentarstrang hängen am Beitrag, zwei
gleiche Knöpfe wären eine Falle. Unter `xl` gibt es die dritte Spalte nicht;
dann stehen Termin und Statusleiste wieder in der Kopfzeile, weil man am
Telefon sonst an zwei Vorschauen vorbeirollt, um den Termin zu sehen.
Gebaut als **zwei Raster ineinander**, nicht als eines mit drei Spalten —
`grid-row: 1/-1` spannt nur über *explizite* Zeilen, und die entstehen hier
erst mit den Fassungen.

**Der Akzent gehört dem, was etwas auslöst** — anlegen, senden, koppeln,
freigeben, ein Dialog-OK. **„Speichern" unter einem Abschnitt ist still.** In
den Stammdaten liegen ein Dutzend gleichrangiger Formulare untereinander, und
jedes speichert für sich: Zwölf rote Knöpfe entwerten die Farbe, und einzelne
rote zwischen stillen lassen einen Abschnitt wichtiger aussehen, als er ist.
Wo in den Einstellungen ein zweiter Knopf danebensteht („Verbindung prüfen"),
trägt „Speichern" den Akzent — dort **trennt** die Farbe die beiden, statt zu
betonen.

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
