-- Zwei Arbeitsphasen und der Stand, den der Kunde darin weiter sieht.
--
-- Der Typ wird ersetzt, nicht erweitert: `ALTER TYPE … ADD VALUE` läuft nicht
-- in einer Transaktion, und der Migrationslauf klammert jede Migration in eine
-- (`scripts/db-migrate.ts`).
ALTER TABLE "post" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "PostStatus" RENAME TO "PostStatus_alt";
CREATE TYPE "PostStatus" AS ENUM ('ENTWURF', 'KONZEPT', 'PRODUKTION', 'VORSCHAU', 'KORREKTUR', 'FINAL');

ALTER TABLE "post"
  ALTER COLUMN "status" TYPE "PostStatus" USING "status"::text::"PostStatus";

DROP TYPE "PostStatus_alt";

ALTER TABLE "post" ALTER COLUMN "status" SET DEFAULT 'KONZEPT';

-- Der festgeschriebene Stand je sichtbarer Phase.
CREATE TABLE "post_stand" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "phase" "PostStatus" NOT NULL,
  "inhalt" JSONB NOT NULL,
  "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "post_stand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "post_stand_postId_phase_key" ON "post_stand"("postId", "phase");

ALTER TABLE "post_stand" ADD CONSTRAINT "post_stand_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
