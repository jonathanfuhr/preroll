-- Zwei Felder, beide aus dem ZIP-Abruf.
--
-- `klappeMedienUrl`: der kurze Weg zu den Videodaten, wenn Klappe auf derselben
-- Maschine läuft. Gemessen: eine 115-MB-Fassung über die öffentliche Adresse
-- 131 Sekunden — sie verließ den Rechner, lief durch Cloudflare und kam zurück.
-- Über die lokale Adresse 1,1 Sekunden. In diesen zwei Minuten schrieb der
-- Server kein Byte an den Browser, und der Proxy davor räumte die Verbindung
-- ab: Der Download „hing bei X MB" und lief in eine Zeitüberschreitung.
--
-- `zipFuerKunden`: darf der Kunde die finalen Beiträge selbst herunterladen.
-- Standardmäßig aus — wer betreut wird, soll die Dateien nicht versehentlich
-- schon im Konzeptstand in der Hand haben.

ALTER TABLE "einstellungen" ADD COLUMN "klappeMedienUrl" TEXT;

ALTER TABLE "kunde" ADD COLUMN "zipFuerKunden" BOOLEAN NOT NULL DEFAULT false;
