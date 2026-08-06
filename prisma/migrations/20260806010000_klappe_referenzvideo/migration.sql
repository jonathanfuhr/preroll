-- AlterTable
ALTER TABLE "einstellungen" ADD COLUMN     "klappeGekoppeltAm" TIMESTAMP(3),
ADD COLUMN     "klappeKonto" TEXT;

-- AlterTable
ALTER TABLE "kunde" ADD COLUMN     "klappeProjektId" TEXT,
ADD COLUMN     "klappeProjektName" TEXT;

-- AlterTable
ALTER TABLE "post" ADD COLUMN     "klappeStandAm" TIMESTAMP(3),
ADD COLUMN     "klappeVersionId" TEXT,
ADD COLUMN     "klappeVersionNummer" INTEGER,
ADD COLUMN     "klappeVideoName" TEXT,
ADD COLUMN     "referenzVideoMediumId" TEXT;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_referenzVideoMediumId_fkey" FOREIGN KEY ("referenzVideoMediumId") REFERENCES "medium"("id") ON DELETE SET NULL ON UPDATE CASCADE;

