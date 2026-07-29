import * as fs from 'fs';
import * as path from 'path';

const PROMPTS_DIR = path.join(__dirname, '..', '..', '..', 'ocr', 'prompts');
// For dev: try source path first, fall back to dist
const DEV_PROMPTS_DIR = path.join(__dirname, '..', 'ocr', 'prompts');
const cache = new Map<string, string>();

function resolvePromptsDir(): string {
  if (fs.existsSync(PROMPTS_DIR)) return PROMPTS_DIR;
  if (fs.existsSync(DEV_PROMPTS_DIR)) return DEV_PROMPTS_DIR;
  // Last resort: relative to cwd
  const cwdPath = path.join(process.cwd(), 'src', 'ocr', 'prompts');
  if (fs.existsSync(cwdPath)) return cwdPath;
  throw new Error(`Cannot find prompts directory`);
}

export function loadPrompt(filename: string): string {
  if (cache.has(filename)) return cache.get(filename)!;
  const dir = resolvePromptsDir();
  const content = fs.readFileSync(path.join(dir, filename), 'utf-8');
  const sharedRules = fs.readFileSync(path.join(dir, 'shared-rules.md'), 'utf-8');
  const result = content.replace('{{SHARED_RULES}}', sharedRules);
  cache.set(filename, result);
  return result;
}
