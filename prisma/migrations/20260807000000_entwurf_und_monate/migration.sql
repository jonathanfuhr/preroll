-- Neue Phase vor dem Konzept: in Arbeit, nur intern. Bestehende Posts
-- behalten ihren Status; ENTWURF ist ab jetzt der Startwert neuer Posts.
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'ENTWURF' BEFORE 'KONZEPT';

-- Eine Freigabe umfasst immer einen ganzen Monat. Bestehende Zeiträume
-- werden auf ihren Monat gedehnt: Beginn auf den Ersten, Ende auf den
-- Letzten. Der Monat richtet sich nach dem bisherigen Beginn.
UPDATE "export"
SET "zeitraumVon" = date_trunc('month', "zeitraumVon")::date,
    "zeitraumBis" = (date_trunc('month', "zeitraumVon") + interval '1 month - 1 day')::date;

-- Doppelte Monate je Kunde zusammenführen: Es bleibt der älteste Link, damit
-- bereits verschickte Adressen gültig bleiben.
DELETE FROM "export" a
USING "export" b
WHERE a."kundeId" = b."kundeId"
  AND a."zeitraumVon" = b."zeitraumVon"
  AND a."erstelltAm" > b."erstelltAm";

ALTER TABLE "export" ADD CONSTRAINT "export_kundeId_zeitraumVon_key" UNIQUE ("kundeId", "zeitraumVon");

-- Diese Schalter sind entfallen: Kommentare sind immer erlaubt, Freigaben
-- richten sich nach den Stammdaten des Kunden, und Konzepte werden immer
-- gezeigt — das Verstecken übernimmt jetzt die Phase ENTWURF.
ALTER TABLE "export" DROP COLUMN "kommentareErlaubt";
ALTER TABLE "export" DROP COLUMN "freigabenErlaubt";
ALTER TABLE "export" DROP COLUMN "konzepteMitzeigen";
ALTER TABLE "export" DROP COLUMN "gueltigBis";
