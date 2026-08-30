import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { resolvePostToWechat } from '../scripts/resolve_post_to_wechat.mjs';
import {
  prepareDraft,
  transitionDraft,
} from '../scripts/lib/draft-manifest.mjs';
import {
  buildPublisherInvocation,
  parsePublisherSuccess,
  saveDraft,
} from '../scripts/save_wechat_draft.mjs';

async function fakePublisher(root, { includeBrowser = true } = {}) {
  await mkdir(join(root, 'scripts'), { recursive: true });
  await writeFile(
    join(root, 'SKILL.md'),
    '---\nname: baoyu-post-to-wechat\ndescription: test fixture\n---\n',
    'utf8',
  );
  await writeFile(join(root, 'scripts', 'wechat-api.ts'), '', 'utf8');
  if (includeBrowser) {
    await writeFile(join(root, 'scripts', 'wechat-article.ts'), '', 'utf8');
  }
}

test('explicit publishing Skill path wins and includes both posting scripts', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'xpc-publisher-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const explicit = join(root, 'explicit-publisher');
  await fakePublisher(explicit);

  const result = await resolvePostToWechat({
    explicit,
    cwd: join(root, 'cwd'),
    home: join(root, 'home'),
    skillRoot: join(root, 'xpc-wechat-writer'),
  });

  assert.equal(result.found, true);
  assert.equal(result.path, resolve(explicit));
  assert.match(result.apiScript, /wechat-api\.ts$/);
  assert.match(result.browserScript, /wechat-article\.ts$/);
});

test('resolver skips incomplete candidates and returns searched paths on failure', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'xpc-publisher-missing-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const incomplete = join(root, 'incomplete');
  await fakePublisher(incomplete, { includeBrowser: false });

  const result = await resolvePostToWechat({
    explicit: incomplete,
    cwd: join(root, 'cwd'),
    home: join(root, 'home'),
    skillRoot: join(root, 'xpc-wechat-writer'),
  });

  assert.equal(result.found, false);
  assert.equal(result.path, null);
  assert.equal(result.searched.includes(resolve(incomplete)), true);
});

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zt9sAAAAASUVORK5CYII=',
  'base64',
);

async function makeArticleFixture(t) {
  const articleDir = await mkdtemp(join(tmpdir(), 'xpc-article-'));
  t?.after(() => rm(articleDir, { recursive: true, force: true }));
  await mkdir(join(articleDir, 'imgs'), { recursive: true });
  await writeFile(
    join(articleDir, 'article.md'),
    '---\ntitle: 测试文章\nsummary: 这是一段用于草稿适配器测试的摘要。\n---\n\n正文。\n',
    'utf8',
  );
  await writeFile(
    join(articleDir, 'article-formatted.html'),
    '<section><p><span leaf="">正文。</span></p><img src="imgs/01-test.png" style="max-width:100%;height:auto;display:block;margin:0 auto"></section>',
    'utf8',
  );
  await writeFile(join(articleDir, 'imgs', 'cover.png'), ONE_PIXEL_PNG);
  await writeFile(join(articleDir, 'imgs', '01-test.png'), ONE_PIXEL_PNG);
  await writeFile(join(articleDir, 'qa-report.md'), '# QA\n\nStatus: PASS\n', 'utf8');
  return articleDir;
}

async function preparedFixture(t, method = 'api') {
  const articleDir = await makeArticleFixture(t);
  const manifest = await prepareDraft({
    articleDir,
    method,
    accountAlias: 'default',
    deliveryCheck: async () => ({ ok: true }),
  });
  return { articleDir, manifest };
}

test('draft preparation requires delivery PASS and produces a stable fingerprint', async (t) => {
  const articleDir = await makeArticleFixture(t);
  const fixedClock = () => new Date('2026-08-30T00:00:00.000Z');
  const first = await prepareDraft({
    articleDir,
    accountAlias: 'default',
    method: 'api',
    deliveryCheck: async () => ({ ok: true }),
    clock: fixedClock,
  });

  assert.equal(first.status, 'prepared');
  assert.match(first.content_fingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.cover_verification_required, false);
  assert.deepEqual(
    JSON.parse(await readFile(join(articleDir, 'wechat-draft.json'), 'utf8')),
    first,
  );

  const second = await prepareDraft({
    articleDir,
    accountAlias: 'default',
    method: 'api',
    deliveryCheck: async () => ({ ok: true }),
    clock: fixedClock,
  });
  assert.equal(second.content_fingerprint, first.content_fingerprint);
});

test('draft preparation fails closed when delivery QA fails', async (t) => {
  const articleDir = await makeArticleFixture(t);
  await assert.rejects(
    () => prepareDraft({
      articleDir,
      method: 'api',
      deliveryCheck: async () => ({ ok: false, error: 'QA failed' }),
    }),
    /QA failed/,
  );
  await assert.rejects(() => access(join(articleDir, 'wechat-draft.json')), /ENOENT/);
});

test('draft state transitions are explicit and identical saved content is blocked', async (t) => {
  const articleDir = await makeArticleFixture(t);
  const manifest = await prepareDraft({
    articleDir,
    method: 'browser',
    deliveryCheck: async () => ({ ok: true }),
  });
  const manifestPath = join(articleDir, 'wechat-draft.json');
  assert.equal(manifest.cover_verification_required, true);

  await transitionDraft({
    manifestPath,
    from: 'prepared',
    to: 'submitting',
    patch: { attempt_id: 'ATTEMPT-1' },
  });
  await assert.rejects(
    () => transitionDraft({ manifestPath, from: 'prepared', to: 'saved', patch: {} }),
    /expected prepared/i,
  );
  await transitionDraft({
    manifestPath,
    from: 'submitting',
    to: 'saved',
    patch: { draft_id: 'APPMSG-1', draft_id_type: 'appmsgid', appmsgid: 'APPMSG-1' },
  });
  await assert.rejects(
    () => prepareDraft({
      articleDir,
      method: 'browser',
      deliveryCheck: async () => ({ ok: true }),
    }),
    /identical draft already saved/i,
  );
});

const FAKE_DEPENDENCY = {
  found: true,
  apiScript: '/fake/wechat-api.ts',
  browserScript: '/fake/wechat-article.ts',
};

test('publisher invocation is method-specific and contains no credentials', async (t) => {
  const { articleDir, manifest } = await preparedFixture(t, 'api');
  const api = buildPublisherInvocation({
    manifest,
    manifestPath: join(articleDir, 'wechat-draft.json'),
    dependency: FAKE_DEPENDENCY,
    runtime: { command: 'npx', prefix: ['-y', 'bun'] },
  });
  assert.equal(api.command, 'npx');
  assert.deepEqual(api.args.slice(0, 3), ['-y', 'bun', '/fake/wechat-api.ts']);
  assert.equal(api.args.includes('--cover'), true);
  assert.equal(api.args.includes('--submit'), false);
  assert.equal(/secret|access[_-]?token|cookie/i.test(api.args.join(' ')), false);

  const browser = buildPublisherInvocation({
    manifest: { ...manifest, method: 'browser' },
    manifestPath: join(articleDir, 'wechat-draft.json'),
    dependency: FAKE_DEPENDENCY,
    runtime: { command: 'bun', prefix: [] },
  });
  assert.equal(browser.args.includes('--submit'), true);
  assert.equal(browser.args.includes('--cover'), false);
});

test('publisher output parsing preserves API and browser identifier types', () => {
  assert.deepEqual(
    parsePublisherSuccess('api', '{\n  "success": true,\n  "media_id": "MEDIA-1",\n  "method": "api"\n}'),
    {
      draft_id: 'MEDIA-1',
      draft_id_type: 'media_id',
      media_id: 'MEDIA-1',
      appmsgid: null,
      cover_verification_required: false,
    },
  );
  assert.deepEqual(
    parsePublisherSuccess('browser', '[wechat] Draft saved successfully! appmsgid: APPMSG-1\n'),
    {
      draft_id: 'APPMSG-1',
      draft_id_type: 'appmsgid',
      media_id: null,
      appmsgid: 'APPMSG-1',
      cover_verification_required: true,
    },
  );
  assert.equal(parsePublisherSuccess('api', 'not json'), null);
});

test('submission requires exact fingerprint confirmation and records API success', async (t) => {
  const { articleDir, manifest } = await preparedFixture(t, 'api');
  const manifestPath = join(articleDir, 'wechat-draft.json');
  let calls = 0;
  const runner = async () => {
    calls += 1;
    return {
      code: 0,
      signal: null,
      stdout: '{"success":true,"media_id":"MEDIA-1","method":"api"}',
      stderr: '',
    };
  };

  await assert.rejects(
    () => saveDraft({
      manifestPath,
      confirmedFingerprint: 'sha256:wrong',
      runner,
      dependency: FAKE_DEPENDENCY,
    }),
    /fingerprint confirmation/i,
  );
  assert.equal(calls, 0);

  const saved = await saveDraft({
    manifestPath,
    confirmedFingerprint: manifest.content_fingerprint,
    runner,
    dependency: FAKE_DEPENDENCY,
    attemptId: () => 'ATTEMPT-1',
    clock: () => new Date('2026-08-30T01:00:00.000Z'),
  });
  assert.equal(calls, 1);
  assert.equal(saved.status, 'saved');
  assert.equal(saved.draft_id, 'MEDIA-1');
  assert.equal(saved.draft_id_type, 'media_id');
  assert.equal(saved.attempt_id, 'ATTEMPT-1');
});

test('interrupted or unparseable results become unknown without retries', async (t) => {
  const { articleDir, manifest } = await preparedFixture(t, 'browser');
  let calls = 0;
  const result = await saveDraft({
    manifestPath: join(articleDir, 'wechat-draft.json'),
    confirmedFingerprint: manifest.content_fingerprint,
    runner: async () => {
      calls += 1;
      return { code: 1, signal: null, stdout: '', stderr: 'connection closed access_token=hidden' };
    },
    dependency: FAKE_DEPENDENCY,
    attemptId: () => 'ATTEMPT-UNKNOWN',
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 'unknown');
  assert.equal(result.cover_verification_required, true);
  assert.equal(result.last_error.includes('hidden'), false);
  assert.equal(result.last_error.includes('[REDACTED]'), true);
});
