-- Fehlgeschlagene Veröffentlichungen sollen auffallen, statt nur in der
-- Leiste über dem Formular zu stehen. Dafür zwei Merker, damit dieselbe
-- Ursache nicht mehrfach gemeldet wird:
--
--   veroeffentlichung.gemeldetAm  je Fehlschlag eine Meldung; wird beim
--                                 Wiederbeleben zurückgesetzt, damit ein
--                                 erneuter Fehlschlag wieder meldet.
--   plattform_zugang.gemeldetAm   ein toter Zugang lässt jeden fälligen
--                                 Beitrag scheitern. Gemeldet wird dann der
--                                 Zugang, einmal, statt jeder Beitrag einzeln.
--
-- ALTER TYPE ... ADD VALUE lässt sich in älteren Postgres-Fassungen nicht mit
-- anderen Anweisungen in einer Transaktion mischen. Seit Postgres 12 geht es;
-- der Container fährt 18.
ALTER TYPE "BenachrichtigungArt" ADD VALUE 'VEROEFFENTLICHUNG';

ALTER TABLE "veroeffentlichung" ADD COLUMN "gemeldetAm" TIMESTAMP(3);
ALTER TABLE "plattform_zugang" ADD COLUMN "gemeldetAm" TIMESTAMP(3);
