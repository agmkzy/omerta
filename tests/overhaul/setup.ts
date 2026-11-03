// Runs before every test file (vitest.overhaul.config.ts setupFiles). Fails the file if any of its tests, skipped ones included,
// does not carry exactly one kind from tags.ts.
import { beforeAll } from 'vitest';
import { KINDS } from './tags';

interface Task {
  readonly type: string;
  readonly name: string;
  readonly tags?: readonly string[];
  readonly tasks?: readonly Task[];
}

const testsIn = (task: Task): Task[] => [...(task.type === 'test' ? [task] : []), ...(task.tasks ?? []).flatMap(testsIn)];

// (Vitest reads the first argument as a fixture list, so it must be an object pattern, even an empty one.)
beforeAll(({}, file) => {
  const kinds: readonly string[] = KINDS;
  const bad = testsIn(file as unknown as Task).filter((t) => (t.tags ?? []).filter((tag) => kinds.includes(tag)).length !== 1);
  if (bad.length)
    throw new Error(
      `each test needs exactly one kind (${KINDS.join(', ')}), see tests/overhaul/tags.ts:\n` +
        bad.map((t) => `  "${t.name}" has [${(t.tags ?? []).join(', ')}]`).join('\n'),
    );
});
