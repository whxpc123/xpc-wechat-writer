#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  eligibleGroups,
  writeProposal,
} from './lib/learning-state.mjs';
import { readJsonLines, redact } from './lib/state-io.mjs';

const scriptPath = fileURLToPath(import.meta.url);

function usage() {
  console.error('Usage:\n  propose_improvement.mjs eligible --state-dir <dir>\n  propose_improvement.mjs create --state-dir <dir> --proposal <proposal.json>');
  process.exit(1);
}

function parseArgs(args) {
  const command = args[0];
  if (!['eligible', 'create'].includes(command)) usage();
  const options = { command, stateDir: null, proposalFile: null };
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--state-dir' && args[index + 1]) options.stateDir = args[++index];
    else if (arg === '--proposal' && args[index + 1]) options.proposalFile = args[++index];
    else usage();
  }
  if (!options.stateDir || (command === 'create' && !options.proposalFile)) usage();
  return options;
}

if (resolve(process.argv[1] ?? '') === scriptPath) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const stateDir = resolve(options.stateDir);
    const events = await readJsonLines(join(stateDir, 'feedback.jsonl'));
    if (options.command === 'eligible') {
      console.log(JSON.stringify(eligibleGroups(events), null, 2));
    } else {
      const proposal = JSON.parse(await readFile(resolve(options.proposalFile), 'utf8'));
      console.log(JSON.stringify(await writeProposal({ stateDir, proposal, events }), null, 2));
    }
  } catch (error) {
    console.error(`Error: ${redact(error instanceof Error ? error.message : String(error))}`);
    process.exit(1);
  }
}
