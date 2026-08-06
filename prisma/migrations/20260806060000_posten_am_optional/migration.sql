-- Posts dürfen ungeplant sein: ohne Termin stehen sie im Kalender in der
-- Spalte „Ungeplant“ und werden von dort auf einen Tag gezogen.
ALTER TABLE "post" ALTER COLUMN "postenAm" DROP NOT NULL;
