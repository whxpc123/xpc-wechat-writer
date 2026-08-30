import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, posix } from 'node:path';

export const sha256Text = (value) => createHash('sha256').update(value).digest('hex');

export async function hashFile(file) {
  return sha256Text(await readFile(file));
}

export function assertSafeRelativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\0')) {
    throw new Error(`Unsafe relative path: ${String(value)}`);
  }
  const portable = value.replaceAll('\\', '/');
  const normalized = posix.normalize(portable);
  if (
    isAbsolute(value)
    || portable.startsWith('/')
    || /^[A-Za-z]:\//.test(portable)
    || normalized === '..'
    || normalized.startsWith('../')
  ) {
    throw new Error(`Unsafe relative path: ${value}`);
  }
  return normalized;
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function readJsonIfExists(file) {
  try {
    return await readJson(file);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function readJsonLines(file) {
  try {
    return (await readFile(file, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

export async function writeTextAtomic(file, text) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, text, 'utf8');
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

export async function writeJsonAtomic(file, value) {
  return writeTextAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function appendJsonLine(file, value) {
  await mkdir(dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(value)}\n`, 'utf8');
}

const SECRET_VALUE_PATTERN = /(appsecret|access[_-]?token|cookie|authorization|private[_-]?key)(\s*[:=]\s*)([^\s,;]+)/gi;
const SECRET_KEY_PATTERN = /secret|token|cookie|authorization|private.?key/i;

export function redact(value) {
  if (typeof value === 'string') {
    return value.replace(SECRET_VALUE_PATTERN, '$1$2[REDACTED]');
  }
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SECRET_KEY_PATTERN.test(key) ? '[REDACTED]' : redact(item),
      ]),
    );
  }
  return value;
}
