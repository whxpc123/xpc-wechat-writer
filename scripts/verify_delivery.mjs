import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BODY_IMAGE_PROFILE, verifyVisualPrompts } from './verify_visual_prompts.mjs';

const scriptPath = fileURLToPath(import.meta.url);

function decodeXmlText(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function visibleSvgText(svg) {
  return decodeXmlText(svg.replace(/<[^>]+>/g, '')).replace(/\s+/g, '');
}

function countFlowRoles(svg, role) {
  const escaped = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...svg.matchAll(new RegExp(`data-flow-role=["']${escaped}["']`, 'gi'))].length;
}

export function validateComplexFlowchartSvg({ svg, spec, dimensions }) {
  assert.match(svg.trim(), /^<svg\b/i, `${spec.sourceSvg} 不是独立 SVG`);
  const openingTag = svg.match(/^\s*<svg\b[^>]*>/i)?.[0] ?? '';
  const viewBoxMatch = openingTag.match(/\bviewBox=["']\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  assert.ok(viewBoxMatch, `${spec.sourceSvg} 缺少有效 viewBox`);
  assert.ok(Number(viewBoxMatch[3]) > 0 && Number(viewBoxMatch[4]) > 0, `${spec.sourceSvg} 的 viewBox 尺寸必须为正数`);
  assert.equal(/\s(?:width|height)=["']/i.test(openingTag), false, `${spec.sourceSvg} 根节点不得固定 width 或 height`);

  const forbiddenSvg = [
    /<script\b/i,
    /<foreignObject\b/i,
    /\son[a-z]+\s*=/i,
    /(?:href|xlink:href)\s*=\s*["'](?!#)/i,
    /url\(\s*["']?(?:https?:|data:|file:|\/)/i,
    /@import\b/i,
    /(?:file:\/\/|\/(?:Users|home|tmp|var)\/|[A-Za-z]:\\\\)/i,
  ];
  assert.deepEqual(forbiddenSvg.filter((pattern) => pattern.test(svg)), [], `${spec.sourceSvg} 包含脚本、外链或本机路径`);

  assert.ok(dimensions.width >= 2400, `${spec.outputPng} 宽度不足 2400`);
  assert.ok(dimensions.height >= 1200, `${spec.outputPng} 高度不足 1200`);

  const visibleText = visibleSvgText(svg);
  const missingLabels = spec.requiredLabels.filter((label) => !visibleText.includes(label.replace(/\s+/g, '')));
  assert.deepEqual(missingLabels, [], `${spec.sourceSvg} 缺少必需文字 ${missingLabels.join('、')}`);

  assert.ok(countFlowRoles(svg, 'step') >= spec.steps.length, `${spec.sourceSvg} 的 step 结构标记不足`);
  assert.ok(countFlowRoles(svg, 'decision') >= spec.decisions.length, `${spec.sourceSvg} 的 decision 结构标记不足`);
  assert.ok(countFlowRoles(svg, 'branch') >= spec.branches.length, `${spec.sourceSvg} 的 branch 结构标记不足`);
  assert.ok(countFlowRoles(svg, 'loop') >= spec.loops.length, `${spec.sourceSvg} 的 loop 结构标记不足`);
  assert.ok(countFlowRoles(svg, 'legend') >= spec.legends.length, `${spec.sourceSvg} 的 legend 结构标记不足`);

  return {
    sourceSvg: spec.sourceSvg,
    outputPng: spec.outputPng,
    width: dimensions.width,
    height: dimensions.height,
    requiredLabels: spec.requiredLabels.length,
    steps: spec.steps.length,
  };
}

function visibleMarkdownLength(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>#-]/g, '')
    .replace(/\s+/g, '')
    .length;
}

export function validateOpeningOverviewPlacement({ body, imageRefs, overviewSpecs, status }) {
  const normalizedStatus = String(status || 'legacy').trim().toLowerCase();
  assert.ok(['legacy', 'required', 'omitted-by-user'].includes(normalizedStatus), `Opening-Overview 状态无效 ${normalizedStatus}`);

  if (normalizedStatus === 'legacy') {
    return { status: 'legacy', required: false, overview: null };
  }
  if (normalizedStatus === 'omitted-by-user') {
    assert.equal(overviewSpecs.length, 0, 'Opening-Overview 已标记 omitted-by-user，但仍存在总览图规格');
    return { status: normalizedStatus, required: false, overview: null };
  }

  assert.equal(overviewSpecs.length, 1, 'Opening-Overview 为 required 时必须恰好有一个总览图规格');
  const overview = overviewSpecs[0];
  assert.equal(imageRefs[0], overview.outputPng, `${overview.outputPng} 必须是 article.md 的第一张正文图`);

  const overviewPattern = new RegExp(`!\\[[^\\]]*\\]\\(${overview.outputPng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`);
  const overviewIndex = body.search(overviewPattern);
  assert.ok(overviewIndex >= 0, `${overview.outputPng} 未出现在正文中`);
  const firstSectionIndex = body.search(/^##\s+/m);
  assert.ok(firstSectionIndex < 0 || overviewIndex < firstSectionIndex, '开篇总览图必须位于第一节 H2 之前');

  const prefixCharacters = visibleMarkdownLength(body.slice(0, overviewIndex));
  assert.ok(prefixCharacters <= 900, `开篇总览图出现过晚，前置可见文字 ${prefixCharacters} 超过 900`);

  return {
    status: normalizedStatus,
    required: true,
    overview: overview.outputPng,
    type: overview.type,
    prefixCharacters,
  };
}

export function validateBodyImageProfileDelivery({ profile, bodyImageSpecs, imageRefs, dimensions }) {
  const normalizedProfile = String(profile || 'legacy').trim().toLowerCase();
  if (normalizedProfile === 'legacy') {
    return {
      profile: 'legacy',
      checkedOutputs: [],
      ordinaryOutputs: [],
      complexOutputs: [],
    };
  }
  assert.equal(normalizedProfile, BODY_IMAGE_PROFILE, `正文图片 profile 无效 ${normalizedProfile}`);

  const expectedOutputs = bodyImageSpecs.map((item) => item.outputPng).sort();
  const referencedOutputs = [...imageRefs].sort();
  assert.deepEqual(expectedOutputs, referencedOutputs, '正文引用与 profile 输出必须一一对应');

  const ordinaryOutputs = bodyImageSpecs.filter((item) => !item.complex).map((item) => item.outputPng);
  const complexOutputs = bodyImageSpecs.filter((item) => item.complex).map((item) => item.outputPng);
  for (const outputPng of ordinaryOutputs) {
    const size = dimensions[outputPng];
    assert.ok(size, `${outputPng} 缺少 PNG 尺寸`);
    assert.equal(size.width, 1600, `${outputPng} 普通正文图宽度必须为 1600，高度必须为 900`);
    assert.equal(size.height, 900, `${outputPng} 普通正文图宽度必须为 1600，高度必须为 900`);
  }

  return {
    profile: normalizedProfile,
    checkedOutputs: expectedOutputs,
    ordinaryOutputs,
    complexOutputs,
  };
}

export async function verifyDelivery(articleDirectory) {
  const root = resolve(articleDirectory ?? process.cwd());
  const markdown = await readFile(join(root, 'article.md'), 'utf8');
  const articleHtml = await readFile(join(root, 'article.html'), 'utf8');
  const publishHtml = await readFile(join(root, 'publish.html'), 'utf8');
  const wechatBodyHtml = await readFile(join(root, 'wechat-body.html'), 'utf8');

  assert.match(markdown, /^title:\s*.+$/m, 'article.md 缺少 title');
  assert.match(markdown, /^summary:\s*.+$/m, 'article.md 缺少 summary');

  const bodyStart = markdown.indexOf('---', 3) + 3;
  const body = markdown.slice(bodyStart);
  assert.ok(body.length >= 4000, `正文过短 ${body.length}`);
  assert.ok(body.length <= 10000, `正文异常过长 ${body.length}`);
  assert.equal(/作者[，,:：]\s*卡兹克|@virxact\.com|投稿或爆料/.test(body), false, '出现禁用身份尾部');

  const forbidden = [
    '说白了', '意味着什么', '这意味着', '本质上', '换句话说', '不可否认',
    '综上所述', '总的来说', '值得注意的是', '不难发现', '让我们来看看',
    '接下来让我们', '在当今', 'AI工具', '某个模型', '相关技术', '：', '——', '“', '”',
  ];
  const forbiddenHits = forbidden.filter((token) => body.includes(token));
  assert.deepEqual(forbiddenHits, [], `禁用内容 ${forbiddenHits.join(', ')}`);

  const imageRefs = [...markdown.matchAll(/!\[[^\]]*\]\((imgs\/[\w.-]+\.png)\)/g)].map((match) => match[1]);
  assert.ok(imageRefs.length >= 3 && imageRefs.length <= 7, `正文图片数量异常 ${imageRefs.length}`);

  const dimensions = {};
  for (const relativePath of ['imgs/cover.png', ...imageRefs]) {
    const path = join(root, relativePath);
    assert.ok((await stat(path)).size > 0, `${relativePath} 为空`);
    const buffer = await readFile(path);
    assert.equal(buffer.toString('hex', 0, 8), '89504e470d0a1a0a', `${relativePath} 不是 PNG`);
    dimensions[relativePath] = {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  const visualVerification = await verifyVisualPrompts(root);
  const bodyImageProfile = validateBodyImageProfileDelivery({
    profile: visualVerification.bodyImageProfile,
    bodyImageSpecs: visualVerification.bodyImageSpecs,
    imageRefs,
    dimensions,
  });
  const productionSpec = await readFile(join(root, 'spec.md'), 'utf8').catch(() => '');
  const overviewStatus = productionSpec.match(/^Opening-Overview:\s*(.+)$/mi)?.[1]?.trim() ?? 'legacy';
  const openingOverview = validateOpeningOverviewPlacement({
    body,
    imageRefs,
    overviewSpecs: visualVerification.overviewSpecs,
    status: overviewStatus,
  });
  const complexFlowcharts = [];
  for (const spec of visualVerification.diagramSpecs) {
    assert.ok(imageRefs.includes(spec.outputPng), `${spec.outputPng} 未被 article.md 引用`);
    const svgPath = join(root, spec.sourceSvg);
    assert.ok((await stat(svgPath)).size > 0, `${spec.sourceSvg} 为空`);
    const svg = await readFile(svgPath, 'utf8');
    complexFlowcharts.push(validateComplexFlowchartSvg({
      svg,
      spec,
      dimensions: dimensions[spec.outputPng],
    }));
  }

  const cover = dimensions['imgs/cover.png'];
  assert.ok(Math.abs((cover.width / cover.height) - 2.35) < 0.01, '封面不是 2.35 比 1');
  assert.equal([...wechatBodyHtml.matchAll(/<img /g)].length, imageRefs.length, '纯正文图片数不一致');
  assert.equal(wechatBodyHtml.includes('MDTOHTMLIMGPH'), false, '纯正文仍有图片占位符');
  assert.match(wechatBodyHtml.trim(), /^<section[\s>]/i, '纯正文不是根 section');
  assert.match(wechatBodyHtml.trim(), /<\/section>$/i, '纯正文没有以 section 结束');
  assert.ok([...wechatBodyHtml.matchAll(/<span\s+leaf=""/gi)].length > 0, '纯正文缺少 span leaf 包裹');

  const gzhForbidden = [
    /<style[\s>]/i, /<script[\s>]/i, /<\/?div[\s>]/i, /\sclass\s*=/i, /\sid\s*=/i,
    /position\s*:\s*(?:fixed|absolute|sticky)/i, /float\s*:/i, /@media/i, /@keyframes/i,
    /display\s*:\s*grid/i, /var\s*\(\s*--/i,
  ];
  const gzhForbiddenHits = gzhForbidden.filter((pattern) => pattern.test(wechatBodyHtml));
  assert.deepEqual(gzhForbiddenHits, [], '纯正文包含公众号不兼容标签或样式');

  for (const imageTag of wechatBodyHtml.match(/<img\b[^>]*>/gi) ?? []) {
    assert.match(imageTag, /max-width\s*:\s*100%/i, '正文图片缺少 max-width:100%');
    assert.match(imageTag, /height\s*:\s*auto/i, '正文图片缺少 height:auto');
    assert.match(imageTag, /display\s*:\s*block/i, '正文图片缺少 display:block');
    assert.match(imageTag, /margin\s*:\s*0 auto/i, '正文图片缺少 margin:0 auto');
  }
  assert.equal([...articleHtml.matchAll(/<button /g)].length, 4, '复制按钮不是 4 个');
  assert.equal([...articleHtml.matchAll(/<img /g)].length, imageRefs.length + 1, '工作台图片数不一致');
  assert.equal([...publishHtml.matchAll(/<button /g)].length, 4, '备用入口复制按钮不是 4 个');
  assert.equal(articleHtml.includes('@media (max-width: 620px)'), true, '缺少手机响应式样式');

  const prefix = 'const embeddedImageData = Object.freeze(';
  const jsonStart = articleHtml.indexOf(prefix) + prefix.length;
  const jsonEnd = articleHtml.indexOf(');', jsonStart);
  assert.ok(jsonStart >= prefix.length && jsonEnd > jsonStart, '缺少内嵌图片数据');
  const embedded = JSON.parse(articleHtml.slice(jsonStart, jsonEnd));
  assert.deepEqual(Object.keys(embedded).sort(), ['imgs/cover.png', ...imageRefs].sort(), '内嵌图片列表不一致');
  for (const [relativePath, dataUrl] of Object.entries(embedded)) {
    assert.match(dataUrl, /^data:image\/png;base64,/, `${relativePath} 未内嵌为 PNG`);
  }

  return {
    result: 'PASS',
    articleDirectory: root,
    articleCharacters: body.length,
    forbiddenHits,
    contentImages: imageRefs.length,
    embeddedImages: Object.keys(embedded).length,
    leafSpans: [...wechatBodyHtml.matchAll(/<span\s+leaf=""/gi)].length,
    copyButtons: 4,
    coverRatio: Number((cover.width / cover.height).toFixed(4)),
    dimensions,
    bodyImageProfile,
    openingOverview,
    complexFlowcharts,
  };
}

if (resolve(process.argv[1] ?? '') === scriptPath) {
  try {
    console.log(JSON.stringify(await verifyDelivery(process.argv[2]), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
