#!/usr/bin/env node

import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentScript = fileURLToPath(import.meta.url);
const currentSkillRoot = resolve(dirname(currentScript), '..');

export async function resolvePostToWechat({
  explicit,
  cwd = process.cwd(),
  home = homedir(),
  skillRoot = currentSkillRoot,
} = {}) {
  const candidates = [
    explicit,
    join(cwd, '.agents', 'skills', 'baoyu-post-to-wechat'),
    join(cwd, '.codex', 'skills', 'baoyu-post-to-wechat'),
    join(home, '.agents', 'skills', 'baoyu-post-to-wechat'),
    join(home, '.codex', 'skills', 'baoyu-post-to-wechat'),
    resolve(skillRoot, '..', 'baoyu-post-to-wechat'),
  ]
    .filter(Boolean)
    .map((candidate) => resolve(candidate));

  const searched = [...new Set(candidates)];
  for (const candidate of searched) {
    const apiScript = join(candidate, 'scripts', 'wechat-api.ts');
    const browserScript = join(candidate, 'scripts', 'wechat-article.ts');
    try {
      await Promise.all([
        access(join(candidate, 'SKILL.md')),
        access(apiScript),
        access(browserScript),
      ]);
      return {
        found: true,
        path: candidate,
        apiScript,
        browserScript,
        searched,
      };
    } catch {
      // Continue through deterministic candidate locations.
    }
  }

  return {
    found: false,
    path: null,
    apiScript: null,
    browserScript: null,
    searched,
    install: 'Install or enable the baoyu-post-to-wechat Skill before saving a WeChat draft.',
  };
}

if (resolve(process.argv[1] ?? '') === currentScript) {
  const result = await resolvePostToWechat({
    explicit: process.env.XPC_WECHAT_POST_TO_WECHAT_DIR,
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.found ? 0 : 1);
}
