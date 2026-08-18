-- TikToks Zahlen: Likes als eigene Spalte, TIKTOK_WEB als eigene Quelle.
--
-- „Likes" ist die Summe der Herzen über alle Videos und steht bei TikTok im
-- Profil neben Followern und Folge-ich. Instagram und LinkedIn zeigen sie
-- nicht — dort bleibt die Spalte leer.
ALTER TABLE "plattform_profil" ADD COLUMN "likes" INTEGER;
ALTER TABLE "kennzahl_verlauf" ADD COLUMN "likes" INTEGER;

-- Der Typ wird ersetzt, nicht erweitert: `ALTER TYPE … ADD VALUE` läuft nicht
-- in einer Transaktion, und der Migrationslauf klammert jede Migration in eine
-- (`scripts/db-migrate.ts`). Dieselbe Begründung wie beim Plattform-Enum.
ALTER TABLE "plattform_profil" ALTER COLUMN "quelle" DROP DEFAULT;
ALTER TABLE "kennzahl_verlauf" ALTER COLUMN "quelle" DROP DEFAULT;

ALTER TYPE "KennzahlenQuelle" RENAME TO "KennzahlenQuelle_alt";
CREATE TYPE "KennzahlenQuelle" AS ENUM ('MANUELL', 'INSTAGRAM_WEB', 'TIKTOK_WEB', 'GRAPH_API');

ALTER TABLE "plattform_profil"
  ALTER COLUMN "quelle" TYPE "KennzahlenQuelle" USING "quelle"::text::"KennzahlenQuelle";
ALTER TABLE "kennzahl_verlauf"
  ALTER COLUMN "quelle" TYPE "KennzahlenQuelle" USING "quelle"::text::"KennzahlenQuelle";

DROP TYPE "KennzahlenQuelle_alt";

ALTER TABLE "plattform_profil" ALTER COLUMN "quelle" SET DEFAULT 'MANUELL';
ALTER TABLE "kennzahl_verlauf" ALTER COLUMN "quelle" SET DEFAULT 'MANUELL';
