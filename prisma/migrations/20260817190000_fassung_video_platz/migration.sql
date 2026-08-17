-- Der Video-Platz einer Fassung: dieselben drei Quellen wie am Beitrag.
--
-- Bis hierher konnte eine Fassung nur ein hochgeladenes Video tragen. Klappe
-- und der Link-Download hingen am Beitrag und hätten, über ihn geführt, das
-- Video der anderen Plattformen mit überschrieben.
ALTER TABLE "post_variante" ADD COLUMN     "klappeStandAm" TIMESTAMP(3),
ADD COLUMN     "klappeVersionId" TEXT,
ADD COLUMN     "klappeVersionNummer" INTEGER,
ADD COLUMN     "klappeVideoId" TEXT,
ADD COLUMN     "klappeVideoName" TEXT,
ADD COLUMN     "klappeVideoUrl" TEXT,
ADD COLUMN     "videoDownloadFortschritt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "videoDownloadMeldung" TEXT,
ADD COLUMN     "videoDownloadStand" "Ladestand",
ADD COLUMN     "videoDownloadUrl" TEXT;
