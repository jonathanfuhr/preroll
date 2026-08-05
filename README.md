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

Der Container spielt beim Start die Migrationen ein. Medien und Datenbank liegen
in benannten Volumes.

Beispieldaten (Kunde Beispiel Handwerk GmbH, Content-Plan August 2026):

```bash
docker compose exec web npx prisma db seed
```

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
