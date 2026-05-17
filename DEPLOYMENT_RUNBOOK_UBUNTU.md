# DLL347 Production Deployment Runbook (Ubuntu)

## Server Details
- Host: `51.75.77.80`
- SSH User: `ubuntu`
- Public Domain: `dll347.org`
- Frontend Path: `/srv/dll347/frontend`
- Backend Path: `/srv/dll347/backend`
- Frontend Upload Path: `/tmp/dll347_frontend_build.zip`
- Backend Upload Path: `/tmp/dll347_backend_build.zip`

Do not touch anything outside `/srv/dll347` unless the task explicitly requires:
- PostgreSQL
- Nginx
- systemd
- Certbot
- OS packages

Passwords and secrets are not stored in this file. Use the credentials you already have out-of-band.

## Deployment Shape

### Public
- `https://dll347.org/` -> Next.js frontend
- `https://dll347.org/api/...` -> Nginx reverse proxy to Django

### Private / Local Only
- Django Gunicorn: `127.0.0.1:8000`
- Next.js app server: `127.0.0.1:3000`
- PostgreSQL: `127.0.0.1:5432`

Important:
- Do not expose Django on a public domain
- Do not call Django directly from the browser using raw IP or localhost
- The browser should only ever talk to `https://dll347.org`

## App Facts

### Frontend
- Framework: Next.js
- Type: PWA
- Production app URL: `https://dll347.org`
- Internal bind: `127.0.0.1:3000`
- Service Name: `dll347-frontend.service`

### Backend
- Framework: Django
- Project Module: `config`
- Production API origin: `https://dll347.org/api/`
- Internal bind: `127.0.0.1:8000`
- Service Name: `dll347-backend.service`

### Database
- PostgreSQL database: `dll347_db`
- PostgreSQL user: `plughub`

## Production Folder Layout

```bash
/srv/dll347/
  frontend/
  backend/
```

Expected important paths:
- Frontend env: `/srv/dll347/frontend/.env.production`
- Backend env: `/srv/dll347/backend/.env`
- Backend venv: `/srv/dll347/backend/venv`
- Backend staticfiles: `/srv/dll347/backend/staticfiles`

## Server Prerequisites

Install only if missing:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip unzip rsync nginx postgresql
```

For frontend runtime, also ensure Node is available. If Node is not already installed, install a stable LTS version.

## PostgreSQL Setup

Use:
- Database: `dll347_db`
- User: `plughub`

Create only if needed:

```bash
sudo -u postgres psql
```

```sql
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'plughub') THEN
        CREATE ROLE plughub LOGIN PASSWORD 'replace-with-your-real-password';
    END IF;
END
$$;

SELECT 'CREATE DATABASE dll347_db OWNER plughub'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'dll347_db'
)\gexec
```

Do not store the actual password in this runbook.

## Backend Production Environment File

Create or edit:

```bash
/srv/dll347/backend/.env
```

Recommended contents:

```dotenv
DJANGO_SECRET_KEY=replace-with-a-strong-secret
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=dll347.org,51.75.77.80,localhost,127.0.0.1
DJANGO_CSRF_TRUSTED_ORIGINS=https://dll347.org
DJANGO_CORS_ALLOWED_ORIGINS=https://dll347.org
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SESSION_COOKIE_SECURE=True
DJANGO_CSRF_COOKIE_SECURE=True

POSTGRES_DB=dll347_db
POSTGRES_USER=plughub
POSTGRES_PASSWORD=replace-with-real-password
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432

FRONTEND_APP_URL=https://dll347.org
DEFAULT_FROM_EMAIL=Datu Lapu-Lapu Masonic Lodge No. 347 <no-reply@dll347.org>
PASSWORD_RESET_LINK_EXPIRY_MINUTES=60
RESEND_API_KEY=replace-with-real-resend-key
```

Keep this file on the server. Never let deploy sync overwrite it.

Important:
- Use the same `RESEND_API_KEY` already working in local DLL347 backend setup
- Put it in `/srv/dll347/backend/.env` on Ubuntu
- Do not commit the real key into this repository or this runbook
- The backend must read it from `.env` in production exactly the same way it does locally

## Frontend Production Environment File

Create or edit:

```bash
/srv/dll347/frontend/.env.production
```

Contents:

```dotenv
NEXT_PUBLIC_API_BASE_URL=/api
```

Important:
- In production, this should stay relative as `/api`
- Do not set this to localhost or an IP for browser use

## Local Build

Create separate deploy zips for frontend and backend.

Example output:
- `dll347_frontend_build.zip`
- `dll347_backend_build.zip`

Recommended destination on Windows:

```powershell
C:\Users\Dell Latitude 5350\OneDrive\Desktop\build\
```

## Upload

### Frontend
```powershell
scp -o StrictHostKeyChecking=accept-new `
  "C:\Users\Dell Latitude 5350\OneDrive\Desktop\build\dll347_frontend_build.zip" `
  ubuntu@51.75.77.80:/tmp/dll347_frontend_build.zip
```

### Backend
```powershell
scp -o StrictHostKeyChecking=accept-new `
  "C:\Users\Dell Latitude 5350\OneDrive\Desktop\build\dll347_backend_build.zip" `
  ubuntu@51.75.77.80:/tmp/dll347_backend_build.zip
```

Then connect:

```powershell
ssh -o StrictHostKeyChecking=accept-new ubuntu@51.75.77.80
```

## Deploy Backend

```bash
set -euo pipefail

ZIP=/tmp/dll347_backend_build.zip
APP=/srv/dll347/backend
TMPDIR=$(mktemp -d /tmp/dll347_backend_XXXX)
trap 'rm -rf "$TMPDIR"' EXIT

sudo mkdir -p "$APP"
unzip -q "$ZIP" -d "$TMPDIR"

sudo rsync -a --delete \
  --no-perms --no-owner --no-group --omit-dir-times \
  --exclude='.env*' \
  --exclude='venv' \
  --exclude='staticfiles' \
  --exclude='node_modules' \
  --exclude='logs' \
  --exclude='run' \
  --exclude='data' \
  --exclude='media' \
  --exclude='*.sqlite3' \
  "$TMPDIR"/ "$APP"/

rm -f "$ZIP"

cd "$APP"

python3 -m venv venv
PY="$APP/venv/bin/python"
PIP="$APP/venv/bin/pip"

"$PIP" install --upgrade pip
"$PIP" install -r requirements.txt
"$PY" manage.py migrate --noinput
"$PY" manage.py collectstatic --noinput
"$PY" manage.py check
```

## Deploy Frontend

```bash
set -euo pipefail

ZIP=/tmp/dll347_frontend_build.zip
APP=/srv/dll347/frontend
TMPDIR=$(mktemp -d /tmp/dll347_frontend_XXXX)
trap 'rm -rf "$TMPDIR"' EXIT

sudo mkdir -p "$APP"
unzip -q "$ZIP" -d "$TMPDIR"

sudo rsync -a --delete \
  --no-perms --no-owner --no-group --omit-dir-times \
  --exclude='.env*' \
  --exclude='node_modules' \
  --exclude='.next' \
  "$TMPDIR"/ "$APP"/

rm -f "$ZIP"

cd "$APP"
npm install
npm run build
```

## systemd Services

### Backend service
Create:

```bash
sudo nano /etc/systemd/system/dll347-backend.service
```

```ini
[Unit]
Description=DLL347 Django Backend
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/srv/dll347/backend
EnvironmentFile=/srv/dll347/backend/.env
ExecStart=/srv/dll347/backend/venv/bin/gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 3
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### Frontend service
Create:

```bash
sudo nano /etc/systemd/system/dll347-frontend.service
```

```ini
[Unit]
Description=DLL347 Next.js Frontend
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/srv/dll347/frontend
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start -- --hostname 127.0.0.1 --port 3000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable dll347-backend.service
sudo systemctl enable dll347-frontend.service
sudo systemctl restart dll347-backend.service
sudo systemctl restart dll347-frontend.service
```

## Nginx Config

Create:

```bash
sudo nano /etc/nginx/sites-available/dll347
```

Use:

```nginx
server {
    listen 80;
    server_name dll347.org www.dll347.org;
    return 301 https://dll347.org$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.dll347.org;
    return 301 https://dll347.org$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dll347.org;

    ssl_certificate /etc/letsencrypt/live/dll347.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dll347.org/privkey.pem;

    client_max_body_size 20M;

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /sw.js {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /manifest.webmanifest {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /static/ {
        alias /srv/dll347/backend/staticfiles/;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/dll347 /etc/nginx/sites-enabled/dll347
sudo nginx -t
sudo systemctl reload nginx
```

## TLS

If certificate is not yet installed for `dll347.org`:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d dll347.org -d www.dll347.org
```

Then verify renewal timer:

```bash
systemctl status certbot.timer
```

## Restart After Deploy

```bash
sudo systemctl restart dll347-backend.service
sudo systemctl restart dll347-frontend.service
sudo systemctl reload nginx
```

Verify:

```bash
systemctl is-active dll347-backend.service
systemctl is-active dll347-frontend.service
systemctl is-active nginx
```

Expected: all `active`

## Verify Production

### Frontend
```bash
curl -I https://dll347.org/
```

### API through public domain
```bash
curl https://dll347.org/api/health/
```

### Backend locally on server
```bash
curl http://127.0.0.1:8000/api/health/
```

### Manifest
```bash
curl -I https://dll347.org/manifest.webmanifest
```

### Service logs
```bash
journalctl -u dll347-backend.service -n 100 --no-pager
journalctl -u dll347-frontend.service -n 100 --no-pager
```

## Important DLL347 Notes

- Public app origin should be `https://dll347.org`
- Browser API calls should go to `/api/...`
- Django should not be exposed on its own public domain
- Reset links must use `https://dll347.org`
- Use secure cookies in production
- Keep `.env` files on the server
- Do not let deploy sync overwrite `.env`
- Reuse the same working `RESEND_API_KEY` in the server backend `.env` unless you intentionally rotate it
- PostgreSQL stays local on the Ubuntu server
- Frontend and backend are separate folders, but same machine and same Nginx site

## Recommended Production Changes In Repo

Before production deploy, these should be true:

### Frontend
- `frontend/.env.production`

```dotenv
NEXT_PUBLIC_API_BASE_URL=/api
```

### Backend
- `backend/.env` on server should use:

```dotenv
FRONTEND_APP_URL=https://dll347.org
DJANGO_DEBUG=False
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SESSION_COOKIE_SECURE=True
DJANGO_CSRF_COOKIE_SECURE=True
DJANGO_CSRF_TRUSTED_ORIGINS=https://dll347.org
DJANGO_CORS_ALLOWED_ORIGINS=https://dll347.org
```

## Recommendation

This deployment model is correct for DLL347.

It gives you:
- one clean public domain
- simpler auth/session handling
- no CORS headaches
- lower backend exposure
- easier Nginx and SSL management

The main production rule is:
- never mix `localhost`, `127.0.0.1`, and public browser URLs in production config

Use:
- browser/public: `https://dll347.org`
- server-internal backend: `127.0.0.1:8000`
- server-internal frontend: `127.0.0.1:3000`
