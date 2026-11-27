#!/bin/sh
# Starts the dev container. node_modules lives in a named volume that survives an image rebuild.
# So reinstall here as soon as package-lock.json differs from the state in the volume.
set -e

hash="$(sha256sum package-lock.json | cut -d' ' -f1)"
if [ "$(cat node_modules/.lock-hash 2>/dev/null)" != "$hash" ]; then
  echo "package-lock.json changed, reinstalling dependencies ..."
  npm ci --no-audit --no-fund
  echo "$hash" > node_modules/.lock-hash
fi

node scripts/scheduler.mjs &
exec netlify dev
