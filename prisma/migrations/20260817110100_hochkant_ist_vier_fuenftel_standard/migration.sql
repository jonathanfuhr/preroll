-- Teil 2: Neue Beiträge starten in 4:5.
--
-- Eigene Migration, weil Postgres einen Enum-Wert nicht in derselben
-- Transaktion benutzen lässt, in der er angelegt wurde.
ALTER TABLE "post" ALTER COLUMN "verhaeltnis" SET DEFAULT 'HOCH_4_5';
