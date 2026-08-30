-- Aus der Kommentar-Sammlung wird eine Meldungs-Sammlung: Freigaben kommen
-- genauso in Schüben und sollen genauso gebündelt werden.
--
-- Umbenannt statt neu angelegt — die Tabelle ist einen Tag alt und hält nur
-- Wartendes; ein zweiter, fast gleicher Kasten daneben wäre die schlechtere
-- Hinterlassenschaft.
CREATE TYPE "SammlungArt" AS ENUM ('KOMMENTAR', 'FREIGABE');

ALTER TABLE "kommentar_sammlung" RENAME TO "meldung_sammlung";
ALTER INDEX "kommentar_sammlung_pkey" RENAME TO "meldung_sammlung_pkey";
ALTER INDEX "kommentar_sammlung_kundeId_email_idx" RENAME TO "meldung_sammlung_kundeId_email_idx";
ALTER INDEX "kommentar_sammlung_erstelltAm_idx" RENAME TO "meldung_sammlung_erstelltAm_idx";

-- Bestehende Zeilen sind allesamt Kommentare.
ALTER TABLE "meldung_sammlung" ADD COLUMN "art" "SammlungArt" NOT NULL DEFAULT 'KOMMENTAR';
ALTER TABLE "meldung_sammlung" ALTER COLUMN "art" DROP DEFAULT;

ALTER TABLE "meldung_sammlung" ALTER COLUMN "kommentarId" DROP NOT NULL;
ALTER TABLE "meldung_sammlung" ADD COLUMN "freigabeId" TEXT;
ALTER TABLE "meldung_sammlung" ADD CONSTRAINT "meldung_sammlung_freigabeId_fkey"
  FOREIGN KEY ("freigabeId") REFERENCES "freigabe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
