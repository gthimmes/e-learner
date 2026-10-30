# e-learner — single-container production image (Next.js + Prisma).
# Build:  docker build -t e-learner .
# Run:    docker run -p 3000:3000 -e SESSION_SECRET=... -e DATABASE_URL=file:/data/app.db -v elearner-data:/data e-learner
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# better-sqlite3 (Prisma 7 SQLite adapter) is native: fetch/build its binary explicitly
# since --ignore-scripts skips it. Build tools are a fallback when no musl prebuild exists.
RUN apk add --no-cache python3 make g++ \
 && npm install --no-audit --no-fund --ignore-scripts \
 && npm rebuild better-sqlite3 \
 && npx prisma generate

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV SESSION_SECRET=build-time-placeholder
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV UPLOAD_DIR=/data/uploads
RUN apk add --no-cache curl && mkdir -p /data/uploads && chown -R node:node /data
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/next.config.ts /app/prisma.config.ts ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD curl -fsS http://localhost:3000/api/health || exit 1
# Entrypoint migrates (SQLite or Postgres, from DATABASE_URL) and serves.
CMD ["sh", "/app/scripts/docker-entrypoint.sh"]
