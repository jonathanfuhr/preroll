#!/bin/sh
set -e

echo "Preroll: Migrationen einspielen …"
npx prisma migrate deploy

echo "Preroll: starte auf Port ${PORT:-3000}"
exec "$@"
