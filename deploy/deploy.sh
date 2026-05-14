#!/bin/bash
set -e

DOMAIN="karcass.com"
APP_DIR="/var/www/UltimateHealthApp"
VENV="$APP_DIR/backend/venv"

echo "=== Installing system dependencies ==="
apt update && apt install -y python3 python3-venv nodejs npm nginx certbot python3-certbot-nginx git curl

echo "=== Cloning repo ==="
mkdir -p "$APP_DIR"
cd "$APP_DIR"
git init 2>/dev/null || true
git remote add origin git@github.com:knobster65/UltimateHealthApp.git 2>/dev/null || true
git pull origin main

echo "=== Setting up Python venv ==="
cd "$APP_DIR/backend"
python3 -m venv venv
source "$VENV/bin/activate"
pip install --upgrade pip
pip install -r requirements.txt

echo "=== Building frontend ==="
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "=== Creating .env from template ==="
if [ ! -f "$APP_DIR/backend/.env" ]; then
    cp "$APP_DIR/backend/.env.example" "$APP_DIR/backend/.env"
    echo "Created .env — edit it with your SECRET_KEY and Nightscout settings!"
fi

echo "=== Generating SECRET_KEY if default ==="
CURRENT=$(grep SECRET_KEY "$APP_DIR/backend/.env" | cut -d= -f2)
if [ "$CURRENT" = "change-this-to-a-long-random-string" ]; then
    NEW=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    sed -i "s|SECRET_KEY=.*|SECRET_KEY=$NEW|" "$APP_DIR/backend/.env"
    echo "Generated new SECRET_KEY"
fi

echo "=== Installing Gunicorn systemd service ==="
cp "$APP_DIR/deploy/gunicorn.service" /etc/systemd/system/ultimatehealth.service
systemctl daemon-reload
systemctl enable --now ultimatehealth
echo "Gunicorn service started"

echo "=== Setting up Nginx ==="
python3 -c "
import sys
content = open('$APP_DIR/deploy/nginx.conf').read()
content = content.replace('{{domain}}', '$DOMAIN')
open('/etc/nginx/sites-available/$DOMAIN', 'w').write(content)
"

rm -f /etc/nginx/sites-enabled/"$DOMAIN"
ln -s /etc/nginx/sites-available/"$DOMAIN" /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
echo "Nginx configured"

echo "=== Setting up SSL ==="
certbot --non-interactive --agree-tos --register-unsafely-without-email \
    -d "$DOMAIN" --nginx --redirect
echo "SSL installed"

echo "=== Installing webhook service ==="
cp "$APP_DIR/deploy/webhook_receiver.py" "/usr/local/bin/webhook_receiver"
cp "$APP_DIR/deploy/webhook.service" /etc/systemd/system/webhook-deploy.service

# Set webhook secret if not already set
if ! grep -q 'WEBHOOK_SECRET' "$APP_DIR/backend/.env" 2>/dev/null; then
    SECRET=$(python3 -c "import secrets; print(secrets.token_hex(16))")
    echo "WEBHOOK_SECRET=$SECRET" >> "$APP_DIR/backend/.env"
    echo "Webhook secret: $SECRET (save this for GitHub webhook setup)"
else
    grep WEBHOOK_SECRET "$APP_DIR/backend/.env" | cut -d= -f2
fi

systemctl daemon-reload
systemctl enable --now webhook-deploy

echo "=== Opening firewall ports if ufw is active ==="
ufw status 2>/dev/null | grep -q "active" && ufw allow 'Nginx Full' || true

echo ""
echo "========================================="
echo "  Deploy complete!"
echo "  Domain: https://$DOMAIN"
echo "  Webhook port: 9097 (add to GitHub webhook)"
echo "========================================="
