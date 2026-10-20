#!/bin/sh
# Bundle the engine + mobile UI into one self-contained HTML page (dist/omerta.html).
set -e
ESB=${ESBUILD:-esbuild}
$ESB src/web.ts --bundle --format=iife --minify --target=es2020 --outfile=dist/web.js
if grep -q '</script' dist/web.js; then echo "bundle contains </script"; exit 1; fi
cp web/template.html dist/omerta.html
printf '<script>' >> dist/omerta.html
cat dist/web.js >> dist/omerta.html
printf '</script>\n' >> dist/omerta.html
echo "built dist/omerta.html ($(wc -c < dist/omerta.html) bytes)"
