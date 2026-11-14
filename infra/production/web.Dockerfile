FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS build
WORKDIR /build
RUN npm install -g pnpm@12.6.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web ./apps/web
COPY packages ./packages
COPY tooling/verification/build-typescript.mjs ./tooling/verification/build-typescript.mjs
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @rotavise/contracts build && pnpm --filter @rotavise/web build

FROM nginxinc/nginx-unprivileged:1.28-alpine@sha256:7377697a821c131a924a7105fafbe7414db4e9fcc77a6f08f776f33f141ec3f8 AS runtime
COPY --chown=nginx:nginx infra/production/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=nginx:nginx infra/production/security-headers.conf /etc/nginx/rotavise-security-headers.conf
COPY --from=build --chown=nginx:nginx /build/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
