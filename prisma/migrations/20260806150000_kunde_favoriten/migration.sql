-- Angeheftete Kunden, je Nutzer. Wer drei Kunden betreut, will genau die in
-- der Seitenleiste, nicht alle zwanzig.
CREATE TABLE "kunde_favorit" (
    "id" TEXT NOT NULL,
    "nutzerId" TEXT NOT NULL,
    "kundeId" TEXT NOT NULL,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kunde_favorit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "kunde_favorit_nutzerId_kundeId_key" ON "kunde_favorit"("nutzerId", "kundeId");
CREATE INDEX "kunde_favorit_kundeId_idx" ON "kunde_favorit"("kundeId");

ALTER TABLE "kunde_favorit" ADD CONSTRAINT "kunde_favorit_nutzerId_fkey"
  FOREIGN KEY ("nutzerId") REFERENCES "nutzer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kunde_favorit" ADD CONSTRAINT "kunde_favorit_kundeId_fkey"
  FOREIGN KEY ("kundeId") REFERENCES "kunde"("id") ON DELETE CASCADE ON UPDATE CASCADE;
