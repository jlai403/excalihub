FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock ./
COPY server/package.json server/
COPY hub/package.json hub/
RUN bun install --frozen-lockfile

COPY server/ server/
COPY hub/ hub/

RUN bun run --filter hub build && bun build server/src/index.ts --outdir dist --target bun

FROM oven/bun:1 AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/src/inject ./dist/inject

RUN mkdir -p /data && chown -R bun:bun /data /app

USER bun

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:80/health').then(r => process.exit(r.ok?0:1)).catch(() => process.exit(1))"

CMD ["bun", "run", "dist/server/index.js"]
