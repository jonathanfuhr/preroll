-- Das Seitenverhältnis steht ab jetzt neben dem Typ statt darin: Beiträge
-- und Karussells können auch 1:1, Karussells zusätzlich 9:16, Reels auch
-- 1:1 und 16:9. Bestand behält, was der Typ bisher bedeutete.
CREATE TYPE "Verhaeltnis" AS ENUM ('HOCH_3_4', 'QUADRAT_1_1', 'VERTIKAL_9_16', 'QUER_16_9');

ALTER TABLE "post" ADD COLUMN "verhaeltnis" "Verhaeltnis" NOT NULL DEFAULT 'HOCH_3_4';

UPDATE "post" SET "verhaeltnis" = 'VERTIKAL_9_16' WHERE "typ" = 'REEL';
