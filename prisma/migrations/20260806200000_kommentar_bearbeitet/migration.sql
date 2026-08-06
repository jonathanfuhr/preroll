-- Nur gesetzt, wenn jemand den Text nachträglich ändert. Bestehende
-- Kommentare gelten damit als unverändert, was stimmt: Bearbeiten gab es
-- bis hierher nicht.
ALTER TABLE "kommentar" ADD COLUMN "bearbeitetAm" TIMESTAMP(3);
