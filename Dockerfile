# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
RUN npm install --global pnpm@12.6.0
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter "@sphoto/api..." --filter "@sphoto/web..."
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
RUN pnpm --filter @sphoto/api build && pnpm --filter @sphoto/web build

# The API is bundled into one file and serves the built web app, so the runtime image needs Node only.
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    DATA_DIR=/data \
    WEB_DIR=/app/web \
    PORT=3000
WORKDIR /app
COPY --from=build /repo/apps/api/dist/main.js ./main.js
COPY --from=build /repo/apps/web/dist ./web
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=120 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "main.js"]
