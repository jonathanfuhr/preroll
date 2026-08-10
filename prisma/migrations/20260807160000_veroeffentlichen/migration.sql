-- Preroll veröffentlicht künftig selbst. Drei Bausteine:
--
--   plattform_zugang  — ein Zugang (Systemnutzer-Token), an dem mehrere Kunden
--                       hängen. Bewusst nicht je Kunde ein Token: Stirbt der
--                       Zugang, muss die Meldung sagen können, welche Kunden
--                       betroffen sind.
--   kunde             — Schalter plus die aus me/accounts geholten Kennungen.
--   veroeffentlichung — je Post und Plattform eine Zeile. Der eindeutige
--                       Schlüssel darauf ist die Doppelpost-Sperre.
--
-- LINKEDIN und YOUTUBE stehen schon im Enum, damit sie später ohne Migration
-- danebenpassen. Gebaut sind FACEBOOK und INSTAGRAM.
CREATE TYPE "Plattform" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE');
CREATE TYPE "ZugangsArt" AS ENUM ('SYSTEMNUTZER', 'PERSON');
CREATE TYPE "VeroeffentlichungStand" AS ENUM ('GEPLANT', 'LAEUFT', 'UEBERGEBEN', 'ERFOLGT', 'FEHLGESCHLAGEN');

CREATE TABLE "plattform_zugang" (
    "id" TEXT NOT NULL,
    "plattform" "Plattform" NOT NULL,
    "art" "ZugangsArt" NOT NULL DEFAULT 'SYSTEMNUTZER',
    "bezeichnung" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "gueltigBis" TIMESTAMP(3),
    "geprueftAm" TIMESTAMP(3),
    "fehler" TEXT,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiertAm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "plattform_zugang_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "veroeffentlichung" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "plattform" "Plattform" NOT NULL,
    "stand" "VeroeffentlichungStand" NOT NULL DEFAULT 'GEPLANT',
    "geplantFuer" TIMESTAMP(3) NOT NULL,
    "versuche" INTEGER NOT NULL DEFAULT 0,
    "meldung" TEXT,
    "externeId" TEXT,
    "uebergebenAm" TIMESTAMP(3),
    "erledigtAm" TIMESTAMP(3),
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiertAm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "veroeffentlichung_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "veroeffentlichung_postId_plattform_key" ON "veroeffentlichung"("postId", "plattform");
CREATE INDEX "veroeffentlichung_stand_geplantFuer_idx" ON "veroeffentlichung"("stand", "geplantFuer");

ALTER TABLE "veroeffentlichung" ADD CONSTRAINT "veroeffentlichung_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bestand postet weiter von Hand: postenAktiv ist aus, und ohne Seiten-Kennung
-- passiert ohnehin nichts.
ALTER TABLE "kunde" ADD COLUMN "postenAktiv" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "metaZugangId" TEXT,
ADD COLUMN "fbSeitenId" TEXT,
ADD COLUMN "fbSeitenName" TEXT,
ADD COLUMN "fbSeitenToken" TEXT,
ADD COLUMN "igKontoId" TEXT,
ADD COLUMN "igName" TEXT;

ALTER TABLE "kunde" ADD CONSTRAINT "kunde_metaZugangId_fkey"
  FOREIGN KEY ("metaZugangId") REFERENCES "plattform_zugang"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hauptschalter neben dem Schalter je Kunde: ein Ort, an dem sich alles auf
-- einmal anhalten lässt.
ALTER TABLE "einstellungen" ADD COLUMN "veroeffentlichenAktiv" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "veroeffentlichenLaufAm" TIMESTAMP(3);
