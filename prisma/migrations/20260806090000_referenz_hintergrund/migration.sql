-- Der Referenzvideo-Download läuft im Hintergrund weiter, auch wenn der
-- Medien-Dialog geschlossen wird. Sein Stand muss deshalb die Anfrage
-- überdauern und steht in der Datenbank.
CREATE TYPE "Ladestand" AS ENUM ('LAEUFT', 'FERTIG', 'FEHLER');

ALTER TABLE "post" ADD COLUMN "referenzVideoStand" "Ladestand";
ALTER TABLE "post" ADD COLUMN "referenzVideoFortschritt" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "post" ADD COLUMN "referenzVideoMeldung" TEXT;
