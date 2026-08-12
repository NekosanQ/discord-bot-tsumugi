FROM node:24.10-trixie-slim AS dependencies

RUN apt update && apt install -y --no-install-recommends ca-certificates fonts-noto-cjk tzdata bash && apt clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN chown -R node:node /app

USER node

COPY --chown=node:node package*.json ./
COPY --chown=node:node apps/bot/package.json ./apps/bot/package.json
COPY --chown=node:node apps/api/package.json ./apps/api/package.json
COPY --chown=node:node apps/web/package.json ./apps/web/package.json
COPY --chown=node:node packages/contracts/package.json ./packages/contracts/package.json
RUN echo 'export PS1="\\u:\\w\\$ "' >> /home/node/.bashrc
RUN npm ci

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev

FROM dependencies AS builder
USER node

COPY --chown=node:node . .
RUN npm run compile --workspace packages/contracts
RUN npm run compile --workspace apps/bot

FROM dependencies AS development
USER node

WORKDIR /app
COPY --chown=node:node . .
RUN npm run compile --workspace packages/contracts

CMD ["sleep", "infinity"]

FROM node:24.10-trixie-slim AS production

ENV NODE_ENV=production
WORKDIR /app/apps/bot

RUN mkdir -p /app/apps/bot/run && chown -R node:node /app

COPY --from=production-dependencies --chown=node:node /app/node_modules /app/node_modules
COPY --from=dependencies --chown=node:node /app/apps/bot/package.json ./package.json
COPY --from=builder --chown=node:node /app/packages/contracts/package.json /app/packages/contracts/package.json
COPY --from=builder --chown=node:node /app/packages/contracts/dist /app/packages/contracts/dist
COPY --from=builder --chown=node:node /app/apps/bot/dist ./dist
COPY --from=builder --chown=node:node /app/apps/bot/config ./config

USER node

CMD ["npm", "run", "start"]
