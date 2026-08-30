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

export async function verifyVisualPrompts(articleDirectory) {
  const root = resolve(articleDirectory ?? process.cwd());
  const visualSystemPath = join(root, 'imgs', 'visual-system.md');
  const promptsDir = join(root, 'imgs', 'prompts');
  const visualSystem = await readFile(visualSystemPath, 'utf8');

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
  for (const filename of promptFiles) {
    const prompt = await readFile(join(promptsDir, filename), 'utf8');
    assert.match(prompt, /^# XPC_THEME_VISUAL_SYSTEM$/m, `${filename} 缺少主题视觉系统标记`);
    for (const [key, value] of Object.entries(fields)) {
      assert.ok(prompt.toLowerCase().includes(`${key}: ${value}`.toLowerCase()), `${filename} 未继承 ${key}`);
    }
    assert.match(prompt, /do NOT display color names, hex codes, or palette labels/i, `${filename} 缺少防止色值渲染成文字的约束`);
    assert.match(prompt, /ASPECT|Aspect ratio/i, `${filename} 缺少画幅要求`);
    const diagramSpec = parseComplexFlowchartSpec(prompt, filename);
    if (diagramSpec) diagramSpecs.push(diagramSpec);
  }

  const sourcePaths = diagramSpecs.map((item) => item.sourceSvg);
  const outputPaths = diagramSpecs.map((item) => item.outputPng);
  assert.equal(new Set(sourcePaths).size, sourcePaths.length, 'complex-flowchart 的 Source-SVG 不得重复');
  assert.equal(new Set(outputPaths).size, outputPaths.length, 'complex-flowchart 的 Output-PNG 不得重复');

  return {
    result: 'PASS',
    articleDirectory: root,
    theme: fields.Theme,
    themeId: fields['Theme-ID'],
    promptFiles,
    complexFlowcharts: diagramSpecs.length,
    diagramSpecs,
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
