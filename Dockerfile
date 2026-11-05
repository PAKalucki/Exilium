FROM --platform=$BUILDPLATFORM node:24.22.2-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS build
WORKDIR /app
COPY package.json package-lock.json vite.config.ts tsconfig.json ./
COPY src/app.html ./src/app.html
RUN npm ci
COPY src ./src
COPY static ./static
COPY scripts/origins.mjs ./scripts/origins.mjs
RUN npm run check && npm run build && mkdir /app/runtime-data

FROM --platform=$BUILDPLATFORM node:24.22.2-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
# Runtime dependencies must remain architecture independent. Native SQLite is provided by Node.
RUN node --input-type=module -e "import fs from 'node:fs'; const lock=JSON.parse(fs.readFileSync('package-lock.json')); for (const [key,p] of Object.entries(lock.packages)) { if(!p.dev && (p.cpu || p.os || p.libc)) throw new Error('Review target-specific runtime dependency: '+key); }"

FROM node:24.22.2-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS runtime
WORKDIR /app
# Apply available fixes for runtime OS packages; npm/corepack/yarn are build tools.
# The running application and operational helpers invoke Node directly.
RUN apt-get update && apt-get install -y --no-install-recommends --only-upgrade apt libapt-pkg6.0 \
    && rm -rf /var/lib/apt/lists/* /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/data/exilium.sqlite SHUTDOWN_TIMEOUT=15 BODY_SIZE_LIMIT=6M
COPY --from=dependencies /app/package.json /app/package-lock.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY static/fonts ./static/fonts
COPY scripts ./scripts
COPY --from=build --chown=node:node /app/runtime-data/ /data/
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "require('node:http').get('http://127.0.0.1:3000/api/health',{headers:{Host:new URL(process.env.APP_ORIGIN||'http://localhost:5173').host}},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "scripts/serve.mjs"]
