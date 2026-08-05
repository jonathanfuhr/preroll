-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rolle" AS ENUM ('ADMIN', 'MITGLIED');

-- CreateEnum
CREATE TYPE "KennzahlenQuelle" AS ENUM ('MANUELL', 'GRAPH_API');

-- CreateEnum
CREATE TYPE "PostTyp" AS ENUM ('REEL', 'KARUSSELL', 'BEITRAG');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('KONZEPT', 'VORSCHAU', 'FINAL');

-- CreateEnum
CREATE TYPE "MediumRolle" AS ENUM ('MEDIUM', 'SLIDE', 'THUMBNAIL');

-- CreateEnum
CREATE TYPE "CustomFeldTyp" AS ENUM ('TEXT', 'DATUM', 'JANEIN');

-- CreateEnum
CREATE TYPE "KommentarStatus" AS ENUM ('OFFEN', 'ERLEDIGT');

-- CreateEnum
CREATE TYPE "MailTransport" AS ENUM ('SMTP', 'MICROSOFT365', 'GOOGLE', 'DEAKTIVIERT');

-- CreateTable
CREATE TABLE "nutzer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initialen" VARCHAR(4) NOT NULL,
    "passwortHash" TEXT,
    "oidcSubjekt" TEXT,
    "rolle" "Rolle" NOT NULL DEFAULT 'MITGLIED',
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "mailBenachrichtigungen" BOOLEAN NOT NULL DEFAULT true,
    "pushBenachrichtigungen" BOOLEAN NOT NULL DEFAULT true,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiertAm" TIMESTAMP(3) NOT NULL,
    "zuletztAktivAm" TIMESTAMP(3),

    CONSTRAINT "nutzer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutzer_session" (
    "id" TEXT NOT NULL,
    "nutzerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "laeuftAbAm" TIMESTAMP(3) NOT NULL,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nutzer_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gast" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zuletztAktivAm" TIMESTAMP(3),
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mailBenachrichtigungen" BOOLEAN NOT NULL DEFAULT true,
    "pushBenachrichtigungen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "gast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_gast" (
    "id" TEXT NOT NULL,
    "exportId" TEXT NOT NULL,
    "gastId" TEXT NOT NULL,
    "eingeladenAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eingeladenVonId" TEXT,
    "zuletztGeoeffnetAm" TIMESTAMP(3),

    CONSTRAINT "export_gast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gast_session" (
    "id" TEXT NOT NULL,
    "gastId" TEXT NOT NULL,
    "exportId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "laeuftAbAm" TIMESTAMP(3) NOT NULL,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gast_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_code" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "exportId" TEXT,
    "versuche" INTEGER NOT NULL DEFAULT 0,
    "eingelöstAm" TIMESTAMP(3),
    "laeuftAbAm" TIMESTAMP(3) NOT NULL,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kunde" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "handle" TEXT,
    "logoId" TEXT,
    "notiz" TEXT,
    "archiviert" BOOLEAN NOT NULL DEFAULT false,
    "follower" INTEGER,
    "gefolgt" INTEGER,
    "beitraege" INTEGER,
    "bio" TEXT,
    "website" TEXT,
    "kennzahlenAm" TIMESTAMP(3),
    "kennzahlenTyp" "KennzahlenQuelle" NOT NULL DEFAULT 'MANUELL',
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiertAm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kunde_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kennzahl_verlauf" (
    "id" TEXT NOT NULL,
    "kundeId" TEXT NOT NULL,
    "datum" DATE NOT NULL,
    "follower" INTEGER,
    "gefolgt" INTEGER,
    "beitraege" INTEGER,
    "quelle" "KennzahlenQuelle" NOT NULL DEFAULT 'MANUELL',

    CONSTRAINT "kennzahl_verlauf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ansprechpartner" (
    "id" TEXT NOT NULL,
    "kundeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rolle" TEXT,
    "telefon" TEXT,
    "email" TEXT,
    "adresse" TEXT,
    "website" TEXT,
    "fotoId" TEXT,
    "standard" BOOLEAN NOT NULL DEFAULT false,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiertAm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ansprechpartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medium" (
    "id" TEXT NOT NULL,
    "kundeId" TEXT,
    "dateiname" TEXT NOT NULL,
    "pfad" TEXT NOT NULL,
    "mimeTyp" TEXT NOT NULL,
    "groesse" INTEGER NOT NULL,
    "breite" INTEGER NOT NULL,
    "hoehe" INTEGER NOT NULL,
    "thumbPfad" TEXT,
    "quelleId" TEXT,
    "hochgeladenVonId" TEXT,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medium_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post" (
    "id" TEXT NOT NULL,
    "kundeId" TEXT NOT NULL,
    "typ" "PostTyp" NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'KONZEPT',
    "postenAm" TIMESTAMP(3) NOT NULL,
    "titel" TEXT NOT NULL,
    "kurzbeschreibung" TEXT,
    "caption" TEXT NOT NULL DEFAULT '',
    "laenge" TEXT,
    "ziel" TEXT,
    "stil" TEXT,
    "verantwortlichId" TEXT,
    "szenenplanAktiv" BOOLEAN NOT NULL DEFAULT true,
    "inhalte" TEXT,
    "referenzVideoUrl" TEXT,
    "referenzVideoTitel" TEXT,
    "referenzVideoPfad" TEXT,
    "klappeVideoId" TEXT,
    "klappeVideoUrl" TEXT,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiertAm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_medium" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "mediumId" TEXT NOT NULL,
    "rolle" "MediumRolle" NOT NULL DEFAULT 'MEDIUM',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_medium_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "szene" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "abschnitt" TEXT NOT NULL DEFAULT 'Szene',
    "bildSzene" TEXT,
    "sprechertext" TEXT,
    "texteinblendung" TEXT,

    CONSTRAINT "szene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_feld_definition" (
    "id" TEXT NOT NULL,
    "kundeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typ" "CustomFeldTyp" NOT NULL DEFAULT 'TEXT',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "custom_feld_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_feld_wert" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "wert" TEXT,

    CONSTRAINT "custom_feld_wert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export" (
    "id" TEXT NOT NULL,
    "kundeId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "titel" TEXT,
    "zeitraumVon" DATE NOT NULL,
    "zeitraumBis" DATE NOT NULL,
    "gueltigBis" TIMESTAMP(3),
    "ansprechpartnerId" TEXT,
    "kommentareErlaubt" BOOLEAN NOT NULL DEFAULT true,
    "freigabeButtonZeigen" BOOLEAN NOT NULL DEFAULT true,
    "konzepteMitzeigen" BOOLEAN NOT NULL DEFAULT false,
    "loginPflicht" BOOLEAN NOT NULL DEFAULT false,
    "aufrufe" INTEGER NOT NULL DEFAULT 0,
    "zuletztGeoeffnet" TIMESTAMP(3),
    "freigegebenAm" TIMESTAMP(3),
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiertAm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freigabe" (
    "id" TEXT NOT NULL,
    "exportId" TEXT NOT NULL,
    "gastId" TEXT,
    "autorName" TEXT NOT NULL,
    "notiz" TEXT,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "freigabe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kommentar" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "exportId" TEXT,
    "abschnitt" TEXT NOT NULL DEFAULT 'allgemein',
    "autorName" TEXT NOT NULL,
    "autorEmail" TEXT,
    "gastId" TEXT,
    "nutzerId" TEXT,
    "text" TEXT NOT NULL,
    "status" "KommentarStatus" NOT NULL DEFAULT 'OFFEN',
    "antwortAufId" TEXT,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiertAm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kommentar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_abo" (
    "id" TEXT NOT NULL,
    "nutzerId" TEXT,
    "gastId" TEXT,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_abo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "einstellungen" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "workspaceName" TEXT NOT NULL DEFAULT 'Preroll',
    "logoUrl" TEXT,
    "akzentfarbe" TEXT NOT NULL DEFAULT '#b00900',
    "lokalerLoginErlaubt" BOOLEAN NOT NULL DEFAULT true,
    "m365LoginErlaubt" BOOLEAN NOT NULL DEFAULT false,
    "m365TenantId" TEXT,
    "m365ClientId" TEXT,
    "m365ClientSecret" TEXT,
    "mailTransport" "MailTransport" NOT NULL DEFAULT 'DEAKTIVIERT',
    "mailVonName" TEXT,
    "mailVonAdresse" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpSicher" BOOLEAN NOT NULL DEFAULT true,
    "smtpBenutzer" TEXT,
    "smtpPasswort" TEXT,
    "msTenantId" TEXT,
    "msClientId" TEXT,
    "msClientSecret" TEXT,
    "msPostfach" TEXT,
    "googleClientId" TEXT,
    "googleClientSecret" TEXT,
    "googleRefreshToken" TEXT,
    "googleAbsender" TEXT,
    "vapidPublicKey" TEXT,
    "vapidPrivateKey" TEXT,
    "klappeBasisUrl" TEXT,
    "klappeApiKey" TEXT,
    "aktualisiertAm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "einstellungen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nutzer_email_key" ON "nutzer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "nutzer_oidcSubjekt_key" ON "nutzer"("oidcSubjekt");

-- CreateIndex
CREATE UNIQUE INDEX "nutzer_session_tokenHash_key" ON "nutzer_session"("tokenHash");

-- CreateIndex
CREATE INDEX "nutzer_session_nutzerId_idx" ON "nutzer_session"("nutzerId");

-- CreateIndex
CREATE UNIQUE INDEX "gast_email_key" ON "gast"("email");

-- CreateIndex
CREATE INDEX "export_gast_gastId_idx" ON "export_gast"("gastId");

-- CreateIndex
CREATE UNIQUE INDEX "export_gast_exportId_gastId_key" ON "export_gast"("exportId", "gastId");

-- CreateIndex
CREATE UNIQUE INDEX "gast_session_tokenHash_key" ON "gast_session"("tokenHash");

-- CreateIndex
CREATE INDEX "gast_session_gastId_idx" ON "gast_session"("gastId");

-- CreateIndex
CREATE INDEX "login_code_email_idx" ON "login_code"("email");

-- CreateIndex
CREATE UNIQUE INDEX "kunde_slug_key" ON "kunde"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "kennzahl_verlauf_kundeId_datum_key" ON "kennzahl_verlauf"("kundeId", "datum");

-- CreateIndex
CREATE INDEX "ansprechpartner_kundeId_idx" ON "ansprechpartner"("kundeId");

-- CreateIndex
CREATE INDEX "medium_kundeId_idx" ON "medium"("kundeId");

-- CreateIndex
CREATE INDEX "post_kundeId_postenAm_idx" ON "post"("kundeId", "postenAm");

-- CreateIndex
CREATE INDEX "post_medium_mediumId_idx" ON "post_medium"("mediumId");

-- CreateIndex
CREATE UNIQUE INDEX "post_medium_postId_rolle_position_key" ON "post_medium"("postId", "rolle", "position");

-- CreateIndex
CREATE UNIQUE INDEX "szene_postId_position_key" ON "szene"("postId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "custom_feld_definition_kundeId_name_key" ON "custom_feld_definition"("kundeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "custom_feld_wert_postId_definitionId_key" ON "custom_feld_wert"("postId", "definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "export_token_key" ON "export"("token");

-- CreateIndex
CREATE INDEX "export_kundeId_idx" ON "export"("kundeId");

-- CreateIndex
CREATE INDEX "freigabe_exportId_idx" ON "freigabe"("exportId");

-- CreateIndex
CREATE INDEX "kommentar_postId_idx" ON "kommentar"("postId");

-- CreateIndex
CREATE INDEX "kommentar_exportId_idx" ON "kommentar"("exportId");

-- CreateIndex
CREATE UNIQUE INDEX "push_abo_endpoint_key" ON "push_abo"("endpoint");

-- CreateIndex
CREATE INDEX "push_abo_nutzerId_idx" ON "push_abo"("nutzerId");

-- CreateIndex
CREATE INDEX "push_abo_gastId_idx" ON "push_abo"("gastId");

-- AddForeignKey
ALTER TABLE "nutzer_session" ADD CONSTRAINT "nutzer_session_nutzerId_fkey" FOREIGN KEY ("nutzerId") REFERENCES "nutzer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_gast" ADD CONSTRAINT "export_gast_exportId_fkey" FOREIGN KEY ("exportId") REFERENCES "export"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_gast" ADD CONSTRAINT "export_gast_gastId_fkey" FOREIGN KEY ("gastId") REFERENCES "gast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_gast" ADD CONSTRAINT "export_gast_eingeladenVonId_fkey" FOREIGN KEY ("eingeladenVonId") REFERENCES "nutzer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gast_session" ADD CONSTRAINT "gast_session_gastId_fkey" FOREIGN KEY ("gastId") REFERENCES "gast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gast_session" ADD CONSTRAINT "gast_session_exportId_fkey" FOREIGN KEY ("exportId") REFERENCES "export"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kunde" ADD CONSTRAINT "kunde_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "medium"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kennzahl_verlauf" ADD CONSTRAINT "kennzahl_verlauf_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "kunde"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ansprechpartner" ADD CONSTRAINT "ansprechpartner_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "kunde"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ansprechpartner" ADD CONSTRAINT "ansprechpartner_fotoId_fkey" FOREIGN KEY ("fotoId") REFERENCES "medium"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medium" ADD CONSTRAINT "medium_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "kunde"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medium" ADD CONSTRAINT "medium_quelleId_fkey" FOREIGN KEY ("quelleId") REFERENCES "medium"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medium" ADD CONSTRAINT "medium_hochgeladenVonId_fkey" FOREIGN KEY ("hochgeladenVonId") REFERENCES "nutzer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "kunde"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_verantwortlichId_fkey" FOREIGN KEY ("verantwortlichId") REFERENCES "nutzer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_medium" ADD CONSTRAINT "post_medium_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_medium" ADD CONSTRAINT "post_medium_mediumId_fkey" FOREIGN KEY ("mediumId") REFERENCES "medium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "szene" ADD CONSTRAINT "szene_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_feld_definition" ADD CONSTRAINT "custom_feld_definition_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "kunde"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_feld_wert" ADD CONSTRAINT "custom_feld_wert_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_feld_wert" ADD CONSTRAINT "custom_feld_wert_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "custom_feld_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export" ADD CONSTRAINT "export_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "kunde"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export" ADD CONSTRAINT "export_ansprechpartnerId_fkey" FOREIGN KEY ("ansprechpartnerId") REFERENCES "ansprechpartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freigabe" ADD CONSTRAINT "freigabe_exportId_fkey" FOREIGN KEY ("exportId") REFERENCES "export"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freigabe" ADD CONSTRAINT "freigabe_gastId_fkey" FOREIGN KEY ("gastId") REFERENCES "gast"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kommentar" ADD CONSTRAINT "kommentar_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kommentar" ADD CONSTRAINT "kommentar_exportId_fkey" FOREIGN KEY ("exportId") REFERENCES "export"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kommentar" ADD CONSTRAINT "kommentar_gastId_fkey" FOREIGN KEY ("gastId") REFERENCES "gast"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kommentar" ADD CONSTRAINT "kommentar_nutzerId_fkey" FOREIGN KEY ("nutzerId") REFERENCES "nutzer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kommentar" ADD CONSTRAINT "kommentar_antwortAufId_fkey" FOREIGN KEY ("antwortAufId") REFERENCES "kommentar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_abo" ADD CONSTRAINT "push_abo_nutzerId_fkey" FOREIGN KEY ("nutzerId") REFERENCES "nutzer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_abo" ADD CONSTRAINT "push_abo_gastId_fkey" FOREIGN KEY ("gastId") REFERENCES "gast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

