-- Upload, Klappe und Link-Download füllen denselben Platz. Bereits geladene
-- Referenzvideos werden als MEDIUM angehängt, wo dort noch nichts liegt —
-- einen eigenen Referenzvideo-Platz gibt es danach nicht mehr. Liegt an
-- beiden Stellen ein Video, gewinnt das MEDIUM; die Referenzkopie bleibt als
-- Medium in der Bibliothek erhalten.
INSERT INTO "post_medium" ("id", "postId", "mediumId", "rolle", "position")
SELECT gen_random_uuid()::text, p."id", p."referenzVideoMediumId", 'MEDIUM', 0
FROM "post" p
WHERE p."referenzVideoMediumId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "post_medium" pm
    WHERE pm."postId" = p."id" AND pm."rolle" = 'MEDIUM'
  );

ALTER TABLE "post" DROP CONSTRAINT IF EXISTS "post_referenzVideoMediumId_fkey";
ALTER TABLE "post" DROP COLUMN "referenzVideoMediumId";
ALTER TABLE "post" DROP COLUMN "referenzVideoPfad";
ALTER TABLE "post" DROP COLUMN "referenzVideoTitel";

-- Der Download-Stand bleibt, nur der Name wird ehrlich: Es ist kein
-- Referenzvideo, sondern der Video-Download.
ALTER TABLE "post" RENAME COLUMN "referenzVideoUrl" TO "videoDownloadUrl";
ALTER TABLE "post" RENAME COLUMN "referenzVideoStand" TO "videoDownloadStand";
ALTER TABLE "post" RENAME COLUMN "referenzVideoFortschritt" TO "videoDownloadFortschritt";
ALTER TABLE "post" RENAME COLUMN "referenzVideoMeldung" TO "videoDownloadMeldung";
