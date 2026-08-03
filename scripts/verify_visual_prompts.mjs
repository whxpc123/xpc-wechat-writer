import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? process.cwd());
const visualSystemPath = join(root, 'imgs', 'visual-system.md');
const promptsDir = join(root, 'imgs', 'prompts');
const visualSystem = await readFile(visualSystemPath, 'utf8');

assert.match(visualSystem, /^# XPC_THEME_VISUAL_SYSTEM$/m, 'visual-system.md 缺少主题视觉系统标记');

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
  'Avoid'
];

const fields = Object.fromEntries(
  requiredFields.map((key) => {
    const value = visualSystem.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
    assert.ok(value, `visual-system.md 缺少 ${key}`);
    return [key, value];
  })
);

for (const key of ['Primary', 'Background', 'Accent', 'Secondary']) {
  assert.match(fields[key], /^#[0-9A-F]{6}$/i, `${key} 不是六位十六进制颜色`);
}

const promptFiles = (await readdir(promptsDir))
  .filter((name) => name.endsWith('.md'))
  .sort();
assert.ok(promptFiles.length >= 4, `图片提示词过少 ${promptFiles.length}，至少需要封面加 3 张正文图`);

for (const filename of promptFiles) {
  const prompt = await readFile(join(promptsDir, filename), 'utf8');
  assert.match(prompt, /^# XPC_THEME_VISUAL_SYSTEM$/m, `${filename} 缺少主题视觉系统标记`);
  for (const [key, value] of Object.entries(fields)) {
    assert.ok(prompt.toLowerCase().includes(`${key}: ${value}`.toLowerCase()), `${filename} 未继承 ${key}`);
  }
  assert.match(prompt, /do NOT display color names, hex codes, or palette labels/i, `${filename} 缺少防止色值渲染成文字的约束`);
  assert.match(prompt, /ASPECT|Aspect ratio/i, `${filename} 缺少画幅要求`);
}

console.log(JSON.stringify({
  result: 'PASS',
  articleDirectory: root,
  theme: fields.Theme,
  themeId: fields['Theme-ID'],
  promptFiles
}, null, 2));
