#!/bin/sh
# Database tests: applies every migration, then runs tests/db/*.test.sql.
#
#   npm run test:db
#       Throwaway local PostgreSQL (needs `initdb`/`pg_ctl`/`psql`, no
#       Docker) with a small stand-in for Supabase's `auth` schema.
#
#   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
#       An existing database that already has the migrations — e.g. the
#       real Supabase stack from `supabase db start`, which is what CI uses.
#       Never point this at production: the tests write (then roll back)
#       test users and boards.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
PSQL="psql -X -q -v ON_ERROR_STOP=1"

if [ -z "$DATABASE_URL" ]; then
  TMP=$(mktemp -d)
  PORT=${PGTEST_PORT:-55432}
  initdb -U postgres -A trust -D "$TMP/data" >/dev/null
  pg_ctl -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/postgres.log" -w start >/dev/null
  trap 'pg_ctl -D "$TMP/data" -m fast stop >/dev/null 2>&1; rm -rf "$TMP"' EXIT
  DATABASE_URL="postgresql://postgres@/postgres?host=$TMP&port=$PORT"

  $PSQL "$DATABASE_URL" -f "$ROOT/tests/db/supabase-shim.sql"
  for migration in "$ROOT"/supabase/migrations/*.sql; do
    echo "applying $(basename "$migration")"
    $PSQL "$DATABASE_URL" -f "$migration"
  done
fi

for test in "$ROOT"/tests/db/*.test.sql; do
  echo "running $(basename "$test")"
  $PSQL "$DATABASE_URL" -f "$test"
done
