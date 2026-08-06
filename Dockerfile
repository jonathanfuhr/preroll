FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm rebuild sharp prisma @prisma/engines

FROM node:26-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

FROM node:26-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup -g 1001 -S preroll && adduser -S preroll -u 1001

# Standalone-Build bringt nur die tatsächlich benötigten Module mit.
COPY --from=build --chown=preroll:preroll /app/.next/standalone ./
COPY --from=build --chown=preroll:preroll /app/.next/static ./.next/static
COPY --from=build --chown=preroll:preroll /app/public ./public

# Migrationen und das Skript, das sie einspielt. Die Prisma-CLI wird dafür
# nicht gebraucht — siehe docker-entrypoint.sh.
COPY --from=build --chown=preroll:preroll /app/prisma/migrations ./prisma/migrations
COPY --from=build --chown=preroll:preroll /app/scripts/db-migrate.ts ./scripts/db-migrate.ts
COPY --from=build --chown=preroll:preroll /app/scripts/nutzer-anlegen.ts ./scripts/nutzer-anlegen.ts
COPY --chown=preroll:preroll docker-entrypoint.sh ./

RUN mkdir -p /app/data/uploads && chown -R preroll:preroll /app/data && chmod +x /app/docker-entrypoint.sh

USER preroll
EXPOSE 3000
# Kein VOLUME: /app/data wird per Bind-Mount vom Host eingehängt, siehe
# MEDIEN_PFAD in docker-compose.yml.

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
