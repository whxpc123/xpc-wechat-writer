#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const VALID_TOPIC_STATUSES = new Set([
  'candidate',
  'outline_pending',
  'outline_confirmed',
  'producing',
  'completed',
  'skipped',
]);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function usage() {
  fail(`Usage:
  topic_batch.mjs init <articles-root> <batch-id> <topics-json-file>
  topic_batch.mjs show <articles-root> [--batch <batch-id>]
  topic_batch.mjs update <articles-root> <topic-number> --status <status> [--batch <batch-id>] [--outline-file <path>] [--article-dir <path>] [--final-title <title>] [--article-html <path>] [--qa-report <path>]
  topic_batch.mjs activate <articles-root> <batch-id>`);
}

function nowIso() {
  return new Date().toISOString();
}

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (!key?.startsWith('--') || value === undefined) usage();
    flags[key.slice(2)] = value;
  }
  return flags;
}

function stateRoot(articlesRoot) {
  return path.join(path.resolve(articlesRoot), '_topic-batches');
}

function assertBatchId(batchId) {
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(batchId || '')) {
    fail(`Invalid batch id: ${batchId || '(empty)'}`);
  }
}

function currentBatchId(articlesRoot) {
  const currentPath = path.join(stateRoot(articlesRoot), 'CURRENT');
  if (!fs.existsSync(currentPath)) fail('No current topic batch found.');
  const batchId = fs.readFileSync(currentPath, 'utf8').trim();
  assertBatchId(batchId);
  return batchId;
}

function resolveBatchId(articlesRoot, requested) {
  if (requested) {
    assertBatchId(requested);
    return requested;
  }
  return currentBatchId(articlesRoot);
}

function batchPath(articlesRoot, batchId) {
  return path.join(stateRoot(articlesRoot), batchId, 'batch.json');
}

function loadBatch(articlesRoot, batchId) {
  const file = batchPath(articlesRoot, batchId);
  if (!fs.existsSync(file)) fail(`Topic batch not found: ${batchId}`);
  return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function activate(articlesRoot, batchId) {
  assertBatchId(batchId);
  const file = batchPath(articlesRoot, batchId);
  if (!fs.existsSync(file)) fail(`Topic batch not found: ${batchId}`);
  const root = stateRoot(articlesRoot);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'CURRENT'), `${batchId}\n`, 'utf8');
}

function validateTopics(topics) {
  if (!Array.isArray(topics) || topics.length !== 5) {
    fail('Topics JSON must be an array containing exactly 5 topics.');
  }
  const numbers = topics.map((topic) => Number(topic.number));
  if (new Set(numbers).size !== 5 || numbers.some((n) => n < 1 || n > 5)) {
    fail('Topic numbers must be unique integers from 1 to 5.');
  }
  for (const topic of topics) {
    if (!topic.title || !topic.topic || !topic.target_reader || !topic.problem) {
      fail(`Topic ${topic.number} is missing required full candidate fields.`);
    }
  }
}

const [command, ...rest] = process.argv.slice(2);
if (!command) usage();

if (command === 'init') {
  const [articlesRoot, batchId, topicsFile] = rest;
  if (!articlesRoot || !batchId || !topicsFile) usage();
  assertBatchId(batchId);
  const topics = JSON.parse(fs.readFileSync(path.resolve(topicsFile), 'utf8'));
  validateTopics(topics);
  const timestamp = nowIso();
  const normalizedTopics = topics
    .map((topic) => ({
      ...topic,
      number: Number(topic.number),
      status: topic.status || 'candidate',
      outline_file: topic.outline_file ?? null,
      article_dir: topic.article_dir ?? null,
      final_title: topic.final_title ?? null,
      article_html: topic.article_html ?? null,
      qa_report: topic.qa_report ?? null,
    }))
    .sort((a, b) => a.number - b.number);
  const data = {
    schema_version: 1,
    batch_id: batchId,
    created_at: timestamp,
    updated_at: timestamp,
    status: 'active',
    topics: normalizedTopics,
  };
  const file = batchPath(articlesRoot, batchId);
  if (fs.existsSync(file)) fail(`Topic batch already exists: ${batchId}`);
  writeJsonAtomic(file, data);
  activate(articlesRoot, batchId);
  console.log(file);
  process.exit(0);
}

if (command === 'show') {
  const [articlesRoot, ...flagArgs] = rest;
  if (!articlesRoot) usage();
  const flags = parseFlags(flagArgs);
  const batchId = resolveBatchId(articlesRoot, flags.batch);
  const { data } = loadBatch(articlesRoot, batchId);
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

if (command === 'activate') {
  const [articlesRoot, batchId] = rest;
  if (!articlesRoot || !batchId) usage();
  activate(articlesRoot, batchId);
  console.log(batchId);
  process.exit(0);
}

if (command === 'update') {
  const [articlesRoot, topicNumberRaw, ...flagArgs] = rest;
  if (!articlesRoot || !topicNumberRaw) usage();
  const topicNumber = Number(topicNumberRaw);
  if (!Number.isInteger(topicNumber) || topicNumber < 1 || topicNumber > 5) {
    fail('Topic number must be an integer from 1 to 5.');
  }
  const flags = parseFlags(flagArgs);
  if (!VALID_TOPIC_STATUSES.has(flags.status)) {
    fail(`Invalid or missing status: ${flags.status || '(empty)'}`);
  }
  const batchId = resolveBatchId(articlesRoot, flags.batch);
  const { file, data } = loadBatch(articlesRoot, batchId);
  const topic = data.topics.find((item) => Number(item.number) === topicNumber);
  if (!topic) fail(`Topic ${topicNumber} does not exist in batch ${batchId}.`);
  topic.status = flags.status;
  const mappings = {
    'outline-file': 'outline_file',
    'article-dir': 'article_dir',
    'final-title': 'final_title',
    'article-html': 'article_html',
    'qa-report': 'qa_report',
  };
  for (const [flag, field] of Object.entries(mappings)) {
    if (flags[flag] !== undefined) topic[field] = flags[flag];
  }
  data.updated_at = nowIso();
  if (data.topics.every((item) => ['completed', 'skipped'].includes(item.status))) {
    data.status = 'closed';
  }
  writeJsonAtomic(file, data);
  console.log(JSON.stringify(topic, null, 2));
  process.exit(0);
}

usage();

