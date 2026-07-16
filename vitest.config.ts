import { defineConfig } from 'vitest/config';

export default defineConfig({
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
