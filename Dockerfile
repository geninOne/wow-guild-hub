FROM node:22-bookworm-slim

# netlify dev startet immer den Edge-Functions-Server und braucht dafür Deno.
# Der automatische Download der CLI wählt auf arm64 das falsche Binary, daher Deno passend zur Architektur installieren.
ARG DENO_VERSION=2.4.5
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl unzip \
  && arch="$(uname -m)" \
  && case "$arch" in aarch64|arm64) target=aarch64-unknown-linux-gnu ;; *) target=x86_64-unknown-linux-gnu ;; esac \
  && curl -fsSL -o /tmp/deno.zip "https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/deno-${target}.zip" \
  && unzip -q /tmp/deno.zip -d /usr/local/bin \
  && rm /tmp/deno.zip \
  && deno --version \
  && apt-get purge -y unzip && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

RUN npm install -g netlify-cli@27.16.2 && npm cache clean --force

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && sha256sum package-lock.json | cut -d' ' -f1 > node_modules/.lock-hash
COPY . .

ENV NETLIFY_TELEMETRY_DISABLED=1
# Lokale Netlify-Server lauschen auf "localhost"; ohne IPv4-Vorrang landen sie auf ::1,
# der Blobs-Client verbindet sich aber mit 127.0.0.1 (ECONNREFUSED).
ENV NODE_OPTIONS=--dns-result-order=ipv4first
EXPOSE 8888
CMD ["sh", "scripts/container-start.sh"]
