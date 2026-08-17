-- Handle, Bio, Website und die Kennzahlen liegen je Plattform.
--
-- Bisher standen sie flach am Kunden und meinten stillschweigend Instagram.
-- Sobald Facebook und LinkedIn dieselben Angaben brauchen, trägt das nicht mehr:
-- Es hätte `fbFollower`, `liFollower` und so weiter gegeben — dieselbe Sache in
-- drei Sätzen Spalten — oder die Zahlen eines Kanals hätten für alle gegolten.
--
-- Instagram bleibt trotzdem besonders: Nur seine Werte holt Preroll selbst, und
-- nur sie stehen über der Feed-Vorschau. Die ist ein Instagram-Profil und wird
-- keines von LinkedIn.

CREATE TABLE "plattform_profil" (
    "id" TEXT NOT NULL,
    "kundeId" TEXT NOT NULL,
    "plattform" "Plattform" NOT NULL,
    "handle" TEXT,
    "bio" TEXT,
    "website" TEXT,
    "follower" INTEGER,
    "gefolgt" INTEGER,
    "beitraege" INTEGER,
    "standAm" TIMESTAMP(3),
    "quelle" "KennzahlenQuelle" NOT NULL DEFAULT 'MANUELL',
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiertAm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plattform_profil_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plattform_profil_kundeId_plattform_key"
  ON "plattform_profil"("kundeId", "plattform");

ALTER TABLE "plattform_profil" ADD CONSTRAINT "plattform_profil_kundeId_fkey"
  FOREIGN KEY ("kundeId") REFERENCES "kunde"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Der Bestand wird zum Instagram-Profil. Für **jeden** Kunden eine Zeile, auch
-- für den ohne Handle: Sonst müsste jede Anzeigestelle prüfen, ob es das Profil
-- schon gibt, und der automatische Abruf fände nichts zum Nachziehen.
INSERT INTO "plattform_profil"
  ("id", "kundeId", "plattform", "handle", "bio", "website",
   "follower", "gefolgt", "beitraege", "standAm", "quelle", "aktualisiertAm")
SELECT
  gen_random_uuid()::text, "id", 'INSTAGRAM', "handle", "bio", "website",
  "follower", "gefolgt", "beitraege", "kennzahlenAm", "kennzahlenTyp", now()
FROM "kunde";

ALTER TABLE "kunde" DROP COLUMN "handle";
ALTER TABLE "kunde" DROP COLUMN "bio";
ALTER TABLE "kunde" DROP COLUMN "website";
ALTER TABLE "kunde" DROP COLUMN "follower";
ALTER TABLE "kunde" DROP COLUMN "gefolgt";
ALTER TABLE "kunde" DROP COLUMN "beitraege";
ALTER TABLE "kunde" DROP COLUMN "kennzahlenAm";
ALTER TABLE "kunde" DROP COLUMN "kennzahlenTyp";

-- Die Follower-Kurve bekommt ebenfalls eine Plattform. Ohne die Spalte hätte
-- ein zweiter Kanal die Kurve des ersten überschrieben — die Eindeutigkeit lag
-- nur auf dem Tag.
ALTER TABLE "kennzahl_verlauf"
  ADD COLUMN "plattform" "Plattform" NOT NULL DEFAULT 'INSTAGRAM';

ALTER TABLE "kennzahl_verlauf" DROP CONSTRAINT IF EXISTS "kennzahl_verlauf_kundeId_datum_key";
DROP INDEX IF EXISTS "kennzahl_verlauf_kundeId_datum_key";

CREATE UNIQUE INDEX "kennzahl_verlauf_kundeId_plattform_datum_key"
  ON "kennzahl_verlauf"("kundeId", "plattform", "datum");
