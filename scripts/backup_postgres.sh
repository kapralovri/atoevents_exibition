#!/bin/sh
# Daily PostgreSQL dump (run via cron on host). Usage: ./scripts/backup_postgres.sh
set -e
OUT_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/pg_$(date +%Y%m%d_%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-exhibitor}" "${POSTGRES_DB:-exhibitor_portal}" | gzip > "$FILE"
echo "Wrote $FILE"
