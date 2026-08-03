import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? process.cwd());
const minimumCharacters = process.env.NODE_ENV === 'test'
  ? Number(process.env.XPC_WRITING_TEST_MIN_CHARS ?? 4000)
  : 4000;
assert.ok(Number.isFinite(minimumCharacters) && minimumCharacters > 0, '测试最小字符数无效');

const [plan, factLock, draft, article, editReport] = await Promise.all([
  readFile(join(root, 'writing-plan.md'), 'utf8'),
  readFile(join(root, 'fact-lock.md'), 'utf8'),
  readFile(join(root, 'article-draft.md'), 'utf8'),
  readFile(join(root, 'article.md'), 'utf8'),
  readFile(join(root, 'edit-report.md'), 'utf8')
]);

const requiredPlanFields = [
  '文章原型', '核心判断', '开头锚点', '读者问题', '情绪曲线', '回环对象', '当天动作'
];
for (const field of requiredPlanFields) {
  assert.match(plan, new RegExp(`(?:^|\\n)[-*]?\\s*${field}\\s*[：:]`, 'm'), `writing-plan.md 缺少 ${field}`);
}

const prototype = plan.match(/(?:^|\n)[-*]?\s*文章原型\s*[：:]\s*(.+)$/m)?.[1]?.trim();
assert.ok(['现象解读', '调查实验', '方法分享', '政策趋势'].includes(prototype), `未知文章原型 ${prototype ?? '空'}`);

const coreJudgmentMatches = [...plan.matchAll(/(?:^|\n)[-*]?\s*核心判断\s*[：:]\s*(.+)$/gm)];
assert.equal(coreJudgmentMatches.length, 1, `核心判断必须恰好一条，当前 ${coreJudgmentMatches.length}`);
const coreJudgment = coreJudgmentMatches[0]?.[1]?.trim();
assert.ok(coreJudgment && coreJudgment.length >= 12, '核心判断过短或为空');

const readerQuestionBlock = plan.match(
  /(?:^|\n)[-*]?[ \t]*读者问题[ \t]*[：:][ \t]*\n([\s\S]*?)(?=\n[-*][ \t]*情绪曲线[ \t]*[：:]|(?![\s\S]))/m
)?.[1] ?? '';
const readerQuestions = [...readerQuestionBlock.matchAll(/^[ \t]*\d+[.、)][ \t]+.+$/gm)];
assert.equal(readerQuestions.length, 3, `读者问题必须恰好三个数字条目，当前 ${readerQuestions.length}`);

for (const heading of ['禁止扩大', '第一人称依据', '待核实项']) {
  assert.match(factLock, new RegExp(`^#{1,6}\\s+${heading}\\s*$`, 'm'), `fact-lock.md 缺少 ${heading}`);
}
assert.match(factLock, /\|\s*正文用途\s*\|[^\n]*不可改写的事实[^\n]*\|/m, 'fact-lock.md 缺少事实锁表格');
assert.match(factLock, /https?:\/\//, 'fact-lock.md 缺少可访问来源');
const pendingSection = factLock.match(
  /^#{1,6}\s+待核实项\s*$([\s\S]*?)(?=^#{1,6}\s|(?![\s\S]))/m
)?.[1]?.trim() ?? '';
assert.match(pendingSection, /^无[。.]?$/, 'fact-lock.md 的待核实项没有清零');

function extractBody(markdown) {
  return markdown.replace(/^---[\s\S]*?---\s*/, '');
}

function plainText(markdownBody) {
  return markdownBody
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~\s]/g, '');
}

const articleBody = extractBody(article);
const plainBody = plainText(articleBody);

assert.ok(plainBody.length >= minimumCharacters, `正文过短 ${plainBody.length}`);
assert.ok(plainBody.includes(coreJudgment.replace(/\s/g, '')), '终稿没有完整出现 writing-plan.md 的核心判断');
assert.ok(plainBody.slice(0, 600).includes(coreJudgment.replace(/\s/g, '')), '核心判断没有在正文前 600 字完整出现');

const forbidden = [
  '说白了', '意味着什么', '这意味着', '本质上', '换句话说', '不可否认',
  '综上所述', '总的来说', '值得注意的是', '不难发现', '让我们来看看',
  '接下来让我们', '在当今 AI 快速发展的时代', 'AI工具', '某个模型',
  '相关技术', '：', '——', '“', '”'
];
const forbiddenHits = forbidden.filter((token) => articleBody.includes(token));
assert.deepEqual(forbiddenHits, [], `终稿包含禁用内容 ${forbiddenHits.join(', ')}`);
assert.equal(/作者[，,:：]\s*卡兹克|@virxact\.com|投稿或爆料/.test(articleBody), false, '终稿出现禁用身份尾部');

assert.match(editReport, /事实核对\s*[：:]\s*通过/, 'edit-report.md 缺少事实核对通过');
assert.match(editReport, /读者测试\s*[：:]\s*通过/, 'edit-report.md 缺少读者测试通过');
assert.match(editReport, /初稿字符数\s*[：:]\s*\d+/, 'edit-report.md 缺少初稿字符数');
assert.match(editReport, /终稿字符数\s*[：:]\s*\d+/, 'edit-report.md 缺少终稿字符数');
assert.match(editReport, /结构删改\s*[：:]\s*\S+/, 'edit-report.md 缺少结构删改记录');

const draftBody = extractBody(draft);
const draftLength = plainText(draftBody).length;
const finalLength = plainBody.length;
const compression = draftLength > 0 ? Number(((draftLength - finalLength) / draftLength * 100).toFixed(1)) : 0;

const warnings = [];
if (finalLength > 8000) warnings.push(`正文超过推荐的 8000 字，当前 ${finalLength}`);
if (compression < 5) warnings.push(`结构压缩不足 5%，当前 ${compression}%`);
if (compression > 25) warnings.push(`结构压缩超过 25%，请确认没有删除必要证据，当前 ${compression}%`);

const headingCount = (articleBody.match(/^#{2,6}\s+/gm) ?? []).length;
const headingLimit = prototype === '现象解读' ? 4 : 7;
if (headingCount > headingLimit) warnings.push(`小标题过多，${prototype}建议不超过 ${headingLimit} 个，当前 ${headingCount}`);

console.log(JSON.stringify({
  result: 'PASS',
  articleDirectory: root,
  prototype,
  coreJudgment,
  draftCharacters: draftLength,
  finalCharacters: finalLength,
  compressionPercent: compression,
  headingCount,
  forbiddenHits,
  warnings
}, null, 2));
