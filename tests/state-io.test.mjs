import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  appendJsonLine,
  assertSafeRelativePath,
  hashFile,
  readJson,
  readJsonIfExists,
  readJsonLines,
  redact,
  sha256Text,
  writeTextAtomic,
  writeJsonAtomic,
} from '../scripts/lib/state-io.mjs';

test('state helpers write JSON atomically and append JSONL', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'xpc-state-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const json = join(root, 'nested', 'state.json');
  const jsonl = join(root, 'events', 'feedback.jsonl');

  await writeJsonAtomic(json, { status: 'prepared' });
  await writeTextAtomic(join(root, 'nested', 'report.md'), '# Report\n');
  assert.deepEqual(await readJson(json), { status: 'prepared' });
  assert.equal(await readFile(join(root, 'nested', 'report.md'), 'utf8'), '# Report\n');
  assert.equal(await readJsonIfExists(join(root, 'missing.json')), null);

  await appendJsonLine(jsonl, { event_id: 'E-1' });
  await appendJsonLine(jsonl, { event_id: 'E-2' });
  assert.deepEqual(await readJsonLines(jsonl), [{ event_id: 'E-1' }, { event_id: 'E-2' }]);
  assert.equal(await hashFile(json), sha256Text(await readFile(json)));
});

test('path validation rejects traversal and absolute paths', () => {
  assert.equal(assertSafeRelativePath('references/continuous-improvement.md'), 'references/continuous-improvement.md');
  assert.throws(() => assertSafeRelativePath('../outside'), /unsafe relative path/i);
  assert.throws(() => assertSafeRelativePath('references/../../outside'), /unsafe relative path/i);
  assert.throws(() => assertSafeRelativePath('/absolute/path'), /unsafe relative path/i);
  assert.throws(() => assertSafeRelativePath('..\\outside'), /unsafe relative path/i);
});

test('redaction removes credential values recursively', () => {
  assert.equal(
    redact('appid=wx1 appsecret=secret access_token=token cookie=session'),
    'appid=wx1 appsecret=[REDACTED] access_token=[REDACTED] cookie=[REDACTED]',
  );
  assert.deepEqual(
    redact({ nested: { appSecret: 'secret', safe: 'value' }, list: ['authorization=Bearer-token'] }),
    { nested: { appSecret: '[REDACTED]', safe: 'value' }, list: ['authorization=[REDACTED]'] },
  );
});
