import { randomUUID } from 'node:crypto';
import {
  access,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

import {
  appendJsonLine,
  assertSafeRelativePath,
  hashFile,
  readJsonIfExists,
  readJsonLines,
  redact,
  writeJsonAtomic,
  writeTextAtomic,
} from './state-io.mjs';

export const SIGNAL_KINDS = new Set([
  'user_long_term_preference',
  'user_correction',
  'qa_failure',
  'rework',
  'effective_practice',
  'model_hypothesis',
]);

export const SIGNAL_SCOPES = new Set(['article', 'candidate_long_term']);
export const SIGNAL_DIRECTIONS = new Set(['adopt', 'avoid', 'neutral']);

function containsCredentialValue(value) {
  return typeof value === 'string' && redact(value) !== value;
}

export function validateSignal(signal) {
  if (!signal || typeof signal !== 'object' || Array.isArray(signal)) {
    throw new Error('Learning signal must be an object');
  }
  if (!SIGNAL_KINDS.has(signal.kind)) throw new Error(`Unknown learning signal kind: ${signal.kind}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(signal.rule_key || '')) {
    throw new Error(`Invalid rule_key: ${signal.rule_key || '(empty)'}`);
  }
  const summary = signal.summary?.trim();
  if (!summary || summary.length > 500) throw new Error('Learning signal summary must contain 1-500 characters');
  if (containsCredentialValue(summary)) throw new Error('Learning signal contains a credential value');
  const scope = signal.scope ?? 'article';
  if (!SIGNAL_SCOPES.has(scope)) throw new Error(`Unknown learning signal scope: ${scope}`);
  const direction = signal.direction ?? 'neutral';
  if (!SIGNAL_DIRECTIONS.has(direction)) throw new Error(`Unknown learning signal direction: ${direction}`);
  const evidenceFiles = signal.evidence_files ?? [];
  if (!Array.isArray(evidenceFiles)) throw new Error('evidence_files must be an array');

  return {
    kind: signal.kind,
    rule_key: signal.rule_key,
    summary,
    scope,
    direction,
    evidence_files: evidenceFiles.map((file) => assertSafeRelativePath(file)),
  };
}

function defaultEvidenceFiles() {
  return ['qa-report.md', 'edit-report.md', 'wechat-draft.json'];
}

async function existingEvidenceFiles(articleDir) {
  const found = [];
  for (const relativePath of defaultEvidenceFiles()) {
    try {
      await access(join(articleDir, relativePath));
      found.push(relativePath);
    } catch {
      // Optional evidence is recorded only when present.
    }
  }
  return found;
}

export function eligibleGroups(events, threshold = 3) {
  const groups = new Map();
  for (const event of events) {
    if (!event?.rule_key) continue;
    if (!groups.has(event.rule_key)) groups.set(event.rule_key, []);
    groups.get(event.rule_key).push(event);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([ruleKey, groupEvents]) => {
      const candidateEvents = groupEvents.filter((event) => event.scope === 'candidate_long_term');
      const directions = new Set(candidateEvents.map((event) => event.direction).filter((value) => value && value !== 'neutral'));
      const conflict = directions.has('adopt') && directions.has('avoid');
      const explicit = candidateEvents.some((event) => event.kind === 'user_long_term_preference');
      const promotableKinds = new Set(['user_correction', 'qa_failure', 'rework']);
      const promotable = candidateEvents.filter((event) => promotableKinds.has(event.kind));
      const uniqueArticles = new Set(promotable.map((event) => event.article_id)).size;
      return {
        rule_key: ruleKey,
        eligible: !conflict && (explicit || uniqueArticles >= threshold),
        conflict,
        explicit_long_term_preference: explicit,
        unique_articles: new Set(candidateEvents.map((event) => event.article_id)).size,
        promotable_unique_articles: uniqueArticles,
        event_ids: candidateEvents.map((event) => event.event_id),
        summaries: [...new Set(candidateEvents.map((event) => event.summary))],
        directions: [...directions].sort(),
      };
    });
}

function extractStatus(markdown, fallback) {
  if (!markdown) return fallback;
  const explicit = markdown.match(/^Status:\s*(.+)$/mi)?.[1]?.trim();
  if (explicit) return explicit;
  return /\bPASS\b/i.test(markdown) ? 'PASS' : fallback;
}

function renderLearningReport({ articleId, qaStatus, draftStatus, signals, eligibleRuleKeys, recordedAt }) {
  const signalLines = signals.length
    ? signals.map((signal) => `- **${signal.rule_key}**（${signal.kind} / ${signal.direction}）：${signal.summary}`).join('\n')
    : '- 本篇没有记录新的长期规则信号。';
  const eligibility = eligibleRuleKeys.length ? eligibleRuleKeys.join('、') : '无';
  return `# 交付复盘\n\n- 文章：${articleId}\n- 记录时间：${recordedAt}\n- QA 状态：${qaStatus}\n- 草稿状态：${draftStatus}\n\n## 本篇信号\n\n${signalLines}\n\n## 可生成优化提案的规则\n\n${eligibility}\n\n自动记录不等于自动修改。没有用户对具体提案的明确批准，不得修改 Skill。\n`;
}

export function resolveLearningStateDir({ articleDir, stateDir, env = process.env }) {
  return resolve(stateDir || env.XPC_WECHAT_LEARNING_STATE_DIR || join(dirname(resolve(articleDir)), '_xpc-wechat-state'));
}

export async function recordLearning({
  articleDir,
  stateDir,
  signals = [],
  clock = () => new Date(),
  idFactory = () => `E-${Date.now()}-${randomUUID().slice(0, 8)}`,
}) {
  const root = resolve(articleDir);
  const resolvedStateDir = resolveLearningStateDir({ articleDir: root, stateDir });
  const articleId = basename(root);
  const normalizedSignals = signals.map((signal) => validateSignal(signal));
  const defaultEvidence = await existingEvidenceFiles(root);
  const recordedAt = clock().toISOString();
  const events = [];

  for (let index = 0; index < normalizedSignals.length; index += 1) {
    const signal = normalizedSignals[index];
    const evidenceFiles = signal.evidence_files.length ? signal.evidence_files : defaultEvidence;
    for (const relativePath of evidenceFiles) {
      await access(join(root, assertSafeRelativePath(relativePath)));
    }
    const event = {
      schema_version: 1,
      event_id: idFactory({ articleId, index, signal }),
      article_id: articleId,
      recorded_at: recordedAt,
      kind: signal.kind,
      rule_key: signal.rule_key,
      summary: signal.summary,
      scope: signal.scope,
      direction: signal.direction,
      evidence_files: evidenceFiles,
    };
    await appendJsonLine(join(resolvedStateDir, 'feedback.jsonl'), event);
    events.push(event);
  }

  const allEvents = await readJsonLines(join(resolvedStateDir, 'feedback.jsonl'));
  const eligibleRuleKeys = eligibleGroups(allEvents).filter((group) => group.eligible).map((group) => group.rule_key);
  const qaReport = await readFile(join(root, 'qa-report.md'), 'utf8').catch(() => '');
  const draft = await readJsonIfExists(join(root, 'wechat-draft.json'));
  const reportPath = join(root, 'learning-report.md');
  await writeTextAtomic(reportPath, renderLearningReport({
    articleId,
    qaStatus: extractStatus(qaReport, qaReport ? 'RECORDED' : 'NOT_FOUND'),
    draftStatus: draft?.status ?? 'not_requested',
    signals: normalizedSignals,
    eligibleRuleKeys,
    recordedAt,
  }));

  return {
    report: reportPath,
    state_dir: resolvedStateDir,
    events_recorded: events.length,
    event_ids: events.map((event) => event.event_id),
    eligible_rule_keys: eligibleRuleKeys,
  };
}

const PROPOSAL_TEXT_FIELDS = [
  'problem',
  'scope',
  'patch_summary',
  'patch_preview',
  'risk',
  'rollback',
];

export function validateProposal(proposal, events) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    throw new Error('Improvement proposal must be an object');
  }
  if (proposal.schema_version !== 1) throw new Error('Proposal schema_version must be 1');
  if (!/^P-[A-Z0-9][A-Z0-9-]*$/i.test(proposal.proposal_id || '')) {
    throw new Error(`Invalid proposal_id: ${proposal.proposal_id || '(empty)'}`);
  }
  if (proposal.status !== 'proposed') throw new Error('New proposal status must be proposed');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(proposal.rule_key || '')) {
    throw new Error(`Invalid proposal rule_key: ${proposal.rule_key || '(empty)'}`);
  }
  for (const field of PROPOSAL_TEXT_FIELDS) {
    const value = proposal[field]?.trim();
    if (!value) throw new Error(`Proposal requires ${field}`);
    if (containsCredentialValue(value)) throw new Error(`Proposal ${field} contains a credential value`);
  }
  if (!Array.isArray(proposal.evidence_event_ids) || proposal.evidence_event_ids.length === 0) {
    throw new Error('Proposal requires evidence_event_ids');
  }
  if (new Set(proposal.evidence_event_ids).size !== proposal.evidence_event_ids.length) {
    throw new Error('Proposal evidence_event_ids must be unique');
  }
  const eventMap = new Map(events.map((event) => [event.event_id, event]));
  const evidence = proposal.evidence_event_ids.map((eventId) => {
    const event = eventMap.get(eventId);
    if (!event) throw new Error(`Proposal evidence event not found: ${eventId}`);
    return event;
  });
  if (evidence.some((event) => event.rule_key !== proposal.rule_key)) {
    throw new Error('Proposal evidence must match rule_key');
  }
  const evidenceGroup = eligibleGroups(evidence).find((group) => group.rule_key === proposal.rule_key);
  if (!evidenceGroup?.eligible) throw new Error(`Proposal evidence is not eligible for ${proposal.rule_key}`);
  if (evidenceGroup.conflict) throw new Error(`Proposal evidence conflicts for ${proposal.rule_key}`);

  if (!Array.isArray(proposal.affected_files) || proposal.affected_files.length === 0) {
    throw new Error('Proposal requires affected_files');
  }
  const affectedFiles = proposal.affected_files.map((file) => assertSafeRelativePath(file));
  if (new Set(affectedFiles).size !== affectedFiles.length) {
    throw new Error('Proposal affected_files must be unique');
  }
  if (
    !Array.isArray(proposal.new_eval_ids)
    || proposal.new_eval_ids.length === 0
    || proposal.new_eval_ids.some((value) => !Number.isInteger(value) || value <= 0)
  ) {
    throw new Error('Proposal requires positive integer new_eval_ids');
  }
  if (new Set(proposal.new_eval_ids).size !== proposal.new_eval_ids.length) {
    throw new Error('Proposal new_eval_ids must be unique');
  }
  return proposal;
}

function renderProposalMarkdown(proposal, events) {
  const eventMap = new Map(events.map((event) => [event.event_id, event]));
  const evidence = proposal.evidence_event_ids
    .map((eventId) => {
      const event = eventMap.get(eventId);
      return `- ${eventId} / ${event.article_id} / ${event.kind}：${event.summary}`;
    })
    .join('\n');
  const affected = proposal.affected_files.map((file) => `- \`${file}\``).join('\n');
  const evals = proposal.new_eval_ids.map((evalId) => `- Eval ${evalId}`).join('\n');
  return `# 优化提案 ${proposal.proposal_id}\n\n- 状态：${proposal.status}\n- 规则键：${proposal.rule_key}\n- 适用范围：${proposal.scope}\n\n## 问题\n\n${proposal.problem}\n\n## 证据\n\n${evidence}\n\n## 影响文件\n\n${affected}\n\n## 修改摘要\n\n${proposal.patch_summary}\n\n## 补丁预览\n\n${proposal.patch_preview}\n\n## 风险\n\n${proposal.risk}\n\n## 回滚方式\n\n${proposal.rollback}\n\n## 新增评测\n\n${evals}\n\n该提案尚未获批，不得修改 Skill。\n`;
}

async function claimedEvalIds(proposalsDir) {
  const names = await readdir(proposalsDir).catch((error) => {
    if (error?.code === 'ENOENT') return [];
    throw error;
  });
  const claimed = new Set();
  for (const name of names.filter((value) => value.endsWith('.json'))) {
    const candidate = await readJsonIfExists(join(proposalsDir, name));
    if (!candidate || ['rejected', 'rolled_back'].includes(candidate.status)) continue;
    for (const evalId of candidate.new_eval_ids ?? []) claimed.add(evalId);
  }
  return claimed;
}

export async function writeProposal({ stateDir, proposal, events }) {
  validateProposal(proposal, events);
  const root = resolve(stateDir);
  const proposalsDir = join(root, 'proposals');
  const jsonPath = join(proposalsDir, `${proposal.proposal_id}.json`);
  const markdownPath = join(proposalsDir, `${proposal.proposal_id}.md`);
  if (await readJsonIfExists(jsonPath)) {
    throw new Error(`Proposal already exists: ${proposal.proposal_id}`);
  }
  const claimed = await claimedEvalIds(proposalsDir);
  const conflicts = proposal.new_eval_ids.filter((evalId) => claimed.has(evalId));
  if (conflicts.length) throw new Error(`Proposal eval IDs already claimed: ${conflicts.join(', ')}`);

  await writeTextAtomic(markdownPath, renderProposalMarkdown(proposal, events));
  await writeJsonAtomic(jsonPath, proposal);
  return { json: jsonPath, markdown: markdownPath, status: proposal.status };
}

const DECISIONS = new Set(['approved', 'rejected', 'accepted', 'rolled_back']);
const DECISION_SOURCES = new Set(['user', 'validator']);

export async function recordDecision({
  stateDir,
  proposalId,
  decision,
  source,
  evidence = '',
  clock = () => new Date(),
}) {
  if (!/^P-[A-Z0-9][A-Z0-9-]*$/i.test(proposalId || '')) {
    throw new Error(`Invalid proposal_id: ${proposalId || '(empty)'}`);
  }
  if (!DECISIONS.has(decision)) throw new Error(`Invalid improvement decision: ${decision}`);
  if (!DECISION_SOURCES.has(source)) throw new Error(`Invalid improvement decision source: ${source}`);
  if (['approved', 'rejected'].includes(decision) && source !== 'user') {
    throw new Error(`${decision} decisions must come from the user`);
  }
  if (['accepted', 'rolled_back'].includes(decision) && source !== 'validator') {
    throw new Error(`${decision} decisions must come from the validator`);
  }
  if (['approved', 'rejected'].includes(decision) && !String(evidence).trim()) {
    throw new Error(`${decision} decisions require user evidence`);
  }
  const record = {
    schema_version: 1,
    proposal_id: proposalId,
    decision,
    source,
    recorded_at: clock().toISOString(),
    evidence: String(redact(evidence)).slice(0, 500),
  };
  await appendJsonLine(join(resolve(stateDir), 'decisions.jsonl'), record);
  return record;
}

export async function latestDecision(stateDir, proposalId) {
  const decisions = await readJsonLines(join(resolve(stateDir), 'decisions.jsonl'));
  return decisions.filter((item) => item.proposal_id === proposalId).at(-1) ?? null;
}

async function copyFileAtomic(source, destination) {
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}-${Date.now()}`;
  try {
    await copyFile(source, temporary);
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function updateProposalStatus(stateDir, proposalId, status, clock = () => new Date()) {
  const proposalPath = join(resolve(stateDir), 'proposals', `${proposalId}.json`);
  const proposal = await readJsonIfExists(proposalPath);
  if (!proposal) throw new Error(`Proposal file not found: ${proposalId}`);
  const next = { ...proposal, status, updated_at: clock().toISOString() };
  await writeJsonAtomic(proposalPath, next);
  return next;
}

export async function snapshotProposal({
  proposal,
  stateDir,
  skillDir,
  clock = () => new Date(),
}) {
  const decision = await latestDecision(stateDir, proposal.proposal_id);
  if (decision?.decision !== 'approved' || decision.source !== 'user') {
    throw new Error(`Proposal ${proposal.proposal_id} requires an approved decision from the user`);
  }
  const stateRoot = resolve(stateDir);
  const skillRoot = resolve(skillDir);
  if (stateRoot === skillRoot || stateRoot.startsWith(`${skillRoot}/`)) {
    throw new Error('Improvement state and snapshots must be stored outside the Skill directory');
  }
  const persistedProposal = await readJsonIfExists(join(stateRoot, 'proposals', `${proposal.proposal_id}.json`));
  if (!persistedProposal) throw new Error(`Proposal file not found: ${proposal.proposal_id}`);
  if (JSON.stringify(persistedProposal) !== JSON.stringify(proposal)) {
    throw new Error(`Proposal content drifted after approval: ${proposal.proposal_id}`);
  }
  const snapshotRoot = join(stateRoot, 'snapshots', proposal.proposal_id);
  const manifestPath = join(snapshotRoot, 'manifest.json');
  if (await readJsonIfExists(manifestPath)) {
    throw new Error(`Snapshot already exists: ${proposal.proposal_id}`);
  }

  const files = [];
  for (const value of proposal.affected_files) {
    const relativePath = assertSafeRelativePath(value);
    const source = join(skillRoot, relativePath);
    const info = await stat(source);
    if (!info.isFile()) throw new Error(`Affected path is not a file: ${relativePath}`);
    const destination = join(snapshotRoot, 'files', relativePath);
    await copyFileAtomic(source, destination);
    files.push({ relative_path: relativePath, sha256: await hashFile(source) });
  }

  const manifest = {
    schema_version: 1,
    proposal_id: proposal.proposal_id,
    created_at: clock().toISOString(),
    files,
  };
  await writeJsonAtomic(manifestPath, manifest);
  await writeJsonAtomic(join(snapshotRoot, 'proposal.json'), proposal);
  return { snapshot_dir: snapshotRoot, manifest: manifestPath, files };
}

export async function rollbackProposal({
  proposal,
  stateDir,
  skillDir,
  evidence = 'Validation failed; restored approved snapshot.',
  clock = () => new Date(),
}) {
  const stateRoot = resolve(stateDir);
  const skillRoot = resolve(skillDir);
  const snapshotRoot = join(stateRoot, 'snapshots', proposal.proposal_id);
  const manifest = await readJsonIfExists(join(snapshotRoot, 'manifest.json'));
  if (!manifest) throw new Error(`Snapshot not found: ${proposal.proposal_id}`);

  for (const file of manifest.files) {
    const relativePath = assertSafeRelativePath(file.relative_path);
    const snapshotFile = join(snapshotRoot, 'files', relativePath);
    const destination = join(skillRoot, relativePath);
    if (await hashFile(snapshotFile) !== file.sha256) {
      throw new Error(`Snapshot hash mismatch: ${relativePath}`);
    }
    await copyFileAtomic(snapshotFile, destination);
    if (await hashFile(destination) !== file.sha256) {
      throw new Error(`Rollback verification failed: ${relativePath}`);
    }
  }

  await updateProposalStatus(stateRoot, proposal.proposal_id, 'rolled_back', clock);
  await recordDecision({
    stateDir: stateRoot,
    proposalId: proposal.proposal_id,
    decision: 'rolled_back',
    source: 'validator',
    evidence,
    clock,
  });
  return { status: 'rolled_back', restored_files: manifest.files.map((file) => file.relative_path) };
}

function checkEvalResults(proposal, evalResults, requiredEvalIds) {
  if (evalResults?.proposal_id !== proposal.proposal_id || !Array.isArray(evalResults?.results)) {
    return { ok: false, output: 'Evaluator results do not match the proposal' };
  }
  const resultMap = new Map(evalResults.results.map((result) => [Number(result.eval_id), result]));
  const failures = [];
  for (const evalId of requiredEvalIds) {
    const result = resultMap.get(Number(evalId));
    if (!result?.passed || !String(result.evidence || '').trim()) failures.push(Number(evalId));
  }
  return failures.length
    ? { ok: false, output: `Missing or failing eval IDs: ${failures.join(', ')}` }
    : { ok: true, output: `Passed eval IDs: ${requiredEvalIds.join(', ')}` };
}

async function runValidator(name, runner) {
  try {
    const result = await runner();
    return { name, ok: result?.ok === true, output: String(redact(result?.output ?? '')).slice(0, 4000) };
  } catch (error) {
    return { name, ok: false, output: String(redact(error instanceof Error ? error.message : String(error))).slice(0, 4000) };
  }
}

export async function verifyOrRollback({
  proposal,
  stateDir,
  skillDir,
  runQuickValidate,
  runTests,
  runEvalSchema,
  evalResults,
  requiredEvalIds,
  clock = () => new Date(),
}) {
  const snapshot = await readJsonIfExists(join(resolve(stateDir), 'snapshots', proposal.proposal_id, 'manifest.json'));
  if (!snapshot) throw new Error(`Snapshot not found: ${proposal.proposal_id}`);
  const checks = [
    await runValidator('quick_validate', runQuickValidate),
    await runValidator('tests', runTests),
    await runValidator('eval_schema', runEvalSchema),
    { name: 'behavioral_evals', ...checkEvalResults(proposal, evalResults, requiredEvalIds) },
  ];
  const failed = checks.filter((check) => !check.ok);
  if (failed.length) {
    const rollback = await rollbackProposal({
      proposal,
      stateDir,
      skillDir,
      evidence: failed.map((check) => `${check.name}: ${check.output}`).join(' | '),
      clock,
    });
    const restoredValidation = await runValidator('restored_quick_validate', runQuickValidate);
    return { ...rollback, checks, restored_validation: restoredValidation };
  }

  const finalHashes = {};
  for (const relativePath of proposal.affected_files) {
    finalHashes[relativePath] = await hashFile(join(resolve(skillDir), assertSafeRelativePath(relativePath)));
  }
  await updateProposalStatus(stateDir, proposal.proposal_id, 'accepted', clock);
  await recordDecision({
    stateDir,
    proposalId: proposal.proposal_id,
    decision: 'accepted',
    source: 'validator',
    evidence: 'All validators and behavioral evaluations passed.',
    clock,
  });
  return { status: 'accepted', checks, final_hashes: finalHashes };
}
