# Preroll

Planung und Kundenfreigabe von Social-Media-Konzepten. Das Agentur-Team plant
Reels, Karussells und Einzelbeiträge, legt Posting-Termine fest und schickt dem
Kunden einen Link zur Freigabe. Der Kunde sieht dort einen Monatskalender, eine
Vorschau seines künftigen Instagram-Feeds und jeden geplanten Beitrag im
iPhone-Rahmen — und kann direkt kommentieren.

Ersetzt einen bisherigen Canva-Workflow. Gehört zur Produktfamilie mit
[Klappe](https://github.com/jonathanfuhr/klappe).

## Betrieb

```bash
cp .env.example .env    # SESSION_SECRET und APP_URL setzen
docker compose up -d --build
```

Der Container spielt beim Start die Migrationen ein. Die Datenbank liegt in
einem benannten Volume, die **hochgeladenen Medien dagegen auf einem Pfad des
Hosts** (`MEDIEN_PFAD`) — dort sind sie im Finder erreichbar, laufen ins
Backup und überleben jedes Neubauen des Images.

**Erster Start:** Die Seite fragt beim ersten Aufruf nach Name, E-Mail und
Passwort — dieses Konto wird automatisch Administrator und landet direkt in
den Einstellungen. Danach ist die Einrichtungsseite gesperrt.

Weitere Konten lassen sich auch von der Kommandozeile anlegen:

```bash
docker compose exec web node --experimental-strip-types scripts/nutzer-anlegen.ts helena@thdvideo.de "Helena Avdijaj"
```

Beispieldaten (Kunde Beispiel Handwerk GmbH, Content-Plan August 2026) — nur für eine
Testinstanz, nicht für den Produktivbetrieb:

```bash
docker compose exec web node --experimental-strip-types prisma/seed.ts
```

## Veröffentlichen

Preroll läuft seit dem 17.08.2026 **direkt über den Reverse Proxy von Klappe**,
nicht mehr durch den Cloudflare-Tunnel:

```
Browser  →  Caddy (Klappe, :443)  →  host.docker.internal:4400  →  Container :3000
```

Der Grund war die Geschwindigkeit. Nachgemessen an derselben 98-MB-Datei kamen
durch den Tunnel kalt **0,7 MB/s** an, über den Host **rund 110 MB/s** — und
auf der Kundenseite hängen schnell 156 MB Medien. Warum das bei *Klappes* Caddy
liegt und nicht in einem eigenen: Port 443 kann nur einer halten. Die Projekte
bleiben trotzdem getrennt — die Routendatei gehört zu Preroll und wird bei
Klappe nur hineingelegt (`docker/fremde/preroll.caddy`); Klappes Konfiguration
nennt Preroll an keiner Stelle. Die ausführliche Begründung samt Messwerten
steht im Kopf dieser Datei.

**Der A-Eintrag wird nachgeführt.** Ohne Tunnel zeigt `preroll.thdvideo.de`
direkt auf den Anschluss, und der bekommt bei jedem Reconnect eine neue
Adresse. Klappes `deploy/mac/klappe-ddns.sh` hält beide Namen aktuell — dort
steht Preroll in `CF_RECORD` mit drin.

### Der Tunnel als Rückfahrkarte

`cloudflared` läuft auf dem Mac Mini weiter **nativ** (Homebrew), nicht im
Container. Damit sieht er das Compose-Netz nicht — der Docker-Servicename `web`
ist für ihn unerreichbar; er ginge über den veröffentlichten Host-Port:

```
Cloudflare  →  cloudflared (nativ)  →  http://localhost:4400  →  Container :3000
```

Die Routendatei bedient beide Wege (`http://` für den Tunnel, `https://`
direkt). Umgeschaltet wird über den DNS-Eintrag: graue Wolke heißt direkt,
orange heißt Tunnel.

**Port 4400**, weil auf demselben Rechner schon Klappe (3000) und Mappe (4300)
liegen. Veröffentlicht wird nur auf `127.0.0.1` — nach außen geht es
ausschließlich durch den Tunnel, aus dem LAN ist die App nicht erreichbar.

In `~/.cloudflared/config.yml` ergänzen:

```yaml
ingress:
  - hostname: preroll.fuhrzwei.de
    service: http://localhost:4400
  # … bestehende Einträge für klappe und mappe …
  - service: http_status:404
```

DNS-Eintrag anlegen und den Dienst neu laden:

```bash
cloudflared tunnel route dns <tunnel-name> preroll.fuhrzwei.de
```

```bash
brew services restart cloudflared
```

**`APP_URL` muss die öffentliche https-Adresse sein**, nicht `localhost`: Sie
steckt in Mails, Freigabe-Links und Web-Push — und entscheidet über das
`secure`-Flag der Session-Cookies. Steht dort `http://…`, gehen die Cookies
ohne `secure` raus.

**Upload-Grenze.** Sie stammte vom Tunnel: Cloudflare deckelt den
Request-Body in den kleineren Tarifen bei 100 MB. Über den Reverse Proxy gilt
sie nicht mehr — dort steht `max_size 256MB`, großzügig gesetzt, damit der
Proxy nie der Grund ist, warum ein Upload scheitert. Wer wieder auf den Tunnel
umschaltet, hat die 100 MB zurück; der Blockupload (4-MB-Teile) hält die
einzelne Anfrage ohnehin klein, betroffen wäre nur ein Karussell, das als
**eine** Anfrage rausgeht.

## Entwicklung

Auf dem Mac läuft die Datenbank ohne Docker als PGlite:

```bash
npm install
npm run dev:db      # Terminal 1 — Postgres-kompatible Datenbank auf :5432
npm run db:migrate  # Migrationen einspielen
npm run db:seed     # Beispieldaten
npm run dev         # Terminal 2 — App auf :3000
```

Anmeldung mit `helena@thdvideo.de` / `preroll`, Freigabe-Link unter `/f/beispiel-aug26`.

Vor jedem Commit:

```bash
npm run check
```

## Einrichtung nach dem ersten Start

Unter **Einstellungen** hinterlegen:

- **Mailversand** — SMTP, Microsoft 365 (Graph) oder Google (Gmail API). Ohne
  ihn funktioniert die Anmeldung von Kunden per Code nicht. Der Testmail-Knopf
  zeigt sofort, ob es klappt.
- **Push** — ein Klick erzeugt das VAPID-Schlüsselpaar, danach kann sich jedes
  Gerät anmelden.
- **Microsoft 365** (optional) — Redirect-URI ist
  `<APP_URL>/api/auth/m365/callback`. Konten müssen vorher als Nutzer angelegt
  sein; die Anmeldung legt niemanden neu an.
- **Klappe** (optional) — Basis-URL und API-Schlüssel für finale Reels.

## Dokumentation

Alles Gearbeitete wird in Notion dokumentiert — siehe
[CLAUDE.md](CLAUDE.md#alles-gearbeitete-wird-in-notion-dokumentiert).
Die Mockups liegen unter `design/` und sind die verbindliche Vorlage.
