#!/bin/bash
# Full server setup script for expo.atocomm.eu
# Run as: bash server-setup.sh
set -e

APP_DIR="/opt/expo"
DOMAIN="expo.atocomm.eu"
EMAIL="admin@atocomm.eu"

echo "============================================"
echo "  AtoEvents EXB Platform — Server Setup"
echo "============================================"

# ── 1. Install Docker ─────────────────────────
echo ""
echo "==> [1/6] Installing Docker..."
apt-get update -qq
apt-get install -y -qq curl ca-certificates

curl -fsSL https://get.docker.com | sh

systemctl enable docker
systemctl start docker

echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker compose version)"

# ── 2. Create app directory ───────────────────
echo ""
echo "==> [2/6] Setting up $APP_DIR..."
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# ── 3. Copy project files (already rsynced) ───
echo ""
echo "==> [3/6] Project files present at $APP_DIR"
ls -la

# ── 4. Create production .env ─────────────────
echo ""
echo "==> [4/6] Creating production .env..."

POSTGRES_PASSWORD=$(openssl rand -hex 24)
MINIO_PASSWORD=$(openssl rand -hex 24)
SECRET_KEY=$(openssl rand -hex 48)

cat > .env << EOF
# Database
POSTGRES_USER=exhibitor
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=exhibitor_portal
DATABASE_URL=postgresql+psycopg://exhibitor:${POSTGRES_PASSWORD}@db:5432/exhibitor_portal

# MinIO (S3-compatible)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=$MINIO_PASSWORD
S3_ENDPOINT_URL=http://minio:9000
S3_PUBLIC_ENDPOINT_URL=https://$DOMAIN
S3_BUCKET=exhibitor-uploads
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=$MINIO_PASSWORD
S3_REGION=us-east-1

# API
SECRET_KEY=$SECRET_KEY
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=https://$DOMAIN

# SMTP
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@atocomm.eu
ADMIN_NOTIFY_EMAIL=admin@atocomm.eu

# Frontend (browser → API via nginx /api/ prefix)
NEXT_PUBLIC_API_URL=https://$DOMAIN/api
EOF

echo ".env created with fresh secure secrets"

# ── 5. Bootstrap Let's Encrypt ────────────────
echo ""
echo "==> [5/6] Bootstrapping Let's Encrypt certificate..."
chmod +x scripts/init-letsencrypt.sh
bash scripts/init-letsencrypt.sh

# ── 6. Set up auto-renewal cron ──────────────
echo ""
echo "==> [6/6] Setting up certificate auto-renewal..."
(crontab -l 2>/dev/null; echo "0 3 * * * cd $APP_DIR && docker compose -f docker-compose.prod.yml run --rm certbot renew --quiet && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload >> /var/log/certbot-renew.log 2>&1") | crontab -

echo ""
echo "============================================"
echo "  Deployment complete!"
echo "  https://$DOMAIN"
echo "============================================"
docker compose -f docker-compose.prod.yml ps
