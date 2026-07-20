import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  outDir: '../dist/public',
  server: {
    port: 4321,
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      noExternal: ['@lucide/svelte', 'bits-ui', 'runed', 'svelte-toolbelt'],
    },
    server: {
      proxy: {
        '/api': 'http://localhost:80',
      },
    },
  },
  integrations: [svelte()],
});
