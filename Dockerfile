FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY astro.config.mjs ./

RUN npx astro build
RUN npm run build

FROM node:20-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/inject ./dist/inject

RUN mkdir -p /data

EXPOSE 80

CMD ["node", "dist/server/index.js"]
