-- Wann die Cookies hinterlegt und zuletzt geprüft wurden. Eine abgelaufene
-- Sitzung fällt sonst erst beim nächsten Download auf.
ALTER TABLE "einstellungen" ADD COLUMN "instagramCookiesAm" TIMESTAMP(3);
ALTER TABLE "einstellungen" ADD COLUMN "instagramGeprueftAm" TIMESTAMP(3);
ALTER TABLE "einstellungen" ADD COLUMN "instagramFehler" TEXT;
