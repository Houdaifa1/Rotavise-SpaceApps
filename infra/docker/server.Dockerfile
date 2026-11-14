FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS build
WORKDIR /build
RUN npm install -g pnpm@12.6.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server ./apps/server
COPY apps/web/package.json ./apps/web/package.json
COPY packages ./packages
COPY tooling/verification/build-typescript.mjs ./tooling/verification/build-typescript.mjs
RUN pnpm install --frozen-lockfile
RUN pnpm build:server
RUN pnpm --filter @rotavise/server deploy --prod --frozen-lockfile /out

FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS runtime
ENV NODE_ENV=production API_HOST=0.0.0.0 WORKER_HOST=0.0.0.0 DEV_HARNESS_ENABLED=false
WORKDIR /app
COPY --from=build --chown=node:node /out ./
COPY --chown=node:node data/catalog ./data/catalog
USER node
EXPOSE 3000 3001
CMD ["node", "dist/entrypoints/api.main.js"]
