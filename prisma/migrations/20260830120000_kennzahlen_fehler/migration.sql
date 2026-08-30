-- Ein Fehlschlag beim Kennzahlen-Abruf hinterlässt jetzt eine Spur.
--
-- Ohne sie war „keine Zahlen" nicht von „Abruf scheitert seit Tagen" zu
-- unterscheiden, und der Lauf zog dasselbe aussichtslose Profil alle zwanzig
-- Minuten wieder heran.
ALTER TABLE "plattform_profil" ADD COLUMN "letzterVersuchAm" TIMESTAMP(3);
ALTER TABLE "plattform_profil" ADD COLUMN "letzterFehler" TEXT;
