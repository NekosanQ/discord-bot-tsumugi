FROM node:24.10-trixie-slim AS dependencies

WORKDIR /app
RUN chown -R node:node /app
USER node

COPY --chown=node:node package*.json ./
COPY --chown=node:node apps/api/package.json ./apps/api/package.json
COPY --chown=node:node apps/bot/package.json ./apps/bot/package.json
COPY --chown=node:node packages/contracts/package.json ./packages/contracts/package.json
RUN npm install

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev

FROM dependencies AS builder
USER node
COPY --chown=node:node . .
RUN npm run compile --workspace packages/contracts
RUN npm run prisma:generate --workspace apps/api
RUN npm run compile --workspace apps/api

FROM dependencies AS development
USER node
WORKDIR /app
COPY --chown=node:node . .
RUN npm run compile --workspace packages/contracts
RUN npm run prisma:generate --workspace apps/api
CMD ["sleep", "infinity"]

FROM node:24.10-trixie-slim AS migration
WORKDIR /app/apps/api
RUN chown -R node:node /app
COPY --from=dependencies --chown=node:node /app/node_modules /app/node_modules
COPY --from=builder --chown=node:node /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder --chown=node:node /app/apps/api/package.json ./package.json
COPY --from=builder --chown=node:node /app/apps/api/prisma ./prisma
USER node
CMD ["npx", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"]

FROM node:24.10-trixie-slim AS production
ENV NODE_ENV=production
WORKDIR /app/apps/api
RUN mkdir -p /app/apps/api && chown -R node:node /app

COPY --from=production-dependencies --chown=node:node /app/node_modules /app/node_modules
COPY --from=builder --chown=node:node /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder --chown=node:node /app/apps/api/package.json ./package.json
COPY --from=builder --chown=node:node /app/apps/api/dist ./dist
COPY --from=builder --chown=node:node /app/apps/api/config ./config
COPY --from=builder --chown=node:node /app/apps/api/prisma ./prisma
COPY --from=builder --chown=node:node /app/packages/contracts/package.json /app/packages/contracts/package.json
COPY --from=builder --chown=node:node /app/packages/contracts/dist /app/packages/contracts/dist

USER node
CMD ["npm", "run", "start"]
