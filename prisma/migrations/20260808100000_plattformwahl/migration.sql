-- Plattformwahl je Kunde und je Beitrag.
--
-- Bisher ergab sich das Ziel allein aus der Zuordnung: Wer eine Facebook-Seite
-- hatte, bekam Facebook und Instagram. Jetzt ist es eine Entscheidung — am
-- Kunden als Vorbelegung, am einzelnen Beitrag als Abweichung davon.

ALTER TABLE "kunde" ADD COLUMN     "plattformen" "Plattform"[] DEFAULT ARRAY['INSTAGRAM', 'FACEBOOK']::"Plattform"[];

ALTER TABLE "post" ADD COLUMN     "plattformen" "Plattform"[];

-- Bestand: Beiträge erben die Wahl ihres Kunden. Ohne diesen Schritt stünden
-- alle vorhandenen Beiträge auf „nirgendwohin" — und ein Werkzeug, das nach
-- einer Migration aufhört zu posten, ist schlimmer als eines, das es nie tat.
UPDATE "post" SET "plattformen" = "kunde"."plattformen"
FROM "kunde"
WHERE "post"."kundeId" = "kunde"."id";
