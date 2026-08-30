#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { transitionDraft } from './lib/draft-manifest.mjs';
import {
  assertSafeRelativePath,
  readJson,
  redact,
} from './lib/state-io.mjs';
import { resolvePostToWechat } from './resolve_post_to_wechat.mjs';

const scriptPath = fileURLToPath(import.meta.url);

export function resolveBunRuntime() {
  const bun = spawnSync('bun', ['--version'], { encoding: 'utf8', shell: false });
  if (bun.status === 0) return { command: 'bun', prefix: [] };
  const npx = spawnSync('npx', ['--version'], { encoding: 'utf8', shell: false });
  if (npx.status === 0) return { command: 'npx', prefix: ['-y', 'bun'] };
  throw new Error('Neither bun nor npx is available for baoyu-post-to-wechat');
}

export function buildPublisherInvocation({
  manifest,
  manifestPath,
  dependency,
  runtime,
}) {
  if (!dependency?.found || !dependency.apiScript || !dependency.browserScript) {
    throw new Error('baoyu-post-to-wechat dependency is unavailable');
  }
  const articleDir = dirname(resolve(manifestPath));
  const absoluteHtml = join(articleDir, assertSafeRelativePath(manifest.input_html));
  const absoluteCover = join(articleDir, assertSafeRelativePath(manifest.cover));
  const commonMetadata = [
    '--title', manifest.title,
    '--summary', manifest.summary,
    '--account', manifest.account_alias,
  ];

  let publisherArgs;
  if (manifest.method === 'browser') {
    publisherArgs = [
      dependency.browserScript,
      '--html', absoluteHtml,
      ...commonMetadata,
      '--submit',
    ];
  } else if (manifest.method === 'api' || manifest.method === 'remote-api') {
    publisherArgs = [
      dependency.apiScript,
      absoluteHtml,
      '--theme', 'default',
      ...commonMetadata,
      '--cover', absoluteCover,
      ...(manifest.method === 'remote-api' ? ['--remote'] : []),
    ];
  } else {
    throw new Error(`Unsupported draft method: ${manifest.method}`);
  }

  return {
    command: runtime.command,
    args: [...runtime.prefix, ...publisherArgs],
  };
}

export function parsePublisherSuccess(method, stdout) {
  if (method === 'browser') {
    const appmsgid = stdout.match(/Draft saved successfully! appmsgid:\s*([^\s]+)/)?.[1];
    if (!appmsgid) return null;
    return {
      draft_id: appmsgid,
      draft_id_type: 'appmsgid',
      media_id: null,
      appmsgid,
      cover_verification_required: true,
    };
  }

  const starts = [...stdout.matchAll(/\{/g)].map((match) => match.index).reverse();
  for (const start of starts) {
    try {
      const parsed = JSON.parse(stdout.slice(start));
      if (parsed.success === true && parsed.media_id) {
        return {
          draft_id: parsed.media_id,
          draft_id_type: 'media_id',
          media_id: parsed.media_id,
          appmsgid: null,
          cover_verification_required: false,
        };
      }
    } catch {
      // Try an earlier JSON object boundary.
    }
  }
  return null;
}

async function defaultRunner({ command, args }) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
    maxBuffer: 20 * 1024 * 1024,
    timeout: 15 * 60 * 1000,
  });
  return {
    code: result.status,
    signal: result.signal,
    stdout: result.stdout || '',
    stderr: result.stderr || result.error?.message || '',
  };
}

function safeError(value) {
  return String(redact(value || 'Publisher result was not conclusive')).slice(0, 2000);
}

export async function saveDraft({
  manifestPath,
  confirmedFingerprint,
  runner = defaultRunner,
  dependency,
  runtime,
  expectedMethod,
  expectedAccount,
  clock = () => new Date(),
  attemptId = () => randomUUID(),
}) {
  const absoluteManifest = resolve(manifestPath);
  const manifest = await readJson(absoluteManifest);
  if (manifest.status !== 'prepared') {
    throw new Error(`Draft must be prepared before submission; found ${manifest.status}`);
  }
  if (!confirmedFingerprint || confirmedFingerprint !== manifest.content_fingerprint) {
    throw new Error('Exact content fingerprint confirmation is required');
  }
  if (expectedMethod && expectedMethod !== manifest.method) {
    throw new Error(`Confirmed method ${expectedMethod} does not match prepared method ${manifest.method}`);
  }
  if (expectedAccount && expectedAccount !== manifest.account_alias) {
    throw new Error(`Confirmed account ${expectedAccount} does not match prepared account ${manifest.account_alias}`);
  }

  const resolvedDependency = dependency ?? await resolvePostToWechat({
    explicit: process.env.XPC_WECHAT_POST_TO_WECHAT_DIR,
  });
  if (!resolvedDependency.found) {
    throw new Error('baoyu-post-to-wechat is required before saving a draft');
  }
  const invocation = buildPublisherInvocation({
    manifest,
    manifestPath: absoluteManifest,
    dependency: resolvedDependency,
    runtime: runtime ?? resolveBunRuntime(),
  });
  const startedAt = clock().toISOString();
  const submitting = await transitionDraft({
    manifestPath: absoluteManifest,
    from: 'prepared',
    to: 'submitting',
    patch: {
      attempt_id: attemptId(),
      last_attempt_at: startedAt,
      last_error: null,
    },
  });

  let result;
  try {
    result = await runner(invocation);
  } catch (error) {
    return transitionDraft({
      manifestPath: absoluteManifest,
      from: 'submitting',
      to: 'unknown',
      patch: {
        last_error: safeError(error instanceof Error ? error.message : String(error)),
        cover_verification_required: submitting.method === 'browser',
      },
    });
  }

  const parsed = result?.code === 0
    ? parsePublisherSuccess(submitting.method, result.stdout || '')
    : null;
  if (parsed) {
    return transitionDraft({
      manifestPath: absoluteManifest,
      from: 'submitting',
      to: 'saved',
      patch: {
        ...parsed,
        submitted_at: clock().toISOString(),
        last_error: null,
      },
    });
  }

  return transitionDraft({
    manifestPath: absoluteManifest,
    from: 'submitting',
    to: 'unknown',
    patch: {
      last_error: safeError(result?.stderr || result?.stdout || result?.signal),
      cover_verification_required: submitting.method === 'browser',
    },
  });
}

function usage() {
  console.error('Usage: save_wechat_draft.mjs <article-dir> --confirm-fingerprint <sha256:...> [--method api|remote-api|browser] [--account alias]');
  process.exit(1);
}

function parseArgs(args) {
  const articleDir = args[0];
  if (!articleDir || articleDir.startsWith('--')) usage();
  const options = { articleDir, confirmedFingerprint: null, expectedMethod: null, expectedAccount: null };
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--confirm-fingerprint' && args[index + 1]) options.confirmedFingerprint = args[++index];
    else if (arg === '--method' && args[index + 1]) options.expectedMethod = args[++index];
    else if (arg === '--account' && args[index + 1]) options.expectedAccount = args[++index];
    else usage();
  }
  if (!options.confirmedFingerprint) usage();
  return options;
}

if (resolve(process.argv[1] ?? '') === scriptPath) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await saveDraft({
      manifestPath: join(resolve(options.articleDir), 'wechat-draft.json'),
      confirmedFingerprint: options.confirmedFingerprint,
      expectedMethod: options.expectedMethod,
      expectedAccount: options.expectedAccount,
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== 'saved') process.exit(2);
  } catch (error) {
    console.error(`Error: ${safeError(error instanceof Error ? error.message : String(error))}`);
    process.exit(1);
  }
}
