// The interface rebuild (docs/ui/AUDIT.md): every action the game handles stays reachable from a screen, and the components every
// screen is built from say what they should.
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, test as ok } from 'vitest';
import { choices, context, meter, rows } from '../../ui/kit';

const src = (f: string) => readFileSync(new URL('../../' + f, import.meta.url), 'utf8');

describe('every action stays reachable', () => {
  ok('each action web.ts handles is offered by some screen', { tags: ['architecture'] }, () => {
    const web = src('web.ts');
    const body = web.slice(web.indexOf('function handle('), web.indexOf('function require_plan'));
    const codes = [...new Set([...body.matchAll(/case '([a-z0-9]+)':/g)].map((m) => m[1]))];
    assert.ok(codes.length > 100, 'the router was read: ' + codes.length);
    const ui = readdirSync(new URL('../../ui/', import.meta.url)).filter((f) => f.endsWith('.ts')).map((f) => src('ui/' + f)).join('\n') + web;
    // (a code is offered when a screen writes it as an action: data-a="code:…", or builds the string 'code:…' for one)
    const missing = codes.filter((c) => ![`data-a="${c}:`, `'${c}:`, '`' + c + ':', `"${c}:`].some((p) => ui.includes(p)));
    assert.deepEqual(missing, [], 'handled but offered nowhere');
  });
});

describe('the components', () => {
  ok('choices are numbered in order, and the way out is last and unnumbered', { tags: ['unit'] }, () => {
    const html = choices([{ a: 't2:a', label: 'Take what you’ve got', hint: 'Take the $600' }, { a: 't2:b', label: 'Ask why' }, { a: 't2:leave', label: 'Leave', kind: 'out' }]);
    assert.deepEqual([...html.matchAll(/data-n="(\d)"/g)].map((m) => m[1]), ['1', '2']);
    assert.ok(html.indexOf('data-out="1"') > html.indexOf('data-n="2"'), 'leave comes last');
    assert.ok(html.includes('Take the $600') && html.includes('<ol class="ui-choices"'));
  });
  ok('labels are escaped: a name with an apostrophe or a tag cannot break the page', { tags: ['unit'] }, () => {
    const html = choices([{ a: 'x:1', label: '<b>O’Hara & Sons</b>', hint: '"quoted"' }]);
    assert.ok(html.includes('&lt;b&gt;O’Hara &amp; Sons&lt;/b&gt;') && html.includes('&quot;quoted&quot;'));
  });
  ok('a meter at nothing shows the word without a bar', { tags: ['unit'] }, () => {
    assert.ok(!meter('Grudge', 'None', 0).includes('ui-meter__bar'));
    assert.ok(meter('Trust', 'Guarded', 0.4).includes('width:40%'));
  });
  ok('empty lists and empty context draw nothing', { tags: ['unit'] }, () => {
    assert.equal(rows([]), '');
    assert.equal(context([]), '');
  });
});
