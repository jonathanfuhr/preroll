-- LinkedIn als dritte Plattform: Zugang, App-Daten und die Zuordnung am Kunden.
--
-- Der Enum-Wert `LINKEDIN` stand von Anfang an im Schema, damit genau dieser
-- Schritt ohne Migration am Enum möglich ist. Neu sind nur die Felder.
--
-- Zwei Unterschiede zu Meta stecken darin:
--
-- · **Der Token läuft ab.** Meta liefert ein Systemnutzer-Token, das bleibt.
--   LinkedIn gibt ein Mitgliedstoken für 60 Tage plus ein Auffrischungstoken.
--   Dafür `auffrischToken` am Zugang; `gueltigBis` gab es schon.
-- · **Es gibt genau einen Zugang.** Bei Meta braucht es je Business-Portfolio
--   einen Systemnutzer, deshalb steht dort eine Liste. Bei LinkedIn hängt alles
--   an einem Konto der Agentur, das an den Firmenseiten der Kunden als
--   Administrator eingetragen ist. Erzwungen wird das im Code, nicht im Schema:
--   Ein Unique auf `plattform` würde auch Meta auf einen Zugang begrenzen.
--
-- Die Zuordnung am Kunden ist eine **eigene** und hängt nicht am Meta-Kanal.
-- Die beiden Anbieter haben nichts miteinander zu tun: Wer eine Facebook-Seite
-- zugeordnet hat, hat damit keine LinkedIn-Seite.

ALTER TABLE "plattform_zugang" ADD COLUMN "auffrischToken" TEXT;

ALTER TABLE "einstellungen" ADD COLUMN "linkedinClientId" TEXT;
ALTER TABLE "einstellungen" ADD COLUMN "linkedinClientSecret" TEXT;

ALTER TABLE "kunde" ADD COLUMN "liZugangId" TEXT;
ALTER TABLE "kunde" ADD COLUMN "liOrganisationId" TEXT;
ALTER TABLE "kunde" ADD COLUMN "liOrganisation" TEXT;

ALTER TABLE "kunde" ADD CONSTRAINT "kunde_liZugangId_fkey"
  FOREIGN KEY ("liZugangId") REFERENCES "plattform_zugang"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
