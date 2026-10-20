// Builds the browser game into one self-contained page, dist/omerta.html. See docs/03-build-and-setup.md.
// web/index.html is the page shell (meta tags, CSS, #app); vite-plugin-singlefile inlines the bundled src/web.ts into it.
// The root is web/, not the repository root, because the repository root's index.html is the GitHub Pages copy of the build.
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const OUT = 'omerta.html';

// The page must stay one file with one inline script (the claude.ai artifact and file:// both depend on it).
// vite-plugin-singlefile only warns about anything it could not inline, so fail the build instead.
function selfContained(): Plugin {
  return {
    name: 'omerta:self-contained',
    enforce: 'post',
    writeBundle(_opts, bundle) {
      const files = Object.keys(bundle);
      if (files.length !== 1 || files[0] !== OUT) throw new Error(`expected only ${OUT} in the build, got: ${files.join(', ')}`);
      const html = (bundle[OUT] as { source: string | Uint8Array }).source.toString();
      const scripts = html.match(/<script\b[^>]*>/g) ?? [];
      if (scripts.length !== 1 || /\bsrc=/.test(scripts[0])) throw new Error(`expected one inline <script> in ${OUT}, got: ${scripts.join(' ')}`);
      if (html.split('</script').length !== 2) throw new Error(`the bundle contains "</script", which would end the inline script early`);
    },
  };
}

export default defineConfig({
  root: 'web',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    // Leave the hand-written CSS exactly as authored. Minifying it saves ~3 KB but lets Lightning CSS rewrite rules (prefixes, merges).
    cssMinify: false,
    modulePreload: { polyfill: false },
  },
  plugins: [viteSingleFile({ outputFileName: OUT }), selfContained()],
  // dist/ has no index.html, so `vite preview` (make preview) opens the page by name.
  preview: { open: `/${OUT}` },
});
