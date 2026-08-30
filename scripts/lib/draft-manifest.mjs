import { basename, join, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

import {
  hashFile,
  readJson,
  readJsonIfExists,
  sha256Text,
  writeJsonAtomic,
} from './state-io.mjs';

export const DRAFT_STATES = new Set([
  'prepared',
  'submitting',
  'saved',
  'failed',
  'unknown',
]);

const TRANSITIONS = new Map([
  ['prepared', new Set(['submitting'])],
  ['submitting', new Set(['saved', 'failed', 'unknown'])],
]);

function frontmatterValue(markdown, key) {
  const raw = markdown.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
  if (!raw) return null;
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

function assertMethod(method) {
  if (!['api', 'remote-api', 'browser'].includes(method)) {
    throw new Error(`Unsupported draft method: ${method}`);
  }
}

export async function prepareDraft({
  articleDir,
  accountAlias = 'default',
  method = 'api',
  deliveryCheck,
  clock = () => new Date(),
}) {
  const root = resolve(articleDir);
  if (typeof deliveryCheck !== 'function') {
    throw new Error('A delivery QA check is required before draft preparation');
  }
  const check = await deliveryCheck(root);
  if (!check?.ok) throw new Error(check?.error || 'Delivery QA failed');
  assertMethod(method);
  if (!accountAlias || typeof accountAlias !== 'string') {
    throw new Error('A WeChat account alias is required');
  }

  const articlePath = join(root, 'article.md');
  const htmlPath = join(root, 'article-formatted.html');
  const coverPath = join(root, 'imgs', 'cover.png');
  const [article, html, coverHash] = await Promise.all([
    readFile(articlePath, 'utf8'),
    readFile(htmlPath, 'utf8'),
    hashFile(coverPath),
  ]);

  const title = frontmatterValue(article, 'title');
  const summary = frontmatterValue(article, 'summary');
  if (!title || !summary) throw new Error('article.md requires title and summary');
  if (summary.length > 120) {
    throw new Error(`Summary exceeds 120 characters: ${summary.length}`);
  }
  if (!/^\s*<section[\s>]/i.test(html) || !/<\/section>\s*$/i.test(html)) {
    throw new Error('article-formatted.html must contain one root section');
  }

  const contentFingerprint = `sha256:${sha256Text(JSON.stringify({
    title,
    summary,
    html,
    coverHash,
  }))}`;
  const manifestPath = join(root, 'wechat-draft.json');
  const previous = await readJsonIfExists(manifestPath);
  if (
    previous?.content_fingerprint === contentFingerprint
    && ['saved', 'submitting', 'unknown'].includes(previous.status)
  ) {
    throw new Error(`Identical draft already ${previous.status}`);
  }

  const manifest = {
    schema_version: 1,
    article_id: basename(root),
    content_fingerprint: contentFingerprint,
    account_alias: accountAlias,
    method,
    input_html: 'article-formatted.html',
    cover: 'imgs/cover.png',
    title,
    summary,
    status: 'prepared',
    attempt_id: null,
    draft_id: null,
    draft_id_type: null,
    media_id: null,
    appmsgid: null,
    cover_verification_required: method === 'browser',
    last_error: null,
    prepared_at: clock().toISOString(),
    submitted_at: null,
  };

  await writeJsonAtomic(manifestPath, manifest);
  return manifest;
}

export async function transitionDraft({ manifestPath, from, to, patch = {} }) {
  if (!DRAFT_STATES.has(from) || !DRAFT_STATES.has(to)) {
    throw new Error(`Unknown draft transition: ${from} -> ${to}`);
  }
  const current = await readJson(manifestPath);
  if (current.status !== from) {
    throw new Error(`Draft expected ${from}, found ${current.status}`);
  }
  const allowed = TRANSITIONS.get(from);
  if (!allowed?.has(to)) throw new Error(`Draft transition not allowed: ${from} -> ${to}`);
  if (patch.content_fingerprint && patch.content_fingerprint !== current.content_fingerprint) {
    throw new Error('Draft transition cannot change content fingerprint');
  }

  const next = {
    ...current,
    ...patch,
    schema_version: current.schema_version,
    article_id: current.article_id,
    content_fingerprint: current.content_fingerprint,
    status: to,
  };
  await writeJsonAtomic(manifestPath, next);
  return next;
}
