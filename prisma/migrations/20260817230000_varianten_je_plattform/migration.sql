-- Abweichende Fassungen eines Beitrags je Plattform.
--
-- Dieselbe Sache liest sich auf LinkedIn anders als auf Instagram, und ein
-- 4:5-Bild sitzt dort falsch. Ein zweiter Beitrag wäre die naheliegende Lösung
-- gewesen und die falsche: Er hätte einen eigenen Termin, einen eigenen
-- Freigabestand und eine eigene Zeile im Kalender, obwohl es **eine** Sache ist,
-- die einmal freigegeben wird.
--
-- Leer heißt geerbt, Feld für Feld. Deshalb sind `caption` und `verhaeltnis`
-- optional: Eine Fassung, die alles wiederholen müsste, veraltet beim nächsten
-- Umbau des Hauptbeitrags, ohne dass es jemandem auffällt.
--
-- Nichts wird migriert — bestehende Beiträge haben keine Fassungen und
-- verhalten sich unverändert.

CREATE TABLE "post_variante" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "plattformen" "Plattform"[],
    "caption" TEXT,
    "verhaeltnis" "Verhaeltnis",
    "position" INTEGER NOT NULL DEFAULT 0,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiertAm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_variante_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "post_variante_postId_idx" ON "post_variante"("postId");

ALTER TABLE "post_variante" ADD CONSTRAINT "post_variante_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Eigene Tabelle statt `varianteId` an `post_medium`. Dort bewacht
-- `@@unique([postId, rolle, position])`, dass ein Beitrag nicht zwei Slides auf
-- derselben Position hat. Mit einer zusätzlichen, meist leeren Spalte wäre das
-- dahin: Postgres hält NULL-Werte für verschieden, und der Hauptbeitrag hätte
-- seine Bewachung verloren, ohne dass es auffällt.
CREATE TABLE "post_variante_medium" (
    "id" TEXT NOT NULL,
    "varianteId" TEXT NOT NULL,
    "mediumId" TEXT NOT NULL,
    "rolle" "MediumRolle" NOT NULL DEFAULT 'MEDIUM',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_variante_medium_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "post_variante_medium_varianteId_rolle_position_key"
  ON "post_variante_medium"("varianteId", "rolle", "position");
CREATE INDEX "post_variante_medium_mediumId_idx" ON "post_variante_medium"("mediumId");

ALTER TABLE "post_variante_medium" ADD CONSTRAINT "post_variante_medium_varianteId_fkey"
  FOREIGN KEY ("varianteId") REFERENCES "post_variante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_variante_medium" ADD CONSTRAINT "post_variante_medium_mediumId_fkey"
  FOREIGN KEY ("mediumId") REFERENCES "medium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
