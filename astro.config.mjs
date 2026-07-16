import { defineConfig } from 'astro/config';

export default defineConfig({
  outDir: './dist/public',
  server: {
    port: 4321,
  },
});
