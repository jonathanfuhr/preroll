-- `#intern` im Text macht einen Kommentar zur Hausangelegenheit. Abgeleitet
-- wird das beim Schreiben, damit die Abfrage danach filtern kann — an einer
-- Anzeige, die man zu filtern vergisst, hinge sonst die Vertraulichkeit.
--
-- Bestand gilt als offen: Bis hierher konnte niemand intern kommentieren.
ALTER TABLE "kommentar" ADD COLUMN "intern" BOOLEAN NOT NULL DEFAULT false;
