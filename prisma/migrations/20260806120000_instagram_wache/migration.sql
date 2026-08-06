-- Tägliche Prüfung der Instagram-Sitzung samt Meldung an die Administration.
ALTER TYPE "BenachrichtigungArt" ADD VALUE 'WARTUNG';

ALTER TABLE "einstellungen" ADD COLUMN "instagramTestUrl" TEXT;
ALTER TABLE "einstellungen" ADD COLUMN "instagramGemeldetAm" TIMESTAMP(3);
