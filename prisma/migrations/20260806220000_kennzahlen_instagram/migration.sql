-- Kennzahlen über die angemeldete Instagram-Sitzung. Der Schalter steht
-- bewusst auf aus: Es ist dieselbe Sitzung wie für die Referenzvideos, und
-- wer sie nur dafür hinterlegt hat, soll sie nicht ungefragt zusätzlich
-- belasten.
ALTER TYPE "KennzahlenQuelle" ADD VALUE IF NOT EXISTS 'INSTAGRAM_WEB';

ALTER TABLE "einstellungen"
  ADD COLUMN "kennzahlenAktiv" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "kennzahlenLaufAm" TIMESTAMP(3);
