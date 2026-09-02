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
import {
  validateBodyImageProfileDelivery,
  validateComplexFlowchartSvg,
  validateOpeningOverviewPlacement,
} from '../scripts/verify_delivery.mjs';
import {
  parseBodyImageProfile,
  parseComplexFlowchartSpec,
  parseOpeningOverviewSpec,
} from '../scripts/verify_visual_prompts.mjs';

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

function flowchartPrompt({ includeSecondBranch = true } = {}) {
  return `Diagram-Mode: complex-flowchart
Source-SVG: imgs/04-agent-loop.svg
Output-PNG: imgs/04-agent-loop.png
ASPECT: 8:5
Mobile-Readability: 点击放大，过密时拆图
Step-1: 用户提出目标
Step-2: 收集当前信息
Step-3: 模型判断下一步
Step-4: 提出工具调用请求
Step-5: 权限检查与审批
Step-6: 执行真实动作
Step-7: 返回执行结果
Step-8: 模型接收结果并思考
Decision-1: 是否需要人工确认
Branch-1: 是到人工确认
${includeSecondBranch ? 'Branch-2: 否到继续执行' : ''}
Loop-1: 结果返回模型
Legend-1: 主流程与循环
Required-Label-1: 用户提出目标
Required-Label-2: 收集当前信息
Required-Label-3: 模型判断下一步
Required-Label-4: 提出工具调用请求
Required-Label-5: 权限检查与审批
Required-Label-6: 执行真实动作
Required-Label-7: 返回执行结果
Required-Label-8: 模型接收结果并思考
`;
}

function overviewPrompt({ type = 'system-map', nodes = 4 } = {}) {
  const nodeLines = Array.from({ length: nodes }, (_, index) => `Overview-Node-${index + 1}: 主干节点${index + 1}`).join('\n');
  return `Overview-Role: opening-overview
Overview-Type: ${type}
Overview-Purpose: 帮助读者先理解全文主干
Overview-Placement: after-opening-before-first-section
Output-PNG: imgs/01-opening-overview.png
${nodeLines}
ASPECT: 16:9
`;
}

function bodyImagePrompt({
  outputPng = 'imgs/02-detail.png',
  aspectLock = '16:9',
  canvas = '1600x900',
  aspect = '16:9 landscape body image',
  complex = false,
  extra = '',
} = {}) {
  const labels = complex
    ? ''
    : `Label-1: \`模型判断\` | Container: 主题卡片 | Illustration: 大脑线稿
Label-2: \`工具执行\` | Container: 操作卡片 | Illustration: 扳手图标
Label-3: \`结果反馈\` | Container: 回执卡片 | Illustration: 回环箭头`;
  return `Body-Image-Profile: knowledge-card-2.0-adapted
Image-Role: body
Output-PNG: ${outputPng}
Information-Question: 读者如何理解信息从判断到执行再到反馈
Layout-Family: process-horizontal
Palette-Balance: 60-30-10 using selected theme colors
Whitespace-Strategy: 保留充足呼吸区，避免边缘拥挤
Depth-Treatment: theme-compatible layering, no forced shadow
Reading-Flow: 从左到右，用编号和箭头连接主节点
Aspect-Lock: ${aspectLock}
Canvas: ${canvas}
ASPECT: ${aspect}
${labels}
${complex ? flowchartPrompt() : ''}
${extra}`;
}

test('body image profile preserves landscape canvas and rejects portrait contamination', () => {
  const ordinary = parseBodyImageProfile(bodyImagePrompt(), '02-detail.md');
  assert.equal(ordinary.profile, 'knowledge-card-2.0-adapted');
  assert.equal(ordinary.aspectLock, '16:9');
  assert.equal(ordinary.canvas, '1600x900');
  assert.equal(ordinary.labels.length, 3);
  assert.equal(ordinary.complex, false);

  assert.throws(
    () => parseBodyImageProfile(bodyImagePrompt({ extra: 'Source-Ratio: 3:4 portrait' }), 'portrait.md'),
    /3:4|竖版|portrait/i,
  );
  assert.throws(
    () => parseBodyImageProfile(bodyImagePrompt({ extra: 'Source-Canvas: 750×1000' }), 'portrait-size.md'),
    /750.*1000|竖版|portrait/i,
  );
  assert.throws(
    () => parseBodyImageProfile(bodyImagePrompt().replace(/^Reading-Flow:.*\n/m, ''), 'missing-flow.md'),
    /Reading-Flow/,
  );
  assert.throws(
    () => parseBodyImageProfile(bodyImagePrompt({ outputPng: 'imgs/../outside.png' }), 'unsafe-output.md'),
    /Output-PNG.*路径无效|不得包含/,
  );

  const complex = parseBodyImageProfile(bodyImagePrompt({
    outputPng: 'imgs/04-agent-loop.png',
    aspectLock: 'declared-spec',
    canvas: 'adaptive-from-svg',
    aspect: '8:5 wide technical workflow',
    complex: true,
  }), '04-agent-loop.md');
  assert.equal(complex.aspectLock, 'declared-spec');
  assert.equal(complex.canvas, 'adaptive-from-svg');
  assert.equal(complex.complex, true);
});

test('body image delivery keeps ordinary images at 1600x900 and preserves declared complex ratios', () => {
  const first = parseBodyImageProfile(bodyImagePrompt({ outputPng: 'imgs/01-opening-overview.png' }), '01-opening-overview.md');
  const second = parseBodyImageProfile(bodyImagePrompt({ outputPng: 'imgs/02-detail.png' }), '02-detail.md');
  const complex = parseBodyImageProfile(bodyImagePrompt({
    outputPng: 'imgs/04-agent-loop.png',
    aspectLock: 'declared-spec',
    canvas: 'adaptive-from-svg',
    aspect: '8:5 wide technical workflow',
    complex: true,
  }), '04-agent-loop.md');
  const bodyImageSpecs = [first, second, complex];
  const imageRefs = bodyImageSpecs.map((item) => item.outputPng);
  const dimensions = {
    'imgs/01-opening-overview.png': { width: 1600, height: 900 },
    'imgs/02-detail.png': { width: 1600, height: 900 },
    'imgs/04-agent-loop.png': { width: 3200, height: 2000 },
  };

  const valid = validateBodyImageProfileDelivery({
    profile: 'knowledge-card-2.0-adapted',
    bodyImageSpecs,
    imageRefs,
    dimensions,
  });
  assert.equal(valid.checkedOutputs.length, 3);
  assert.equal(valid.ordinaryOutputs.length, 2);
  assert.equal(valid.complexOutputs.length, 1);

  assert.throws(
    () => validateBodyImageProfileDelivery({
      profile: 'knowledge-card-2.0-adapted',
      bodyImageSpecs,
      imageRefs,
      dimensions: {
        ...dimensions,
        'imgs/02-detail.png': { width: 750, height: 1000 },
      },
    }),
    /1600.*900/,
  );
  assert.throws(
    () => validateBodyImageProfileDelivery({
      profile: 'knowledge-card-2.0-adapted',
      bodyImageSpecs,
      imageRefs: imageRefs.slice(0, -1),
      dimensions,
    }),
    /正文引用.*profile 输出|profile 输出.*正文引用/,
  );
  assert.equal(validateBodyImageProfileDelivery({
    profile: 'legacy',
    bodyImageSpecs: [],
    imageRefs: ['imgs/legacy.png'],
    dimensions: { 'imgs/legacy.png': { width: 1200, height: 800 } },
  }).profile, 'legacy');
});

test('complex flowchart spec and SVG validator accept precise diagrams and reject unsafe or incomplete ones', () => {
  const spec = parseComplexFlowchartSpec(flowchartPrompt(), '04-agent-loop.md');
  const labels = [
    '用户提出目标',
    '收集当前信息',
    '模型判断下一步',
    '提出工具调用请求',
    '权限检查与审批',
    '执行真实动作',
    '返回执行结果',
    '模型接收结果并思考',
  ];
  const stepGroups = labels
    .map((label) => `<g data-flow-role="step"><text>${label}</text></g>`)
    .join('');
  const validSvg = `<svg viewBox="0 0 1600 1000" xmlns="http://www.w3.org/2000/svg">${stepGroups}<g data-flow-role="decision"><text>是否需要人工确认</text></g><path data-flow-role="branch" d="M0 0L1 1"/><path data-flow-role="branch" d="M1 1L2 2"/><path data-flow-role="loop" d="M2 2L0 0"/><g data-flow-role="legend"><text>主流程与循环</text></g></svg>`;

  const result = validateComplexFlowchartSvg({
    svg: validSvg,
    spec,
    dimensions: { width: 3200, height: 2000 },
  });
  assert.equal(result.steps, 8);
  assert.equal(result.requiredLabels, 8);

  assert.throws(
    () => parseComplexFlowchartSpec(flowchartPrompt({ includeSecondBranch: false }), 'broken.md'),
    /至少需要 2 个 Branch/,
  );
  assert.throws(
    () => validateComplexFlowchartSvg({
      svg: validSvg.replace('模型接收结果并思考', '缺失的标签'),
      spec,
      dimensions: { width: 3200, height: 2000 },
    }),
    /缺少必需文字/,
  );
  assert.throws(
    () => validateComplexFlowchartSvg({
      svg: validSvg.replace('</svg>', '<image href="https://example.com/a.png"/></svg>'),
      spec,
      dimensions: { width: 3200, height: 2000 },
    }),
    /包含脚本、外链或本机路径/,
  );
});

test('opening overview supports multiple forms and enforces first-image placement with explicit opt-out', () => {
  const types = [
    'process-flow',
    'system-map',
    'architecture-map',
    'decision-map',
    'timeline-map',
    'action-journey',
    'comparison-path',
  ];
  for (const type of types) {
    assert.equal(parseOpeningOverviewSpec(overviewPrompt({ type }), `${type}.md`).type, type);
  }

  const overview = parseOpeningOverviewSpec(overviewPrompt(), '01-opening-overview.md');
  const body = `开场先呈现一个具体困境。核心判断是工具只有进入完整工作系统，才能把答案变成可以交付的结果。\n\n![全文总览](imgs/01-opening-overview.png)\n\n## 第一节\n\n正文内容。`;
  const valid = validateOpeningOverviewPlacement({
    body,
    imageRefs: ['imgs/01-opening-overview.png', 'imgs/02-detail.png'],
    overviewSpecs: [overview],
    status: 'required',
  });
  assert.equal(valid.overview, 'imgs/01-opening-overview.png');
  assert.equal(valid.type, 'system-map');

  assert.throws(
    () => parseOpeningOverviewSpec(overviewPrompt({ type: 'one-fixed-template' }), 'bad-type.md'),
    /Overview-Type 无效/,
  );
  assert.throws(
    () => parseOpeningOverviewSpec(overviewPrompt({ nodes: 8 }), 'too-many-nodes.md'),
    /必须使用 complex-flowchart/,
  );
  assert.throws(
    () => validateOpeningOverviewPlacement({
      body,
      imageRefs: ['imgs/00-other.png', 'imgs/01-opening-overview.png'],
      overviewSpecs: [overview],
      status: 'required',
    }),
    /必须是 article.md 的第一张正文图/,
  );
  assert.throws(
    () => validateOpeningOverviewPlacement({
      body: `开场。\n\n## 第一节\n\n![全文总览](imgs/01-opening-overview.png)`,
      imageRefs: ['imgs/01-opening-overview.png'],
      overviewSpecs: [overview],
      status: 'required',
    }),
    /必须位于第一节 H2 之前/,
  );
  assert.throws(
    () => validateOpeningOverviewPlacement({
      body: `${'文'.repeat(901)}\n\n![全文总览](imgs/01-opening-overview.png)`,
      imageRefs: ['imgs/01-opening-overview.png'],
      overviewSpecs: [overview],
      status: 'required',
    }),
    /出现过晚/,
  );
  assert.equal(validateOpeningOverviewPlacement({
    body: '正文。',
    imageRefs: [],
    overviewSpecs: [],
    status: 'omitted-by-user',
  }).required, false);
  assert.equal(validateOpeningOverviewPlacement({
    body: '旧文章正文。',
    imageRefs: [],
    overviewSpecs: [],
    status: 'legacy',
  }).status, 'legacy');
});

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
