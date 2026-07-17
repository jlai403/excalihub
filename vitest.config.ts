import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '~': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    env: {
      BASE_DOMAIN: 'draw.domain.com',
      EXCALIDRAW_CONTAINER: 'http://localhost:8080',
      PORT: '80',
      HOST: '0.0.0.0',
    },
  },
});
