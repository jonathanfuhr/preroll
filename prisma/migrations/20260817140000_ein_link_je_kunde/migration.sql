-- Ein Freigabelink je Kunde statt einem je Monat.
--
-- Vorher war jeder Monat eine eigene Freigabe mit eigenem Token: jeden Monat
-- eine neue Einladung, und ein Gast, der im August eingeladen war, kam im
-- September nicht mehr hinein. Der Monat ist aber keine Eigenschaft des
-- Zugangs, sondern eine Sicht darin — er steht jetzt in der Adresse
-- (`?monat=2026-08`), und welche Monate es gibt, sagen die Beiträge.
--
-- Von den vorhandenen Zeilen je Kunde bleibt die **neueste** stehen. Ihr Token
-- ist der zuletzt verschickte und damit der, den der Kunde im Postfach hat.
-- Die älteren Links werden ungültig; das ist bewusst so entschieden.
--
-- Alles, was an den älteren Zeilen hing, wandert auf die bleibende: Kommentare,
-- Freigaben, Einladungen und Gast-Sitzungen. Ohne diesen Schritt verlöre der
-- Kunde seine Anmeldung und das Team den Verlauf.

-- Die bleibende Zeile je Kunde: die mit dem spätesten Zeitraum.
CREATE TEMP TABLE bleibt AS
SELECT DISTINCT ON ("kundeId") "id" AS ziel, "kundeId"
FROM "export"
ORDER BY "kundeId", "zeitraumVon" DESC, "erstelltAm" DESC;

-- Kommentare und Freigaben umhängen.
UPDATE "kommentar" k SET "exportId" = b.ziel
FROM "export" e JOIN bleibt b ON b."kundeId" = e."kundeId"
WHERE k."exportId" = e."id" AND e."id" <> b.ziel;

UPDATE "freigabe" f SET "exportId" = b.ziel
FROM "export" e JOIN bleibt b ON b."kundeId" = e."kundeId"
WHERE f."exportId" = e."id" AND e."id" <> b.ziel;

-- Gast-Sitzungen umhängen, damit niemand ausgesperrt wird.
UPDATE "gast_session" s SET "exportId" = b.ziel
FROM "export" e JOIN bleibt b ON b."kundeId" = e."kundeId"
WHERE s."exportId" = e."id" AND e."id" <> b.ziel;

-- Einladungen: erst die verschieben, für die es am Ziel noch keine gibt —
-- `@@unique([exportId, gastId])` lässt einen Gast nur einmal je Zugang zu.
-- Der zuletzt geöffnete Zeitpunkt gewinnt, damit die Spalte etwas aussagt.
UPDATE "export_gast" g SET "exportId" = b.ziel
FROM "export" e JOIN bleibt b ON b."kundeId" = e."kundeId"
WHERE g."exportId" = e."id" AND e."id" <> b.ziel
  AND NOT EXISTS (
    SELECT 1 FROM "export_gast" vorhanden
    WHERE vorhanden."exportId" = b.ziel AND vorhanden."gastId" = g."gastId"
  );

-- Was jetzt noch an den alten Zugängen hängt, sind genau die Duplikate. Ihr
-- spätester Zeitpunkt gewinnt, damit „zuletzt geöffnet" nach dem
-- Zusammenführen noch etwas aussagt; GREATEST übergeht NULL von selbst.
--
-- Als Unterabfrage und nicht als JOIN mit GROUP BY: Ein UPDATE verträgt kein
-- GROUP BY — Postgres quittiert das mit „syntax error at or near GROUP".
UPDATE "export_gast" ziel
SET "zuletztGeoeffnetAm" = GREATEST(ziel."zuletztGeoeffnetAm", neu.spaetester)
FROM (
  SELECT b.ziel AS zielId, g."gastId", MAX(g."zuletztGeoeffnetAm") AS spaetester
  FROM "export_gast" g
  JOIN "export" e ON e."id" = g."exportId"
  JOIN bleibt b ON b."kundeId" = e."kundeId"
  WHERE g."exportId" <> b.ziel
  GROUP BY b.ziel, g."gastId"
) neu
WHERE ziel."exportId" = neu.zielId AND ziel."gastId" = neu."gastId";

-- Die Aufrufe der alten Monate zusammenzählen, sonst stünde der Zugang eines
-- lange betreuten Kunden bei den Zahlen eines einzigen Monats.
UPDATE "export" ziel
SET "aufrufe" = summe.aufrufe,
    "zuletztGeoeffnet" = summe.geoeffnet
FROM (
  SELECT b.ziel, SUM(e."aufrufe")::int AS aufrufe, MAX(e."zuletztGeoeffnet") AS geoeffnet
  FROM "export" e JOIN bleibt b ON b."kundeId" = e."kundeId"
  GROUP BY b.ziel
) summe
WHERE ziel."id" = summe.ziel;

-- Was jetzt nichts mehr trägt, fällt weg. Verbliebene Einladungen der alten
-- Zeilen sind Duplikate — der Gast hängt schon am Ziel.
DELETE FROM "export" WHERE "id" NOT IN (SELECT ziel FROM bleibt);

DROP TABLE bleibt;

-- Erst jetzt das Schema: vorher hätte die Eindeutigkeit auf `kundeId` die
-- Bestandszeilen abgewiesen.
--
-- Die Eindeutigkeit ist eine *Bedingung*, kein bloßer Index — `DROP INDEX`
-- lehnt Postgres ab und verweist auf die Bedingung („requires it").
ALTER TABLE "export" DROP CONSTRAINT IF EXISTS "export_kundeId_zeitraumVon_key";
DROP INDEX IF EXISTS "export_kundeId_idx";

ALTER TABLE "export" DROP COLUMN "zeitraumVon";
ALTER TABLE "export" DROP COLUMN "zeitraumBis";

CREATE UNIQUE INDEX "export_kundeId_key" ON "export"("kundeId");
