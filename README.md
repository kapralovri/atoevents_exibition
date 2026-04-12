# ATO COMM — Exhibitor Portal (MVP)

Monorepo: **Next.js** (App Router) + **FastAPI** + **PostgreSQL** + **MinIO** (S3-compatible).

## Quick start

1. Copy environment:

   ```bash
   cp .env.example .env
   ```

2. Start stack:

   ```bash
   docker compose up --build
   ```

3. Run migrations (included in API entrypoint) and seed admin:

   ```bash
   docker compose exec api python -m scripts.seed_admin
   ```

4. Open **http://localhost:3000** (frontend) and **http://localhost:8000/docs** (API).

### Database backups

`scripts/backup_postgres.sh` — пример дампа через `docker compose exec` (см. файл).

Default admin (after seed): `admin@atocomm.eu` / `admin123!` — change via `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Services

| Service | Port |
|---------|------|
| Next.js | 3000 |
| FastAPI | 8000 |
| PostgreSQL | 5432 |
| MinIO API | 9000 |
| MinIO Console | 9001 |
| Nginx (optional) | 8080 |

## Project layout

- `backend/` — FastAPI, SQLAlchemy, Alembic, S3 presigned uploads, TIFF validation (Pillow), audit logs
- `frontend/` — Next.js portal + admin UI
- `nginx/` — reverse proxy example

## CI

GitHub Actions runs backend `compileall` and frontend `lint` + `build` (requires `package-lock.json` in `frontend/`).
