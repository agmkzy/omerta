// Runs before every test file (vitest.config.ts setupFiles). Fails the file if any of its tests, skipped ones included,
// does not carry exactly one type tag from tags.ts.
import { beforeAll } from 'vitest';
import { TYPES } from './tags';

type Task = { type: string; name: string; tags?: string[]; tasks?: Task[] };
const tests = (t: Task, out: Task[] = []): Task[] => { if (t.type === 'test') out.push(t); for (const c of t.tasks ?? []) tests(c, out); return out; };

beforeAll(({}, file) => {
  const types: readonly string[] = TYPES;
  const bad = tests(file as unknown as Task).filter((t) => (t.tags ?? []).filter((x) => types.includes(x)).length !== 1);
  if (bad.length) throw new Error(`each test needs exactly one type tag (${TYPES.join(', ')}), see src/tests/tags.ts:\n` + bad.map((t) => `  "${t.name}" has [${(t.tags ?? []).join(', ')}]`).join('\n'));
});
