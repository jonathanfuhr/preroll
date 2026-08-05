import process from 'node:process'

function pflicht(name: string): string {
  const wert = process.env[name]
  if (!wert) throw new Error(`Umgebungsvariable ${name} fehlt (siehe .env.example).`)
  return wert
}

export const env = {
  get datenbankUrl() {
    return pflicht('DATABASE_URL')
  },
  /** Signiert Session-Cookies. In Produktion zwingend setzen. */
  get sessionGeheimnis() {
    return pflicht('SESSION_SECRET')
  },
  /** Öffentliche Basis-URL, steckt in Mails und Freigabe-Links. */
  get appUrl() {
    return process.env.APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
  },
  /** Verzeichnis für hochgeladene Medien. */
  get uploadVerzeichnis() {
    return process.env.UPLOAD_DIR ?? './data/uploads'
  },
  get istProduktion() {
    return process.env.NODE_ENV === 'production'
  },
}
