// What a source file imports, for the overhaul's boundary test. TypeScript's own pre-processor finds every import, export-from,
// require and dynamic import with a literal path, and skips comments and strings that only look like imports.
import ts from 'typescript';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

export interface Import {
  readonly specifier: string;
  readonly line: number;
}

export function importsIn(source: string): Import[] {
  const { importedFiles } = ts.preProcessFile(source, true, true);
  return importedFiles.map((f) => ({ specifier: f.fileName, line: source.slice(0, f.pos).split('\n').length }));
}

/** The file or folder an import points at: relative to the importing file, or to the repository root for a path starting with
 * `/` (as Vite allows). Null for a package or a Node module, which cannot point into the repository. */
export function target(specifier: string, file: string, root: string): string | null {
  if (specifier.startsWith('.')) return resolve(dirname(file), specifier);
  if (specifier.startsWith('/')) return join(root, specifier);
  return null;
}

/** Whether `path` is `folder` or inside it. */
export function within(path: string, folder: string): boolean {
  const r = relative(folder, path);
  return r === '' || (!r.startsWith('..') && !isAbsolute(r));
}

const SOURCE = /\.(?:[cm]?ts|tsx|[cm]?js|jsx|vue)$/;
// Installed packages, git's own files, coverage reports and builds, wherever they are: none of it is source.
const NOT_SOURCE = new Set(['node_modules', '.git', 'coverage', 'dist']);

/** Every source file under `folder`, skipping the folders in `skip` (absolute paths). */
export function sourceFiles(folder: string, skip: readonly string[] = []): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (NOT_SOURCE.has(entry.name) || skip.some((s) => within(path, s))) return [];
    if (entry.isDirectory()) return sourceFiles(path, skip);
    return SOURCE.test(entry.name) ? [path] : [];
  });
}

export interface Found extends Import {
  readonly file: string;
  readonly target: string | null;
}

/** Every import in the given files, with where it points. */
export function importsOf(files: readonly string[], root: string): Found[] {
  return files.flatMap((file) =>
    importsIn(readFileSync(file, 'utf8')).map((i) => ({ ...i, file, target: target(i.specifier, file, root) })),
  );
}
