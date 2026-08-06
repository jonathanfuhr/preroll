-- Welche Mail-Domänen sich über Microsoft 365 selbst registrieren dürfen.
-- Leer heißt: keine Selbstregistrierung, Konten werden von Hand angelegt.
ALTER TABLE "einstellungen" ADD COLUMN "m365Domaenen" TEXT;
