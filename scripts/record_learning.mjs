#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { recordLearning } from './lib/learning-state.mjs';
import { redact } from './lib/state-io.mjs';

const scriptPath = fileURLToPath(import.meta.url);

function usage() {
  console.error('Usage: record_learning.mjs <article-dir> [--state-dir <dir>] [--signals <signals.json>]');
  process.exit(1);
}

function parseArgs(args) {
  const articleDir = args[0];
  if (!articleDir || articleDir.startsWith('--')) usage();
  const options = { articleDir, stateDir: null, signalsFile: null };
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--state-dir' && args[index + 1]) options.stateDir = args[++index];
    else if (arg === '--signals' && args[index + 1]) options.signalsFile = args[++index];
    else usage();
  }
  return options;
}

async function readSignals(file) {
  if (!file) return [];
  const parsed = JSON.parse(await readFile(resolve(file), 'utf8'));
  const signals = Array.isArray(parsed) ? parsed : parsed.signals;
  if (!Array.isArray(signals)) throw new Error('Signals file must contain an array or { signals: [] }');
  return signals;
}

if (resolve(process.argv[1] ?? '') === scriptPath) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await recordLearning({
      articleDir: options.articleDir,
      stateDir: options.stateDir,
      signals: await readSignals(options.signalsFile),
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Error: ${redact(error instanceof Error ? error.message : String(error))}`);
    process.exit(1);
  }
}
