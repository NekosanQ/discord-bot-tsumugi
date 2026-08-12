FROM node:24.10-trixie-slim AS dependencies

WORKDIR /app
RUN chown -R node:node /app
USER node

COPY --chown=node:node package*.json ./
COPY --chown=node:node apps/api/package.json ./apps/api/package.json
COPY --chown=node:node apps/bot/package.json ./apps/bot/package.json
COPY --chown=node:node apps/web/package.json ./apps/web/package.json
COPY --chown=node:node packages/contracts/package.json ./packages/contracts/package.json
RUN npm ci

FROM dependencies AS development
WORKDIR /app
COPY --chown=node:node . .
RUN npm run compile --workspace packages/contracts
CMD ["npm", "run", "dev", "--workspace", "apps/web"]

FROM dependencies AS builder
WORKDIR /app
COPY --chown=node:node . .
RUN npm run compile --workspace packages/contracts
RUN npm run build --workspace apps/web

FROM node:24.10-trixie-slim AS production

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001

WORKDIR /app/apps/web
RUN chown -R node:node /app

COPY --from=builder --chown=node:node /app/apps/web/.next/standalone /app
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/apps/web/config ./config

USER node
EXPOSE 3001
CMD ["node", "server.js"]
