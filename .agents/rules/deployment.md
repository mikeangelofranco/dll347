# Production Deployment Rules & Guardrails for DLL347

When deploying backend or frontend changes to the production server (`51.75.77.80`), you MUST strictly enforce the following rules to prevent production outages:

## 1. Frontend Environment & Bundle Integrity
* **Never copy `.env.local` or `.env*.local` to the production server.**
* Next.js prioritizes `.env.local` over `.env.production`. If `.env.local` with `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api` is present on the server, it bakes `127.0.0.1:8000` into client-side JS bundles, causing all API calls and user sign-ins on remote devices (e.g. mobile phones) to fail.
* **Pre-Build Mandate:** Always run `sudo rm -f /srv/dll347/frontend/.env.local /srv/dll347/frontend/.env*.local` before building.
* **Post-Build Verification:** Run `grep -rn "127.0.0.1:8000" /srv/dll347/frontend/.next/static/`. If any match is found, DO NOT restart the frontend service.

## 2. Backend Sync & Architecture Protection
* **Never copy `venv/` or `.venv/` from a local macOS machine to Ubuntu.**
* Overwriting Linux Python binaries with macOS Mach-O binaries crashes Gunicorn with exit code 127 (`No such file or directory`).
* Always pass `--exclude='venv' --exclude='.venv' --exclude='uploads' --exclude='.postgres-data' --exclude='__pycache__'` when rsyncing backend code.

## 3. Database & Excel Row Re-indexing
* `MemberDatabaseRecord` enforces a unique constraint on `source_row`.
* Temporary row shuffling during Excel workbook imports must use a safe base of `10,000,000+` to avoid colliding with sheet rows (`1..500`) or bottom-assigned unmatched rows (`1000..2000`).

## 4. Mandatory Post-Deployment Smoke Tests
After any deployment, verify:
1. `curl -s https://dll347.org/version.json`
2. `curl -s https://dll347.org/api/health/`
3. `curl -i -s https://dll347.org/api/auth/csrf/`
4. `curl -i -s -X POST https://dll347.org/api/auth/login/ -H "Content-Type: application/json" -d '{"email":"invalid@dll347.org","password":"test"}'`
5. `ssh ubuntu@51.75.77.80 "sudo systemctl is-active dll347-backend dll347-frontend"`
