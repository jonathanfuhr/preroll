-- Instagram beantwortet Reel-Abrufe ohne angemeldete Sitzung mit einer leeren
-- Medienantwort. Der dokumentierte Weg dagegen ist eine cookies.txt.
ALTER TABLE "einstellungen" ADD COLUMN "instagramCookies" TEXT;
