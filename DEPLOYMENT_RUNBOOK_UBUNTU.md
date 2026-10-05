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
- Django Gunicorn: `127.0.0.1:8001`
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
- Internal bind: `127.0.0.1:8001`
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

## App Version Bumping (Every Deployment)

Every production deployment should update the application version so that PWA caches bust properly and client deployments can be verified.

The version is tracked in:
- `VERSION` (root file)
- `frontend/package.json` & `frontend/package-lock.json`
- `frontend/public/version.json` (published for production health / verification)

To bump the version before deployment:
```powershell
python scripts/bump_version.py
```
Or specify bump type (`patch`, `minor`, `major`):
```powershell
python scripts/bump_version.py --type patch
```
To check current version:
```powershell
python scripts/bump_version.py --check
```

## Local Build

Create separate deploy zips for frontend and backend.

Example output:
- `dll347_frontend_build.zip`
- `dll347_backend_build.zip`

Recommended destination on Windows:

```powershell
C:\Users\Dell Latitude 5350\OneDrive\Desktop\build\
```

Use the checked-in build script:

### Frontend
```powershell
python scripts/make_deploy_zip.py --target frontend --bump-version --output "C:\Users\Dell Latitude 5350\OneDrive\Desktop\build\dll347_frontend_build.zip"
```

### Backend
```powershell
python scripts/make_deploy_zip.py --target backend --output "C:\Users\Dell Latitude 5350\OneDrive\Desktop\build\dll347_backend_build.zip"
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
  --exclude='uploads' \
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

# Pre-build guardrail: ensure no local dev overrides exist on production
sudo rm -f "$APP"/.env.local "$APP"/.env*.local

# Ensure production environment file is in place
if [ ! -f "$APP/.env.production" ]; then
  echo "NEXT_PUBLIC_API_BASE_URL=/api" | sudo tee "$APP/.env.production" > /dev/null
fi

npm install
npm run build

# Post-build guardrail: verify localhost:8000 was NOT baked into client JS bundle
if grep -r "127.0.0.1:8000" "$APP"/.next/static/ >/dev/null 2>&1; then
  echo "CRITICAL ERROR: Found 127.0.0.1:8000 baked into client static bundle! Aborting deploy." >&2
  exit 1
fi
```

## systemd Services

### Backend service
Checked-in template:

```text
deploy/dll347-backend.service
```

Install with:

```bash
sudo cp deploy/dll347-backend.service /etc/systemd/system/dll347-backend.service
```

### Frontend service
Checked-in template:

```text
deploy/dll347-frontend.service
```

Install with:

```bash
sudo cp deploy/dll347-frontend.service /etc/systemd/system/dll347-frontend.service
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

Checked-in template:

```text
deploy/nginx-dll347.conf
```

Install with:

```bash
sudo cp deploy/nginx-dll347.conf /etc/nginx/sites-available/dll347
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

### Deployed App Version
```bash
curl https://dll347.org/version.json
```

### API through public domain
```bash
curl https://dll347.org/api/health/
```

### Backend locally on server
```bash
curl http://127.0.0.1:8001/api/health/
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
- server-internal backend: `127.0.0.1:8001`
- server-internal frontend: `127.0.0.1:3000`

---

## Production Incident Playbook & Guardrails

### 1. Incident: Sign-in Failure on Mobile / Outside Devices ("Unable to complete sign in right now")

* **Root Cause:** A local development `.env.local` containing `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api` was synced to `/srv/dll347/frontend/.env.local`. Because Next.js prioritizes `.env.local` over `.env.production`, this hardcoded loopback address was baked into the static client JavaScript bundle during `npm run build`. Remote client browsers (e.g. phones, tablets, external laptops) attempted to fetch `http://127.0.0.1:8000/api/auth/csrf/` on their own local device, causing `TypeError: Failed to fetch`.
* **Prevention Rules:**
  1. Never deploy `.env.local` or `.env*.local` to production.
  2. In `frontend/.gitignore`, always ignore `.env*.local`.
  3. Pre-build check: Always run `sudo rm -f /srv/dll347/frontend/.env.local /srv/dll347/frontend/.env*.local` before building.
  4. Post-build verification: Always run:
     ```bash
     grep -rn "127.0.0.1:8000" /srv/dll347/frontend/.next/static/
     ```
     This command MUST output nothing.

---

### 2. Incident: Django Backend Fails on Restart with Error 127 ("No such file or directory")

* **Root Cause:** Running `rsync` from a local macOS machine without excluding `venv` overwrites the Linux ELF binaries in `/srv/dll347/backend/venv/bin` with macOS Mach-O binaries. Systemd then fails to execute `/srv/dll347/backend/venv/bin/gunicorn` with exit code 127.
* **Prevention Rules:**
  1. When using `rsync` for backend code, ALWAYS pass:
     `--exclude='venv' --exclude='.venv' --exclude='uploads' --exclude='.postgres-data' --exclude='__pycache__'`
  2. If accidentally overwritten, recreate the virtual environment on Ubuntu in seconds:
     ```bash
     cd /srv/dll347/backend
     rm -rf venv
     python3 -m venv venv
     ./venv/bin/pip install -r requirements.txt
     sudo systemctl restart dll347-backend
     ```

---

### 3. Incident: Member Workbook Upload Silently Fails ("Nothing Happens")

* **Root Cause:** When updating existing records from an uploaded Excel file, the database threw:
  `duplicate key value violates unique constraint "dll347_member_database_records_source_row_key" (DETAIL: Key (source_row)=(1190) already exists)`.
  This happened because temporary row shuffling used `highest_source_row + offset`, which collided with bottom-placed unmatched records (`max_incoming_row + 1000 + offset`). The exception caused the database transaction to roll back, leaving all records untouched while the frontend only received a generic upload acknowledgement.
* **Prevention Rules:**
  1. Temporary row shifting in `excel_members.py` must use a base of `10,000,000+`, ensuring temporary keys never collide with sheet rows (1..500) or unmatched rows (1000..2000).
  2. In case of unexpected upload behavior, always inspect `LodgeDocument` extraction status in Django shell:
     ```python
     from api.models import LodgeDocument
     doc = LodgeDocument.objects.order_by("-id").first()
     print(doc.extraction_status, doc.extraction_errors)
     ```

---

### 4. Mandatory Post-Deployment Smoke Test Protocol

After ANY production deployment, run this exact sequence of smoke tests:

```bash
# 1. Version verification
curl -s https://dll347.org/version.json

# 2. Backend health
curl -s https://dll347.org/api/health/

# 3. CSRF token generation (HTTP 200 + Set-Cookie)
curl -i -s https://dll347.org/api/auth/csrf/ | grep -E "HTTP/|set-cookie|message"

# 4. Auth evaluation test (should return 403 NOT_AUTHORIZED, NOT connection refused or 500)
curl -i -s -X POST https://dll347.org/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid@dll347.org","password":"test"}' | grep -E "HTTP/|code"

# 5. Service statuses
ssh ubuntu@51.75.77.80 "sudo systemctl is-active dll347-backend dll347-frontend"
```
