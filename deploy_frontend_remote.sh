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
sudo systemctl restart dll347-frontend.service
systemctl is-active dll347-frontend.service
