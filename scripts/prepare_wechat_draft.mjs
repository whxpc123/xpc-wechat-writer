#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { prepareDraft } from './lib/draft-manifest.mjs';
import { redact } from './lib/state-io.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const skillRoot = resolve(dirname(scriptPath), '..');

function usage() {
  console.error('Usage: prepare_wechat_draft.mjs <article-dir> --method api|remote-api|browser [--account alias]');
  process.exit(1);
}

function parseArgs(args) {
  const articleDir = args[0];
  if (!articleDir || articleDir.startsWith('--')) usage();
  const options = { articleDir, method: 'api', accountAlias: 'default' };
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--method' && args[index + 1]) options.method = args[++index];
    else if (arg === '--account' && args[index + 1]) options.accountAlias = args[++index];
    else usage();
  }
  return options;
}

export function runDeliveryCheck(articleDir) {
  const verifier = join(skillRoot, 'scripts', 'verify_delivery.mjs');
  const result = spawnSync(process.execPath, [verifier, articleDir], {
    encoding: 'utf8',
    shell: false,
  });
  if (result.status === 0) return { ok: true, output: result.stdout.trim() };
  const error = redact((result.stderr || result.stdout || 'Delivery QA failed').trim());
  return { ok: false, error: String(error).slice(0, 2000) };
}

if (resolve(process.argv[1] ?? '') === scriptPath) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const manifest = await prepareDraft({
      ...options,
      deliveryCheck: async (articleDir) => runDeliveryCheck(articleDir),
    });
    console.log(JSON.stringify(manifest, null, 2));
  } catch (error) {
    console.error(`Error: ${redact(error instanceof Error ? error.message : String(error))}`);
    process.exit(1);
  }
}
