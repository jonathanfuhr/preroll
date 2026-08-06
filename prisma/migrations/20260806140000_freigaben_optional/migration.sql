-- Für eigene Kanäle gibt es niemanden, der freigeben müsste.
ALTER TABLE "kunde" ADD COLUMN "freigabenNoetig" BOOLEAN NOT NULL DEFAULT true;
