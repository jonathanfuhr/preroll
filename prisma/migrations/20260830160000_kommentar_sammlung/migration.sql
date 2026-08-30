-- Kommentar-Mails sammeln, statt je Kommentar eine zu schicken.
--
-- Wer einen Monatsplan durchgeht, kommentiert fünf Beiträge in zwei Minuten —
-- und löste damit fünf Mails an dieselbe Person aus. Gesammelt wird je Kunde,
-- verschickt fünf Minuten nach dem letzten Kommentar.
CREATE TABLE "kommentar_sammlung" (
  "id" TEXT NOT NULL,
  "kundeId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "kommentarId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "kommentar_sammlung_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "kommentar_sammlung_kundeId_email_idx" ON "kommentar_sammlung"("kundeId", "email");
CREATE INDEX "kommentar_sammlung_erstelltAm_idx" ON "kommentar_sammlung"("erstelltAm");

ALTER TABLE "kommentar_sammlung" ADD CONSTRAINT "kommentar_sammlung_kundeId_fkey"
  FOREIGN KEY ("kundeId") REFERENCES "kunde"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kommentar_sammlung" ADD CONSTRAINT "kommentar_sammlung_kommentarId_fkey"
  FOREIGN KEY ("kommentarId") REFERENCES "kommentar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
