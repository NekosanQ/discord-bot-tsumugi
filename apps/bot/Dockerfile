FROM node:24.10-trixie-slim AS dependencies

RUN apt update && apt install -y --no-install-recommends ca-certificates fonts-noto-cjk tzdata bash && apt clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN chown -R node:node /app

USER node

COPY --chown=node:node package*.json ./
COPY --chown=node:node apps/bot/package.json ./apps/bot/package.json
RUN echo 'export PS1="\\u:\\w\\$ "' >> /home/node/.bashrc
RUN npm install

FROM dependencies AS builder
USER node

COPY --chown=node:node . .
RUN npm run prisma:generate --workspace apps/bot
RUN npm run compile --workspace apps/bot

FROM dependencies AS development
USER node

WORKDIR /app
COPY --chown=node:node . .
RUN npm run prisma:generate --workspace apps/bot

CMD ["sleep", "infinity"]

FROM node:24.10-trixie-slim AS production

ENV NODE_ENV=production
WORKDIR /app/apps/bot

RUN mkdir -p /app/apps/bot/run && chown -R node:node /app

COPY --from=dependencies --chown=node:node /app/node_modules /app/node_modules
COPY --from=dependencies --chown=node:node /app/apps/bot/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder --chown=node:node /app/apps/bot/dist ./dist
COPY --from=builder --chown=node:node /app/apps/bot/config ./config
COPY --from=builder --chown=node:node /app/apps/bot/prisma ./prisma

USER node

CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/schema.prisma && npm run start"]
