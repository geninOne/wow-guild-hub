#!/bin/sh
# Startet den Dev-Container. node_modules liegt in einem benannten Volume, das einen Neubau des Images überlebt.
# Deshalb hier nachinstallieren, sobald sich package-lock.json gegenüber dem Stand im Volume geändert hat.
set -e

hash="$(sha256sum package-lock.json | cut -d' ' -f1)"
if [ "$(cat node_modules/.lock-hash 2>/dev/null)" != "$hash" ]; then
  echo "package-lock.json hat sich geändert, installiere Abhängigkeiten neu ..."
  npm ci --no-audit --no-fund
  echo "$hash" > node_modules/.lock-hash
fi

node scripts/takt.mjs &
exec netlify dev
