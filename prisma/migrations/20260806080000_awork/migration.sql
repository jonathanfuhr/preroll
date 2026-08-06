-- Anbindung an awork. Vorerst nur die Verbindung selbst: Was Preroll dorthin
-- schreibt, ist noch offen.
ALTER TABLE "einstellungen" ADD COLUMN "aworkAktiv" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "einstellungen" ADD COLUMN "aworkApiKey" TEXT;
ALTER TABLE "einstellungen" ADD COLUMN "aworkGeprueftAm" TIMESTAMP(3);
