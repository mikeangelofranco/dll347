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

# Post-build guardrail: ensure localhost:8000 was NOT baked into client JS bundle
if grep -r "127.0.0.1:8000" "$APP"/.next/static/ >/dev/null 2>&1; then
  echo "CRITICAL ERROR: Found 127.0.0.1:8000 baked into client static bundle! Aborting deploy." >&2
  exit 1
fi

sudo systemctl restart dll347-frontend.service
systemctl is-active dll347-frontend.service
