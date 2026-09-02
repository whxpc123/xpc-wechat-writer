import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);

const requiredFields = [
  'Theme',
  'Theme-ID',
  'Primary',
  'Background',
  'Accent',
  'Secondary',
  'Rendering',
  'Geometry',
  'Density',
  'Typography',
  'Texture',
  'Avoid',
];

const openingOverviewTypes = new Set([
  'process-flow',
  'system-map',
  'architecture-map',
  'decision-map',
  'timeline-map',
  'action-journey',
  'comparison-path',
]);

export const BODY_IMAGE_PROFILE = 'knowledge-card-2.0-adapted';

const portraitContamination = /(?:\b3\s*[:：]\s*4\b|750\s*[x×*]\s*1000|\bportrait(?:-only)?\b|3\s*比\s*4\s*竖版)/i;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scalarValue(markdown, key) {
  return markdown.match(new RegExp(`^${escapeRegex(key)}:\\s*(.+)$`, 'mi'))?.[1]?.trim() ?? '';
}

function repeatedValues(markdown, key) {
  return [...markdown.matchAll(new RegExp(`^${escapeRegex(key)}(?:-\\d+)?:\\s*(.+)$`, 'gmi'))]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function assertDiagramPath(value, extension, field, filename) {
  assert.ok(value, `${filename} 缺少 ${field}`);
  assert.match(value, new RegExp(`^imgs/[A-Za-z0-9][A-Za-z0-9._-]*\\.${extension}$`), `${filename} 的 ${field} 路径无效`);
  assert.equal(value.includes('..'), false, `${filename} 的 ${field} 不得包含 ..`);
  return value;
}

export function parseComplexFlowchartSpec(prompt, filename = 'prompt.md') {
  if (scalarValue(prompt, 'Diagram-Mode').toLowerCase() !== 'complex-flowchart') return null;

  const steps = repeatedValues(prompt, 'Step');
  const decisions = repeatedValues(prompt, 'Decision');
  const branches = repeatedValues(prompt, 'Branch');
  const loops = repeatedValues(prompt, 'Loop');
  const requiredLabels = repeatedValues(prompt, 'Required-Label');
  const legends = repeatedValues(prompt, 'Legend');
  const mobileReadability = scalarValue(prompt, 'Mobile-Readability');
  const sourceSvg = assertDiagramPath(scalarValue(prompt, 'Source-SVG'), 'svg', 'Source-SVG', filename);
  const outputPng = assertDiagramPath(scalarValue(prompt, 'Output-PNG'), 'png', 'Output-PNG', filename);
  assert.equal(sourceSvg.slice(0, -4), outputPng.slice(0, -4), `${filename} 的 Source-SVG 与 Output-PNG 必须同名`);

  assert.ok(steps.length >= 8, `${filename} 的 complex-flowchart 至少需要 8 个 Step`);
  assert.ok(decisions.length >= 1, `${filename} 的 complex-flowchart 至少需要 1 个 Decision`);
  assert.ok(branches.length >= 2, `${filename} 的 complex-flowchart 至少需要 2 个 Branch`);
  assert.ok(loops.length >= 1, `${filename} 的 complex-flowchart 至少需要 1 个 Loop`);
  assert.ok(legends.length >= 1, `${filename} 的 complex-flowchart 至少需要 1 个 Legend`);
  assert.ok(requiredLabels.length >= 8, `${filename} 的 complex-flowchart 至少需要 8 个 Required-Label`);
  assert.ok(mobileReadability, `${filename} 的 complex-flowchart 缺少 Mobile-Readability`);
  assert.equal(new Set(requiredLabels).size, requiredLabels.length, `${filename} 的 Required-Label 不得重复`);

  return {
    promptFile: filename,
    sourceSvg,
    outputPng,
    steps,
    decisions,
    branches,
    loops,
    requiredLabels,
    legends,
    mobileReadability,
  };
}

export function parseOpeningOverviewSpec(prompt, filename = 'prompt.md') {
  const role = scalarValue(prompt, 'Overview-Role').toLowerCase();
  if (!role) return null;
  assert.equal(role, 'opening-overview', `${filename} 的 Overview-Role 只能是 opening-overview`);

  const type = scalarValue(prompt, 'Overview-Type').toLowerCase();
  const purpose = scalarValue(prompt, 'Overview-Purpose');
  const placement = scalarValue(prompt, 'Overview-Placement').toLowerCase();
  const nodes = repeatedValues(prompt, 'Overview-Node');
  const outputPng = assertDiagramPath(scalarValue(prompt, 'Output-PNG'), 'png', 'Output-PNG', filename);
  const diagramMode = scalarValue(prompt, 'Diagram-Mode').toLowerCase();

  assert.ok(openingOverviewTypes.has(type), `${filename} 的 Overview-Type 无效`);
  assert.ok(purpose, `${filename} 缺少 Overview-Purpose`);
  assert.equal(placement, 'after-opening-before-first-section', `${filename} 的 Overview-Placement 无效`);
  assert.ok(nodes.length >= 3, `${filename} 的 opening-overview 至少需要 3 个 Overview-Node`);
  assert.equal(new Set(nodes).size, nodes.length, `${filename} 的 Overview-Node 不得重复`);
  if (nodes.length > 7) {
    assert.equal(diagramMode, 'complex-flowchart', `${filename} 超过 7 个 Overview-Node 时必须使用 complex-flowchart`);
  }

  return {
    promptFile: filename,
    role,
    type,
    purpose,
    placement,
    nodes,
    outputPng,
    diagramMode: diagramMode || 'standard-image',
  };
}

export function parseBodyImageProfile(prompt, filename = 'prompt.md') {
  const profile = scalarValue(prompt, 'Body-Image-Profile').toLowerCase();
  if (!profile) return null;
  assert.equal(profile, BODY_IMAGE_PROFILE, `${filename} 的 Body-Image-Profile 无效`);
  assert.equal(portraitContamination.test(prompt), false, `${filename} 包含 3:4、750×1000 或竖版画幅污染`);

  const imageRole = scalarValue(prompt, 'Image-Role').toLowerCase();
  const outputPng = assertDiagramPath(scalarValue(prompt, 'Output-PNG'), 'png', 'Output-PNG', filename);
  const informationQuestion = scalarValue(prompt, 'Information-Question');
  const layoutFamily = scalarValue(prompt, 'Layout-Family');
  const paletteBalance = scalarValue(prompt, 'Palette-Balance');
  const whitespaceStrategy = scalarValue(prompt, 'Whitespace-Strategy');
  const depthTreatment = scalarValue(prompt, 'Depth-Treatment');
  const readingFlow = scalarValue(prompt, 'Reading-Flow');
  const aspectLock = scalarValue(prompt, 'Aspect-Lock').toLowerCase();
  const canvas = scalarValue(prompt, 'Canvas').toLowerCase().replace(/[×*]/g, 'x').replace(/\s+/g, '');
  const aspect = scalarValue(prompt, 'ASPECT');
  const labels = repeatedValues(prompt, 'Label');
  const complex = scalarValue(prompt, 'Diagram-Mode').toLowerCase() === 'complex-flowchart';

  assert.equal(imageRole, 'body', `${filename} 的 Image-Role 必须为 body`);
  assert.ok(informationQuestion, `${filename} 缺少 Information-Question`);
  assert.ok(layoutFamily, `${filename} 缺少 Layout-Family`);
  assert.match(paletteBalance, /60\s*[-–—]\s*30\s*[-–—]\s*10/, `${filename} 的 Palette-Balance 必须声明 60-30-10`);
  assert.ok(whitespaceStrategy, `${filename} 缺少 Whitespace-Strategy`);
  assert.ok(depthTreatment, `${filename} 缺少 Depth-Treatment`);
  assert.ok(readingFlow, `${filename} 缺少 Reading-Flow`);
  assert.ok(aspect, `${filename} 缺少 ASPECT`);

  if (complex) {
    assert.equal(aspectLock, 'declared-spec', `${filename} 的 complex-flowchart 必须使用 Aspect-Lock: declared-spec`);
    assert.equal(canvas, 'adaptive-from-svg', `${filename} 的 complex-flowchart 必须使用 Canvas: adaptive-from-svg`);
  } else {
    assert.equal(aspectLock, '16:9', `${filename} 的普通正文图必须使用 Aspect-Lock: 16:9`);
    assert.equal(canvas, '1600x900', `${filename} 的普通正文图必须使用 Canvas: 1600x900`);
    assert.match(aspect, /16\s*[:：]\s*9/, `${filename} 的普通正文图 ASPECT 必须为 16:9`);
    assert.ok(labels.length >= 3 && labels.length <= 8, `${filename} 的普通正文图需要 3 至 8 个 Label`);
    for (const label of labels) {
      assert.match(label, /`[^`]+`/, `${filename} 的 Label 文字必须用反引号锁定`);
      assert.match(label, /\bContainer\s*:/i, `${filename} 的 Label 缺少 Container 绑定`);
      assert.match(label, /\bIllustration\s*:/i, `${filename} 的 Label 缺少 Illustration 绑定`);
    }
  }

  return {
    promptFile: filename,
    profile,
    imageRole,
    outputPng,
    informationQuestion,
    layoutFamily,
    paletteBalance,
    whitespaceStrategy,
    depthTreatment,
    readingFlow,
    aspectLock,
    canvas,
    aspect,
    labels,
    complex,
  };
}

export async function verifyVisualPrompts(articleDirectory) {
  const root = resolve(articleDirectory ?? process.cwd());
  const visualSystemPath = join(root, 'imgs', 'visual-system.md');
  const promptsDir = join(root, 'imgs', 'prompts');
  const visualSystem = await readFile(visualSystemPath, 'utf8');
  const productionSpec = await readFile(join(root, 'spec.md'), 'utf8').catch(() => '');
  const declaredBodyImageProfile = scalarValue(productionSpec, 'Body-Image-Profile').toLowerCase();
  const bodyImageProfile = declaredBodyImageProfile || 'legacy';
  assert.ok(
    bodyImageProfile === 'legacy' || bodyImageProfile === BODY_IMAGE_PROFILE,
    `spec.md 的 Body-Image-Profile 无效 ${bodyImageProfile}`,
  );

  assert.match(visualSystem, /^# XPC_THEME_VISUAL_SYSTEM$/m, 'visual-system.md 缺少主题视觉系统标记');

  const fields = Object.fromEntries(
    requiredFields.map((key) => {
      const value = visualSystem.match(new RegExp(`^${escapeRegex(key)}:\\s*(.+)$`, 'm'))?.[1]?.trim();
      assert.ok(value, `visual-system.md 缺少 ${key}`);
      return [key, value];
    }),
  );

  for (const key of ['Primary', 'Background', 'Accent', 'Secondary']) {
    assert.match(fields[key], /^#[0-9A-F]{6}$/i, `${key} 不是六位十六进制颜色`);
  }

  const promptFiles = (await readdir(promptsDir))
    .filter((name) => name.endsWith('.md'))
    .sort();
  assert.ok(promptFiles.length >= 4, `图片提示词过少 ${promptFiles.length}，至少需要封面加 3 张正文图`);

  const diagramSpecs = [];
  const overviewSpecs = [];
  const bodyImageSpecs = [];
  for (const filename of promptFiles) {
    const prompt = await readFile(join(promptsDir, filename), 'utf8');
    assert.match(prompt, /^# XPC_THEME_VISUAL_SYSTEM$/m, `${filename} 缺少主题视觉系统标记`);
    for (const [key, value] of Object.entries(fields)) {
      assert.ok(prompt.toLowerCase().includes(`${key}: ${value}`.toLowerCase()), `${filename} 未继承 ${key}`);
    }
    assert.match(prompt, /do NOT display color names, hex codes, or palette labels/i, `${filename} 缺少防止色值渲染成文字的约束`);
    assert.match(prompt, /ASPECT|Aspect ratio/i, `${filename} 缺少画幅要求`);
    const diagramSpec = parseComplexFlowchartSpec(prompt, filename);
    const overviewSpec = parseOpeningOverviewSpec(prompt, filename);
    const bodyImageSpec = parseBodyImageProfile(prompt, filename);
    const isCover = /^00-cover(?:-|\.)/i.test(filename);
    if (bodyImageProfile === BODY_IMAGE_PROFILE) {
      if (isCover) assert.equal(bodyImageSpec, null, `${filename} 是封面，不得使用正文图片 profile`);
      else assert.ok(bodyImageSpec, `${filename} 缺少 Body-Image-Profile: ${BODY_IMAGE_PROFILE}`);
    }
    if (diagramSpec && overviewSpec) {
      assert.equal(diagramSpec.outputPng, overviewSpec.outputPng, `${filename} 的复杂图与总览图 Output-PNG 不一致`);
    }
    if (diagramSpec && bodyImageSpec) {
      assert.equal(diagramSpec.outputPng, bodyImageSpec.outputPng, `${filename} 的复杂图与正文 profile Output-PNG 不一致`);
    }
    if (diagramSpec) diagramSpecs.push(diagramSpec);
    if (overviewSpec) overviewSpecs.push(overviewSpec);
    if (bodyImageSpec) bodyImageSpecs.push(bodyImageSpec);
  }

  const sourcePaths = diagramSpecs.map((item) => item.sourceSvg);
  const outputPaths = diagramSpecs.map((item) => item.outputPng);
  assert.equal(new Set(sourcePaths).size, sourcePaths.length, 'complex-flowchart 的 Source-SVG 不得重复');
  assert.equal(new Set(outputPaths).size, outputPaths.length, 'complex-flowchart 的 Output-PNG 不得重复');
  assert.ok(overviewSpecs.length <= 1, '每篇文章最多只能有一个 opening-overview 规格');
  const bodyOutputPaths = bodyImageSpecs.map((item) => item.outputPng);
  assert.equal(new Set(bodyOutputPaths).size, bodyOutputPaths.length, '正文图片 profile 的 Output-PNG 不得重复');

  return {
    result: 'PASS',
    articleDirectory: root,
    theme: fields.Theme,
    themeId: fields['Theme-ID'],
    promptFiles,
    complexFlowcharts: diagramSpecs.length,
    openingOverviews: overviewSpecs.length,
    bodyImageProfile,
    bodyImageSpecs,
    diagramSpecs,
    overviewSpecs,
  };
}

if (resolve(process.argv[1] ?? '') === scriptPath) {
  try {
    console.log(JSON.stringify(await verifyVisualPrompts(process.argv[2]), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
