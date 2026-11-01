// Serves the playground (npm run lab:dev). A dev page, not a shipped build.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('./playground', import.meta.url)),
  server: { port: 5180, strictPort: true },
});
