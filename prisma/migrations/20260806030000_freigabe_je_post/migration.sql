-- Freigaben hängen jetzt am einzelnen Post und tragen eine Stufe
-- (Konzept oder Vorschau). Alte Zeilen galten pauschal für einen ganzen
-- Export-Link und lassen sich keinem Post zuordnen — sie entfallen.
DELETE FROM "freigabe";

-- CreateEnum
CREATE TYPE "Freigabestufe" AS ENUM ('KONZEPT', 'VORSCHAU');

-- DropForeignKey
ALTER TABLE "freigabe" DROP CONSTRAINT "freigabe_exportId_fkey";

-- AlterTable
ALTER TABLE "export" DROP COLUMN "freigabeButtonZeigen",
DROP COLUMN "freigegebenAm",
ADD COLUMN     "freigabenErlaubt" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "freigabe" ADD COLUMN     "nutzerId" TEXT,
ADD COLUMN     "postId" TEXT NOT NULL,
ADD COLUMN     "stufe" "Freigabestufe" NOT NULL,
ALTER COLUMN "exportId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "freigabe_postId_stufe_key" ON "freigabe"("postId", "stufe");

-- AddForeignKey
ALTER TABLE "freigabe" ADD CONSTRAINT "freigabe_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freigabe" ADD CONSTRAINT "freigabe_exportId_fkey" FOREIGN KEY ("exportId") REFERENCES "export"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freigabe" ADD CONSTRAINT "freigabe_nutzerId_fkey" FOREIGN KEY ("nutzerId") REFERENCES "nutzer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

