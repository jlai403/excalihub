FROM node:26-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY astro.config.mjs ./

RUN npx astro build && npm run build

FROM node:26-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/inject ./dist/inject

RUN mkdir -p /data && chown -R node:node /data /app

USER node

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:80/health').then(r => process.exit(r.ok?0:1)).catch(() => process.exit(1))"

CMD ["node", "dist/server/index.js"]
