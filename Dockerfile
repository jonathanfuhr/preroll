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

# Migrationen und Prisma-CLI für den Start-Hook.
COPY --from=build --chown=preroll:preroll /app/prisma ./prisma
COPY --from=build --chown=preroll:preroll /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=preroll:preroll /app/node_modules/prisma ./node_modules/prisma
COPY --from=build --chown=preroll:preroll /app/node_modules/@prisma ./node_modules/@prisma
COPY --chown=preroll:preroll docker-entrypoint.sh ./

RUN mkdir -p /app/data/uploads && chown -R preroll:preroll /app/data && chmod +x /app/docker-entrypoint.sh

USER preroll
EXPOSE 3000
VOLUME ["/app/data"]

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
