// Serves the overhaul's demo page (npm run demo:dev): the character code in src/overhaul/ in a browser. A dev page, kept apart
// from the game and not shipped.
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue()],
  server: { port: 5185, strictPort: true },
});
