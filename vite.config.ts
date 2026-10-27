// Builds the browser game into one self-contained page, dist/omerta.html. See docs/03-build-and-setup.md.
// web/index.html is the page shell (meta tags, CSS, #app); vite-plugin-singlefile inlines the bundled src/web.ts into it.
// The root is web/, not the repository root, because the repository root's index.html is the GitHub Pages copy of the build.
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const OUT = 'omerta.html';

// The page must stay one file with one inline script (the claude.ai artifact and file:// both depend on it).
function singlePage(): Plugin {
  return {
    name: 'omerta:single-page',
    apply: 'build',
    enforce: 'post',
    // Vite puts the entry script first, before <meta charset>. Inlined, that pushes the charset past the first 1024 bytes,
    // where browsers look for it, so file:// and hosts that send no charset may decode the page as windows-1252.
    // Move the script to the end of the page (after #app, as the old build did) before vite-plugin-singlefile inlines it.
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const tag = /<script type="module"[^>]*\ssrc="[^"]*"><\/script>\n?/.exec(html);
        if (tag) html = html.replace(tag[0], '') + tag[0].trimEnd() + '\n';
        // The bundled stylesheet (web/css, imported by main.ts) goes after the meta tags for the same reason, just before #app.
        const css = /<link rel="stylesheet"[^>]*href="[^"]*\.css"[^>]*>\n?/.exec(html);
        if (css) html = html.replace(css[0], '').replace('<div id="app">', css[0].trimEnd() + '\n<div id="app">');
        return html;
      },
    },
    // vite-plugin-singlefile only warns about anything it could not inline, so fail the build instead.
    writeBundle(_opts, bundle) {
      const files = Object.keys(bundle);
      if (files.length !== 1 || files[0] !== OUT) throw new Error(`expected only ${OUT} in the build, got: ${files.join(', ')}`);
      const html = (bundle[OUT] as { source: string | Uint8Array }).source.toString();
      const scripts = html.match(/<script\b[^>]*>/g) ?? [];
      if (scripts.length !== 1 || /\bsrc=/.test(scripts[0])) throw new Error(`expected one inline <script> in ${OUT}, got: ${scripts.join(' ')}`);
      if (html.split('</script').length !== 2) throw new Error(`the bundle contains "</script", which would end the inline script early`);
      const charset = /<meta charset="utf-8">/i.exec(html);
      if (!charset || new TextEncoder().encode(html.slice(0, charset.index + charset[0].length)).length > 1024) throw new Error(`<meta charset="utf-8"> must be within the first 1024 bytes of ${OUT}`);
    },
  };
}

// vite preview (make preview) serves dist/, which has no index.html, so the URL it prints would be a 404.
// Answer / with the page instead. This only affects the preview server, not the build.
function previewAtRoot(): Plugin {
  return {
    name: 'omerta:preview-at-root',
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/' || req.url?.startsWith('/?')) req.url = `/${OUT}${req.url.slice(1)}`;
        next();
      });
    },
  };
}

// The build's own date and time, shown under More, so a player can tell which version a phone has kept.
const BUILT = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  root: 'web',
  define: { __BUILT__: JSON.stringify(BUILT + ' UTC') },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    // Leave the hand-written CSS exactly as authored. Minifying it saves ~3 KB but lets Lightning CSS rewrite rules (prefixes, merges).
    cssMinify: false,
    modulePreload: { polyfill: false },
  },
  plugins: [viteSingleFile({ outputFileName: OUT }), singlePage(), previewAtRoot()],
  preview: { open: true },
});
