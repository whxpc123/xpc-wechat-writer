import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const explicit = process.env.XPC_WECHAT_GZH_DESIGN_DIR;
const candidates = [
  explicit,
  join(process.cwd(), '.agents', 'skills', 'gzh-design'),
  join(process.cwd(), '.codex', 'skills', 'gzh-design'),
  join(homedir(), '.agents', 'skills', 'gzh-design'),
  join(homedir(), '.codex', 'skills', 'gzh-design'),
  resolve(skillRoot, '..', 'gzh-design')
].filter(Boolean);

for (const candidate of [...new Set(candidates.map((item) => resolve(item)))]) {
  try {
    await Promise.all([
      access(join(candidate, 'SKILL.md')),
      access(join(candidate, 'references', 'theme-index.md')),
      access(join(candidate, 'scripts', 'validate_gzh_html.py'))
    ]);
    console.log(JSON.stringify({ found: true, path: candidate }, null, 2));
    process.exit(0);
  } catch {
    // Continue checking known Skill locations.
  }
}

console.error(JSON.stringify({
  found: false,
  searched: candidates,
  install: 'npx -y skills@latest add isjiamu/gzh-design-skill --skill gzh-design --agent codex --global --copy --yes'
}, null, 2));
process.exit(1);
