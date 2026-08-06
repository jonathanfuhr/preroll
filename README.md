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

Beispieldaten (Kunde Beispiel Handwerk GmbH, Content-Plan August 2026):

```bash
docker compose exec web npx prisma db seed
```

## Veröffentlichen über Cloudflare Tunnel

Auf dem Mac Mini läuft `cloudflared` **nativ** (Homebrew), nicht im Container.
Damit sieht der Tunnel das Compose-Netz nicht — der Docker-Servicename `web`
ist für ihn unerreichbar. Er geht über den veröffentlichten Host-Port:

```
Cloudflare  →  cloudflared (nativ)  →  http://localhost:4400  →  Container :3000
```

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

**Upload-Grenze beachten.** Cloudflare deckelt den Request-Body (in den
kleineren Tarifen bei 100 MB). Ein Karussell mit vielen großen Slides geht als
**eine** Anfrage raus und kann darüber liegen — dann bricht der Upload mit
einem Cloudflare-Fehler ab, nicht mit einer Meldung aus Preroll. Im Zweifel
die Slides in zwei Durchgängen hochladen oder das Limit im Tarif prüfen.

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
