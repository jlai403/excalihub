import * as z from 'zod/v4-mini';

const envSchema = z.object({
  DB_PATH: z._default(z.string(), './data/excalihub.db'),
  BASE_DOMAIN: z._default(z.string(), 'draw.domain.com'),
  EXCALIDRAW_CONTAINER: z._default(z.string(), 'http://localhost:8080'),
  PORT: z._default(z.coerce.number().check(z.gte(1), z.lte(65535)), 80),
  HOST: z._default(z.string(), '0.0.0.0'),
});

export const env = envSchema.parse(process.env);
