#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  recordDecision,
  rollbackProposal,
  snapshotProposal,
  verifyOrRollback,
} from './lib/learning-state.mjs';
import { redact } from './lib/state-io.mjs';

const scriptPath = fileURLToPath(import.meta.url);

function usage() {
  console.error('Usage:\n  verify_improvement.mjs approve <proposal.json> --state-dir <dir> --source user\n  verify_improvement.mjs snapshot <proposal.json> --state-dir <dir> --skill-dir <dir>\n  verify_improvement.mjs verify <proposal.json> --state-dir <dir> --skill-dir <dir> --eval-results <results.json> --quick-validate <quick_validate.py>\n  verify_improvement.mjs rollback <proposal.json> --state-dir <dir> --skill-dir <dir>');
  process.exit(1);
}

function parseArgs(args) {
  const command = args[0];
  const proposalFile = args[1];
  if (!['approve', 'snapshot', 'verify', 'rollback'].includes(command) || !proposalFile) usage();
  const options = {
    command,
    proposalFile,
    stateDir: null,
    skillDir: null,
    source: null,
    evalResultsFile: null,
    quickValidate: null,
  };
  for (let index = 2; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--state-dir' && args[index + 1]) options.stateDir = args[++index];
    else if (arg === '--skill-dir' && args[index + 1]) options.skillDir = args[++index];
    else if (arg === '--source' && args[index + 1]) options.source = args[++index];
    else if (arg === '--eval-results' && args[index + 1]) options.evalResultsFile = args[++index];
    else if (arg === '--quick-validate' && args[index + 1]) options.quickValidate = args[++index];
    else usage();
  }
  if (!options.stateDir) usage();
  if (['snapshot', 'verify', 'rollback'].includes(command) && !options.skillDir) usage();
  if (command === 'approve' && options.source !== 'user') usage();
  if (command === 'verify' && (!options.evalResultsFile || !options.quickValidate)) usage();
  return options;
}

function processResult(result) {
  return {
    ok: result.status === 0,
    output: `${result.stdout || ''}\n${result.stderr || result.error?.message || ''}`.trim(),
  };
}

function quickValidateRunner(script, skillDir) {
  return async () => {
    const uv = spawnSync('uv', [
      'run', '--offline', '--with', 'pyyaml', 'python', script, skillDir,
    ], { encoding: 'utf8', shell: false });
    if (!uv.error || uv.error.code !== 'ENOENT') return processResult(uv);
    return processResult(spawnSync('python3', [script, skillDir], { encoding: 'utf8', shell: false }));
  };
}

function testsRunner(skillDir) {
  return async () => {
    const testDir = join(skillDir, 'tests');
    const files = (await readdir(testDir))
      .filter((name) => name.endsWith('.test.mjs'))
      .sort()
      .map((name) => join(testDir, name));
    if (!files.length) return { ok: false, output: 'No deterministic tests found' };
    return processResult(spawnSync(process.execPath, ['--test', ...files], {
      encoding: 'utf8',
      shell: false,
      maxBuffer: 20 * 1024 * 1024,
    }));
  };
}

async function readEvalIds(skillDir) {
  const parsed = JSON.parse(await readFile(join(skillDir, 'evals', 'evals.json'), 'utf8'));
  if (!Array.isArray(parsed.evals) || !parsed.evals.length) throw new Error('evals/evals.json requires evals');
  const ids = parsed.evals.map((item) => Number(item.id));
  if (ids.some((id) => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
    throw new Error('Behavioral eval IDs must be unique positive integers');
  }
  for (const item of parsed.evals) {
    if (!item.prompt || !item.expected_output || !Array.isArray(item.expectations) || !item.expectations.length) {
      throw new Error(`Behavioral eval ${item.id} is incomplete`);
    }
  }
  return ids;
}

if (resolve(process.argv[1] ?? '') === scriptPath) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const proposal = JSON.parse(await readFile(resolve(options.proposalFile), 'utf8'));
    let result;
    if (options.command === 'approve') {
      result = await recordDecision({
        stateDir: options.stateDir,
        proposalId: proposal.proposal_id,
        decision: 'approved',
        source: 'user',
        evidence: `User explicitly approved ${proposal.proposal_id}`,
      });
    } else if (options.command === 'snapshot') {
      result = await snapshotProposal({ proposal, stateDir: options.stateDir, skillDir: options.skillDir });
    } else if (options.command === 'rollback') {
      result = await rollbackProposal({ proposal, stateDir: options.stateDir, skillDir: options.skillDir });
    } else {
      const requiredEvalIds = await readEvalIds(resolve(options.skillDir));
      const evalResults = JSON.parse(await readFile(resolve(options.evalResultsFile), 'utf8'));
      result = await verifyOrRollback({
        proposal,
        stateDir: options.stateDir,
        skillDir: options.skillDir,
        runQuickValidate: quickValidateRunner(resolve(options.quickValidate), resolve(options.skillDir)),
        runTests: testsRunner(resolve(options.skillDir)),
        runEvalSchema: async () => {
          try {
            await readEvalIds(resolve(options.skillDir));
            return { ok: true, output: 'Behavioral eval schema is valid' };
          } catch (error) {
            return { ok: false, output: error instanceof Error ? error.message : String(error) };
          }
        },
        evalResults,
        requiredEvalIds,
      });
    }
    console.log(JSON.stringify(result, null, 2));
    if (result.status === 'rolled_back') process.exit(2);
  } catch (error) {
    console.error(`Error: ${redact(error instanceof Error ? error.message : String(error))}`);
    process.exit(1);
  }
}
