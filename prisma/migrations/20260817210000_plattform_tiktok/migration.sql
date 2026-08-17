-- TikTok kommt als vierte bespielbare Plattform dazu.
--
-- Nur Planung: Ein Kanal lässt sich nicht zuordnen, weil es dafür keinen
-- Zugang gibt — „planen und posten" bleibt deshalb gesperrt.
--
-- Der Typ wird **ersetzt**, nicht mit `ALTER TYPE … ADD VALUE` erweitert:
-- Das läuft nicht in einer Transaktion, und der Migrationslauf klammert
-- jede Migration in eine (`scripts/db-migrate.ts`). Ein Wert, der nur bei
-- gutem Wetter ankommt, wäre die schlechtere Wahl.

-- Die Vorgaben hängen am alten Typ und müssen vorher weg.
ALTER TABLE "kunde" ALTER COLUMN "plattformen" DROP DEFAULT;
ALTER TABLE "kunde" ALTER COLUMN "postenPlattformen" DROP DEFAULT;
ALTER TABLE "kennzahl_verlauf" ALTER COLUMN "plattform" DROP DEFAULT;

ALTER TYPE "Plattform" RENAME TO "Plattform_alt";

CREATE TYPE "Plattform" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TIKTOK', 'YOUTUBE');

ALTER TABLE "kunde"
  ALTER COLUMN "plattformen" TYPE "Plattform"[] USING "plattformen"::text[]::"Plattform"[],
  ALTER COLUMN "postenPlattformen" TYPE "Plattform"[] USING "postenPlattformen"::text[]::"Plattform"[];
ALTER TABLE "post" ALTER COLUMN "plattformen" TYPE "Plattform"[] USING "plattformen"::text[]::"Plattform"[];
ALTER TABLE "post_variante" ALTER COLUMN "plattformen" TYPE "Plattform"[] USING "plattformen"::text[]::"Plattform"[];
ALTER TABLE "kennzahl_verlauf" ALTER COLUMN "plattform" TYPE "Plattform" USING "plattform"::text::"Plattform";
ALTER TABLE "plattform_profil" ALTER COLUMN "plattform" TYPE "Plattform" USING "plattform"::text::"Plattform";
ALTER TABLE "plattform_zugang" ALTER COLUMN "plattform" TYPE "Plattform" USING "plattform"::text::"Plattform";
ALTER TABLE "veroeffentlichung" ALTER COLUMN "plattform" TYPE "Plattform" USING "plattform"::text::"Plattform";

DROP TYPE "Plattform_alt";

ALTER TABLE "kunde"
  ALTER COLUMN "plattformen" SET DEFAULT ARRAY['INSTAGRAM', 'FACEBOOK']::"Plattform"[],
  ALTER COLUMN "postenPlattformen" SET DEFAULT ARRAY[]::"Plattform"[];
ALTER TABLE "kennzahl_verlauf" ALTER COLUMN "plattform" SET DEFAULT 'INSTAGRAM';
