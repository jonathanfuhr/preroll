-- CreateEnum
CREATE TYPE "BenachrichtigungArt" AS ENUM ('KOMMENTAR', 'FREIGABE', 'EINLADUNG');

-- AlterEnum
BEGIN;
CREATE TYPE "Rolle_new" AS ENUM ('ADMIN', 'PROJEKTMANAGER', 'DESIGNER', 'EDITOR');
ALTER TABLE "public"."nutzer" ALTER COLUMN "rolle" DROP DEFAULT;
-- Die Rolle MITGLIED gibt es nicht mehr. Solche Konten werden zu EDITOR:
-- Sie dürfen weiterhin alles lesen und bearbeiten, sind aber nicht als
-- Ansprechpartner wählbar und bekommen keine Benachrichtigungen. Wer welche
-- braucht, wird danach von Hand auf Projektmanager oder Designer gesetzt.
ALTER TABLE "nutzer" ALTER COLUMN "rolle" TYPE "Rolle_new"
  USING (CASE "rolle"::text WHEN 'ADMIN' THEN 'ADMIN' ELSE 'EDITOR' END::"Rolle_new");
ALTER TYPE "Rolle" RENAME TO "Rolle_old";
ALTER TYPE "Rolle_new" RENAME TO "Rolle";
DROP TYPE "public"."Rolle_old";
ALTER TABLE "nutzer" ALTER COLUMN "rolle" SET DEFAULT 'EDITOR';
COMMIT;

-- Ansprechpartner sind ab jetzt Nutzerkonten. Die alte Tabelle enthält
-- Kontakte ohne zugehöriges Konto — sie lassen sich nicht automatisch
-- zuordnen und entfallen. Betroffene Kunden brauchen danach einen
-- Hauptansprechpartner aus der Benutzerliste.
DELETE FROM "ansprechpartner";

-- DropForeignKey
ALTER TABLE "ansprechpartner" DROP CONSTRAINT "ansprechpartner_fotoId_fkey";

-- DropForeignKey
ALTER TABLE "ansprechpartner" DROP CONSTRAINT "ansprechpartner_kundeId_fkey";

-- DropForeignKey
ALTER TABLE "export" DROP CONSTRAINT "export_ansprechpartnerId_fkey";

-- AlterTable
ALTER TABLE "einstellungen" ADD COLUMN     "agenturAdresse" TEXT,
ADD COLUMN     "agenturName" TEXT,
ADD COLUMN     "agenturWebsite" TEXT,
ADD COLUMN     "klappeAutoAktualisieren" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "klappeInterneZeigen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "klappeNameEnthaelt" TEXT,
ADD COLUMN     "klappeNamenNachziehen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "klappeNamensschema" TEXT NOT NULL DEFAULT '{datum} {titel}',
ADD COLUMN     "klappeNurEndfassung" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "klappeVideoAnlegen" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "export" DROP COLUMN "ansprechpartnerId",
ADD COLUMN     "zusatzAnsprechpartnerId" TEXT;

-- AlterTable
ALTER TABLE "kunde" ADD COLUMN     "hauptAnsprechpartnerId" TEXT;

-- AlterTable
ALTER TABLE "nutzer" ADD COLUMN     "fotoId" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "telefon" TEXT,
ALTER COLUMN "rolle" SET DEFAULT 'EDITOR';

-- DropTable
DROP TABLE "ansprechpartner";

-- CreateTable
CREATE TABLE "kunde_betreuer" (
    "id" TEXT NOT NULL,
    "kundeId" TEXT NOT NULL,
    "nutzerId" TEXT NOT NULL,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kunde_betreuer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benachrichtigung" (
    "id" TEXT NOT NULL,
    "nutzerId" TEXT NOT NULL,
    "art" "BenachrichtigungArt" NOT NULL,
    "titel" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kundeId" TEXT,
    "postId" TEXT,
    "gelesenAm" TIMESTAMP(3),
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benachrichtigung_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kunde_betreuer_nutzerId_idx" ON "kunde_betreuer"("nutzerId");

-- CreateIndex
CREATE UNIQUE INDEX "kunde_betreuer_kundeId_nutzerId_key" ON "kunde_betreuer"("kundeId", "nutzerId");

-- CreateIndex
CREATE INDEX "benachrichtigung_nutzerId_gelesenAm_idx" ON "benachrichtigung"("nutzerId", "gelesenAm");

-- AddForeignKey
ALTER TABLE "nutzer" ADD CONSTRAINT "nutzer_fotoId_fkey" FOREIGN KEY ("fotoId") REFERENCES "medium"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kunde" ADD CONSTRAINT "kunde_hauptAnsprechpartnerId_fkey" FOREIGN KEY ("hauptAnsprechpartnerId") REFERENCES "nutzer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kunde_betreuer" ADD CONSTRAINT "kunde_betreuer_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "kunde"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kunde_betreuer" ADD CONSTRAINT "kunde_betreuer_nutzerId_fkey" FOREIGN KEY ("nutzerId") REFERENCES "nutzer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export" ADD CONSTRAINT "export_zusatzAnsprechpartnerId_fkey" FOREIGN KEY ("zusatzAnsprechpartnerId") REFERENCES "nutzer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benachrichtigung" ADD CONSTRAINT "benachrichtigung_nutzerId_fkey" FOREIGN KEY ("nutzerId") REFERENCES "nutzer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

