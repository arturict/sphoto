#!/bin/sh
# The Immich database image creates one database. SPhoto runs two Immich instances on the
# same Postgres, so the second database is created here (runs once, on an empty data volume).
set -e
for db in immich_free immich_paid; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE DATABASE $db"
done
