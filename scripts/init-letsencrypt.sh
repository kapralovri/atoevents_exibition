#!/bin/bash
# Bootstrap Let's Encrypt certificate for expo.atocomm.eu
# Run once on first deployment. After certs are obtained, nginx auto-renews via cron.

set -e

DOMAIN="expo.atocomm.eu"
EMAIL="admin@atocomm.eu"
COMPOSE="docker compose -f docker-compose.prod.yml"

echo "==> [1/5] Creating dummy self-signed cert so nginx can start..."
mkdir -p ./certbot/conf/live/$DOMAIN

# Create a temp dummy cert in the named volume via a helper container
docker run --rm \
  -v "$(basename $(pwd))_certbot-conf:/etc/letsencrypt" \
  alpine sh -c "
    apk add --no-cache openssl &&
    mkdir -p /etc/letsencrypt/live/$DOMAIN &&
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
      -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
      -subj '/CN=localhost'
  "

echo "==> [2/5] Starting all services (nginx uses dummy cert)..."
$COMPOSE up -d db minio minio-init api web nginx

echo "==> [3/5] Waiting for nginx to be ready (15s)..."
sleep 15

echo "==> [4/5] Getting real Let's Encrypt certificate..."
$COMPOSE run --rm certbot certonly \
  --webroot \
  -w /var/www/certbot \
  --email "$EMAIL" \
  -d "$DOMAIN" \
  --agree-tos \
  --no-eff-email \
  --force-renewal

echo "==> [5/5] Reloading nginx with real certificate..."
$COMPOSE exec nginx nginx -s reload

echo ""
echo "Done! https://$DOMAIN is now live."
echo ""
echo "To set up auto-renewal, add this cron job (crontab -e):"
echo "  0 12 * * * cd $(pwd) && docker compose -f docker-compose.prod.yml run --rm certbot renew --quiet && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload"
