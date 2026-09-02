#!/bin/sh
# Container entrypoint: pick the Prisma schema from DATABASE_URL, migrate, then serve.
# postgres://… → prisma/postgres (client regenerated from the cached engines, no network needed);
# anything else → the default SQLite schema.
set -e

case "$DATABASE_URL" in
  postgres://*|postgresql://*)
    echo "entrypoint: PostgreSQL database detected"
    npx prisma generate --schema prisma/postgres/schema.prisma
    npx prisma migrate deploy --schema prisma/postgres/schema.prisma
    ;;
  *)
    echo "entrypoint: SQLite database (set DATABASE_URL=postgres://… for PostgreSQL)"
    npx prisma migrate deploy
    ;;
esac

exec npm start -- --port "${PORT:-3000}"
