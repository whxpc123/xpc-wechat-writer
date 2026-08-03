import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? process.cwd());
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
  '接下来让我们', '在当今', 'AI工具', '某个模型', '相关技术', '：', '——', '“', '”'
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
    height: buffer.readUInt32BE(20)
  };
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
  /display\s*:\s*grid/i, /var\s*\(\s*--/i
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

console.log(JSON.stringify({
  result: 'PASS',
  articleDirectory: root,
  articleCharacters: body.length,
  forbiddenHits,
  contentImages: imageRefs.length,
  embeddedImages: Object.keys(embedded).length,
  leafSpans: [...wechatBodyHtml.matchAll(/<span\s+leaf=""/gi)].length,
  copyButtons: 4,
  coverRatio: Number((cover.width / cover.height).toFixed(4)),
  dimensions
}, null, 2));
