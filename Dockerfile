FROM node:22-bookworm-slim

# netlify dev always starts the Edge Functions server and needs Deno for it.
# The CLI's automatic download picks the wrong binary on arm64, so install Deno matching the architecture.
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
# Local Netlify servers listen on "localhost"; without IPv4 precedence they end up on ::1,
# but the Blobs client connects to 127.0.0.1 (ECONNREFUSED).
ENV NODE_OPTIONS=--dns-result-order=ipv4first
EXPOSE 8888
CMD ["sh", "scripts/container-start.sh"]
