-- Je Plattform ein Modus: aus, nur planen, planen und posten.
--
-- Bisher hieß „gewählt" zugleich „wird gepostet", und wählbar war nur, wofür
-- ein Kanal zugeordnet war. Damit ließ sich nicht ausdrücken, was der
-- Normalfall ist: für Instagram planen und von Hand posten.
--
-- `plattformen` heißt ab jetzt „wird bespielt" (aus oder nicht), die neue
-- Spalte nennt die Teilmenge, die Preroll selbst postet.
ALTER TABLE "kunde" ADD COLUMN "postenPlattformen" "Plattform"[] DEFAULT ARRAY[]::"Plattform"[];

-- Bestand: Wo Preroll bisher selbst gepostet hat, galt das für alle gewählten
-- Plattformen mit Kanal. Ohne Kanal war es ohnehin wirkungslos.
UPDATE "kunde"
SET "postenPlattformen" = (
  SELECT COALESCE(array_agg(p), ARRAY[]::"Plattform"[])
  FROM unnest("plattformen") AS p
  WHERE (p = 'FACEBOOK' AND "fbSeitenId" IS NOT NULL)
     OR (p = 'INSTAGRAM' AND "igKontoId" IS NOT NULL)
)
WHERE "postenAktiv" = true;
