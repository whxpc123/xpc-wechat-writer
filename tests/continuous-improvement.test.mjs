import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readJsonLines } from '../scripts/lib/state-io.mjs';
import {
  eligibleGroups,
  recordDecision,
  recordLearning,
  snapshotProposal,
  validateSignal,
  validateProposal,
  verifyOrRollback,
  writeProposal,
} from '../scripts/lib/learning-state.mjs';

async function makeLearningFixture(t, articleId) {
  const root = await mkdtemp(join(tmpdir(), 'xpc-learning-article-'));
  t?.after(() => rm(root, { recursive: true, force: true }));
  const articleDir = join(root, articleId);
  await mkdir(articleDir, { recursive: true });
  await writeFile(join(articleDir, 'qa-report.md'), '# QA\n\nStatus: PASS\n', 'utf8');
  await writeFile(join(articleDir, 'edit-report.md'), '# 编辑报告\n\n结构与事实复核通过。\n', 'utf8');
  return articleDir;
}

test('learning records each article and three independent corrections become eligible', async (t) => {
  const stateDir = await mkdtemp(join(tmpdir(), 'xpc-learning-state-'));
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  const articleDirs = [];

  for (const articleId of ['A-1', 'A-2', 'A-3']) {
    const articleDir = await makeLearningFixture(t, articleId);
    articleDirs.push(articleDir);
    await recordLearning({
      articleDir,
      stateDir,
      signals: [{
        kind: 'user_correction',
        rule_key: 'opening-specificity',
        summary: '开头需要具体人物或数字',
        scope: 'candidate_long_term',
        direction: 'adopt',
      }],
      idFactory: ({ articleId: id }) => `E-${id}`,
      clock: () => new Date('2026-08-30T02:00:00.000Z'),
    });
  }

  const events = await readJsonLines(join(stateDir, 'feedback.jsonl'));
  const group = eligibleGroups(events).find((item) => item.rule_key === 'opening-specificity');
  assert.equal(events.length, 3);
  assert.equal(group.eligible, true);
  assert.equal(group.unique_articles, 3);
  assert.equal(
    (await readFile(join(articleDirs[0], 'learning-report.md'), 'utf8')).includes('开头需要具体人物或数字'),
    true,
  );
});

test('one explicit long-term preference is eligible but one model hypothesis is not', () => {
  const explicit = eligibleGroups([{
    event_id: 'E-1',
    article_id: 'A-1',
    kind: 'user_long_term_preference',
    rule_key: 'no-email',
    summary: '以后不放邮箱',
    scope: 'candidate_long_term',
    direction: 'avoid',
  }]);
  const hypothesis = eligibleGroups([{
    event_id: 'E-2',
    article_id: 'A-1',
    kind: 'model_hypothesis',
    rule_key: 'more-headings',
    summary: '也许应增加标题',
    scope: 'candidate_long_term',
    direction: 'adopt',
  }]);
  assert.equal(explicit[0].eligible, true);
  assert.equal(hypothesis[0].eligible, false);
});

test('conflicting directions stop eligibility until the user resolves them', () => {
  const events = [
    { event_id: 'E-1', article_id: 'A-1', kind: 'user_long_term_preference', rule_key: 'heading-density', summary: '以后增加小标题', scope: 'candidate_long_term', direction: 'adopt' },
    { event_id: 'E-2', article_id: 'A-2', kind: 'user_long_term_preference', rule_key: 'heading-density', summary: '以后减少小标题', scope: 'candidate_long_term', direction: 'avoid' },
  ];
  const group = eligibleGroups(events)[0];
  assert.equal(group.conflict, true);
  assert.equal(group.eligible, false);
});

test('signals reject unsafe evidence paths and credential values', () => {
  assert.throws(
    () => validateSignal({
      kind: 'user_correction',
      rule_key: 'safe-logs',
      summary: '日志里出现 access_token=real-secret',
      scope: 'candidate_long_term',
      direction: 'avoid',
    }),
    /credential/i,
  );
  assert.throws(
    () => validateSignal({
      kind: 'qa_failure',
      rule_key: 'safe-paths',
      summary: '路径错误',
      scope: 'candidate_long_term',
      direction: 'avoid',
      evidence_files: ['../outside.md'],
    }),
    /unsafe relative path/i,
  );
});

function threeEligibleEvents(ruleKey = 'opening-specificity') {
  return ['A-1', 'A-2', 'A-3'].map((articleId, index) => ({
    schema_version: 1,
    event_id: `E-${index + 1}`,
    article_id: articleId,
    recorded_at: '2026-08-30T02:00:00.000Z',
    kind: 'user_correction',
    rule_key: ruleKey,
    summary: '开头需要具体人物或数字',
    scope: 'candidate_long_term',
    direction: 'adopt',
    evidence_files: ['edit-report.md'],
  }));
}

function completeProposal(events) {
  return {
    schema_version: 1,
    proposal_id: 'P-0001',
    status: 'proposed',
    rule_key: 'opening-specificity',
    problem: '抽象开头重复造成返工',
    scope: '公众号长文开头',
    evidence_event_ids: events.map((event) => event.event_id),
    affected_files: ['references/writing-style.md', 'evals/evals.json'],
    patch_summary: '要求前 200 字出现具体人物、事件、物件或数字',
    patch_preview: '在开头硬规则中增加可验证约束，并增加回归评测。',
    risk: '过度具体可能压缩随笔类文章空间',
    rollback: '恢复快照中的两个文件',
    new_eval_ids: [1015],
  };
}

test('proposal validation requires eligible evidence and complete risk controls', () => {
  const events = threeEligibleEvents();
  const proposal = completeProposal(events);
  assert.doesNotThrow(() => validateProposal(proposal, events));
  assert.throws(() => validateProposal({ ...proposal, risk: '' }, events), /risk/i);
  assert.throws(
    () => validateProposal({ ...proposal, affected_files: ['../outside.md'] }, events),
    /unsafe relative path/i,
  );
  assert.throws(
    () => validateProposal({ ...proposal, evidence_event_ids: ['E-1'] }, events),
    /not eligible/i,
  );
});

test('proposal persistence writes complete JSON and Markdown outside the Skill', async (t) => {
  const stateDir = await mkdtemp(join(tmpdir(), 'xpc-proposal-state-'));
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  const events = threeEligibleEvents();
  await writeFile(
    join(stateDir, 'feedback.jsonl'),
    `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
    'utf8',
  );
  const proposal = completeProposal(events);
  const result = await writeProposal({ stateDir, proposal, events });
  const persisted = JSON.parse(await readFile(result.json, 'utf8'));
  const markdown = await readFile(result.markdown, 'utf8');
  assert.deepEqual(persisted, proposal);
  assert.match(markdown, /抽象开头重复造成返工/);
  assert.match(markdown, /E-1/);
  assert.equal(markdown.includes('TBD'), false);
  await assert.rejects(() => writeProposal({ stateDir, proposal, events }), /already exists/i);
});

async function makeSkillFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'xpc-skill-fixture-'));
  t?.after(() => rm(root, { recursive: true, force: true }));
  const skillDir = join(root, 'skill');
  const stateDir = join(root, 'state');
  await mkdir(join(skillDir, 'references'), { recursive: true });
  await mkdir(join(stateDir, 'proposals'), { recursive: true });
  await writeFile(
    join(skillDir, 'SKILL.md'),
    '---\nname: xpc-wechat-writer\ndescription: fixture\n---\n\n# Fixture\n',
    'utf8',
  );
  const proposal = {
    ...completeProposal(threeEligibleEvents()),
    proposal_id: 'P-ROLLBACK',
    affected_files: ['SKILL.md'],
  };
  await writeFile(
    join(stateDir, 'proposals', `${proposal.proposal_id}.json`),
    `${JSON.stringify(proposal, null, 2)}\n`,
    'utf8',
  );
  return { root, skillDir, stateDir, proposal };
}

function passingEvalResults(proposal) {
  return {
    proposal_id: proposal.proposal_id,
    results: proposal.new_eval_ids.map((eval_id) => ({
      eval_id,
      passed: true,
      evidence: 'fixture pass',
    })),
  };
}

test('snapshot requires user approval and failed verification restores original files', async (t) => {
  const fixture = await makeSkillFixture(t);
  await assert.rejects(
    () => snapshotProposal({
      proposal: fixture.proposal,
      stateDir: fixture.stateDir,
      skillDir: fixture.skillDir,
    }),
    /approved decision/i,
  );

  await recordDecision({
    stateDir: fixture.stateDir,
    proposalId: fixture.proposal.proposal_id,
    decision: 'approved',
    source: 'user',
    evidence: '用户明确确认 P-ROLLBACK',
  });
  await snapshotProposal({
    proposal: fixture.proposal,
    stateDir: fixture.stateDir,
    skillDir: fixture.skillDir,
  });
  await writeFile(join(fixture.skillDir, 'SKILL.md'), 'broken', 'utf8');

  const result = await verifyOrRollback({
    proposal: fixture.proposal,
    stateDir: fixture.stateDir,
    skillDir: fixture.skillDir,
    runQuickValidate: async () => ({ ok: false, output: 'Invalid frontmatter' }),
    runTests: async () => ({ ok: true, output: 'tests pass' }),
    runEvalSchema: async () => ({ ok: true, output: 'schema pass' }),
    evalResults: passingEvalResults(fixture.proposal),
    requiredEvalIds: fixture.proposal.new_eval_ids,
  });
  assert.equal(result.status, 'rolled_back');
  assert.match(await readFile(join(fixture.skillDir, 'SKILL.md'), 'utf8'), /^---/);
});

test('all passing validators accept an approved proposal and keep the patch', async (t) => {
  const fixture = await makeSkillFixture(t);
  await recordDecision({
    stateDir: fixture.stateDir,
    proposalId: fixture.proposal.proposal_id,
    decision: 'approved',
    source: 'user',
    evidence: '用户明确确认 P-ROLLBACK',
  });
  await snapshotProposal({
    proposal: fixture.proposal,
    stateDir: fixture.stateDir,
    skillDir: fixture.skillDir,
  });
  await writeFile(join(fixture.skillDir, 'SKILL.md'), 'patched skill', 'utf8');
  const result = await verifyOrRollback({
    proposal: fixture.proposal,
    stateDir: fixture.stateDir,
    skillDir: fixture.skillDir,
    runQuickValidate: async () => ({ ok: true, output: 'valid' }),
    runTests: async () => ({ ok: true, output: 'tests pass' }),
    runEvalSchema: async () => ({ ok: true, output: 'schema pass' }),
    evalResults: passingEvalResults(fixture.proposal),
    requiredEvalIds: fixture.proposal.new_eval_ids,
  });
  assert.equal(result.status, 'accepted');
  assert.equal(await readFile(join(fixture.skillDir, 'SKILL.md'), 'utf8'), 'patched skill');
});
