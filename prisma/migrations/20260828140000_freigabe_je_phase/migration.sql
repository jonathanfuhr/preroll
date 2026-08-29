-- Jede Phase außer Final trägt eine Freigabe; die internen kommen vom Team.
--
-- Typtausch statt `ALTER TYPE … ADD VALUE`, wie überall in diesem Projekt:
-- Letzteres läuft nicht in einer Transaktion, und der Migrationslauf klammert
-- jede Migration in eine (`scripts/db-migrate.ts`).
ALTER TYPE "Freigabestufe" RENAME TO "Freigabestufe_alt";
CREATE TYPE "Freigabestufe" AS ENUM ('ENTWURF', 'KONZEPT', 'PRODUKTION', 'VORSCHAU', 'KORREKTUR');

ALTER TABLE "freigabe"
  ALTER COLUMN "stufe" TYPE "Freigabestufe" USING "stufe"::text::"Freigabestufe";

DROP TYPE "Freigabestufe_alt";
