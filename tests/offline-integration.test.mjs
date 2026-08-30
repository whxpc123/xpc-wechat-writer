import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { prepareDraft } from '../scripts/lib/draft-manifest.mjs';
import {
  eligibleGroups,
  recordDecision,
  recordLearning,
  snapshotProposal,
  verifyOrRollback,
  writeProposal,
} from '../scripts/lib/learning-state.mjs';
import { readJsonLines } from '../scripts/lib/state-io.mjs';
import { saveDraft } from '../scripts/save_wechat_draft.mjs';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zt9sAAAAASUVORK5CYII=',
  'base64',
);

async function articleFixture(root, articleId) {
  const articleDir = join(root, articleId);
  await mkdir(join(articleDir, 'imgs'), { recursive: true });
  await writeFile(join(articleDir, 'article.md'), '---\ntitle: 离线验证文章\nsummary: 用于验证草稿和学习闭环的离线摘要。\n---\n\n正文。\n', 'utf8');
  await writeFile(join(articleDir, 'article-formatted.html'), '<section><p><span leaf="">正文。</span></p><img src="imgs/01.png"></section>', 'utf8');
  await writeFile(join(articleDir, 'imgs', 'cover.png'), PNG);
  await writeFile(join(articleDir, 'imgs', '01.png'), PNG);
  await writeFile(join(articleDir, 'qa-report.md'), '# QA\n\nStatus: PASS\n', 'utf8');
  await writeFile(join(articleDir, 'edit-report.md'), '# 编辑报告\n\n结构与事实复核通过。\n', 'utf8');
  return articleDir;
}

test('offline full flow saves once, proposes safely, and restores a failed Skill patch', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'xpc-offline-flow-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const articlesRoot = join(root, 'articles');
  const stateDir = join(articlesRoot, '_xpc-wechat-state');
  const articleDir = await articleFixture(articlesRoot, 'A-1');
  const manifest = await prepareDraft({
    articleDir,
    method: 'api',
    accountAlias: 'offline-fixture',
    deliveryCheck: async () => ({ ok: true }),
  });

  let publisherCalls = 0;
  const runner = async () => {
    publisherCalls += 1;
    return {
      code: 0,
      signal: null,
      stdout: '{"success":true,"media_id":"FAKE-MEDIA","method":"api"}',
      stderr: '',
    };
  };
  const dependency = {
    found: true,
    apiScript: '/offline/wechat-api.ts',
    browserScript: '/offline/wechat-article.ts',
  };
  const runtime = { command: process.execPath, prefix: [] };

  await assert.rejects(
    () => saveDraft({
      manifestPath: join(articleDir, 'wechat-draft.json'),
      confirmedFingerprint: 'sha256:wrong',
      runner,
      dependency,
      runtime,
    }),
    /fingerprint confirmation/i,
  );
  const saved = await saveDraft({
    manifestPath: join(articleDir, 'wechat-draft.json'),
    confirmedFingerprint: manifest.content_fingerprint,
    runner,
    dependency,
    runtime,
    attemptId: () => 'OFFLINE-ATTEMPT',
  });
  assert.equal(saved.status, 'saved');
  assert.equal(saved.media_id, 'FAKE-MEDIA');
  assert.equal(publisherCalls, 1);

  for (const articleId of ['A-1', 'A-2', 'A-3']) {
    const currentDir = articleId === 'A-1' ? articleDir : await articleFixture(articlesRoot, articleId);
    await recordLearning({
      articleDir: currentDir,
      stateDir,
      signals: [{
        kind: 'user_correction',
        rule_key: 'opening-specificity',
        summary: '开头需要具体人物或数字',
        scope: 'candidate_long_term',
        direction: 'adopt',
      }],
      idFactory: ({ articleId: id }) => `E-${id}`,
    });
  }
  const events = await readJsonLines(join(stateDir, 'feedback.jsonl'));
  assert.equal(eligibleGroups(events)[0].eligible, true);

  const proposal = {
    schema_version: 1,
    proposal_id: 'P-OFFLINE',
    status: 'proposed',
    rule_key: 'opening-specificity',
    problem: '抽象开头重复造成返工',
    scope: '离线测试 Skill',
    evidence_event_ids: events.map((event) => event.event_id),
    affected_files: ['SKILL.md'],
    patch_summary: '增加具体开头约束',
    patch_preview: '在测试 Skill 中写入一条规则。',
    risk: '规则过严会限制少数文章原型',
    rollback: '恢复 SKILL.md 快照',
    new_eval_ids: [2001],
  };
  await writeProposal({ stateDir, proposal, events });

  const fixtureSkill = join(root, 'fixture-skill');
  await mkdir(fixtureSkill, { recursive: true });
  const originalSkill = '---\nname: fixture-skill\ndescription: offline fixture\n---\n\n# Fixture\n';
  await writeFile(join(fixtureSkill, 'SKILL.md'), originalSkill, 'utf8');
  await recordDecision({
    stateDir,
    proposalId: proposal.proposal_id,
    decision: 'approved',
    source: 'user',
    evidence: '用户明确批准 P-OFFLINE',
  });
  await snapshotProposal({ proposal, stateDir, skillDir: fixtureSkill });
  await writeFile(join(fixtureSkill, 'SKILL.md'), 'broken patch', 'utf8');
  const verification = await verifyOrRollback({
    proposal,
    stateDir,
    skillDir: fixtureSkill,
    runQuickValidate: async () => ({ ok: false, output: 'forced offline failure' }),
    runTests: async () => ({ ok: true, output: 'offline tests pass' }),
    runEvalSchema: async () => ({ ok: true, output: 'offline eval schema pass' }),
    evalResults: {
      proposal_id: proposal.proposal_id,
      results: [{ eval_id: 2001, passed: true, evidence: 'offline behavior passed' }],
    },
    requiredEvalIds: [2001],
  });
  assert.equal(verification.status, 'rolled_back');
  assert.equal(await readFile(join(fixtureSkill, 'SKILL.md'), 'utf8'), originalSkill);
  assert.equal(publisherCalls, 1);
});
