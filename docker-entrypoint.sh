#!/bin/sh
set -e

# Migrationen über das eigene Skript statt über `prisma migrate deploy`.
#
# Grund: Der Standalone-Build zieht nur mit, was die App selbst benutzt — die
# Prisma-CLI und ihre Abhängigkeiten (u. a. `effect`) fehlen im Abbild. Sie
# nachzureichen würde es unnötig aufblähen. Das Skript braucht nur `pg`, das
# ohnehin für den Datenbank-Adapter dabei ist, und schreibt in dieselbe
# Tabelle `_prisma_migrations`. Damit laufen Entwicklung und Produktion über
# denselben Weg.
echo "Preroll: Migrationen einspielen …"
node --experimental-strip-types scripts/db-migrate.ts

echo "Preroll: starte auf Port ${PORT:-3000}"
exec "$@"
