import * as fs from 'fs';
import * as path from 'path';

// NestJS copies assets to dist/intelligence/prompts/templates/ while compiled JS is at dist/src/intelligence/prompts/
// So we go up three levels from __dirname (dist/src/intelligence/prompts/) to dist/ then into intelligence/prompts/templates/
const TEMPLATES_DIR = path.join(__dirname, '..', '..', '..', 'intelligence', 'prompts', 'templates');
const isDev = process.env.NODE_ENV !== 'production';
const cache = new Map<string, string>();

export function loadTemplate(relativePath: string): string {
  if (!isDev && cache.has(relativePath)) return cache.get(relativePath)!;
  const content = fs.readFileSync(path.join(TEMPLATES_DIR, relativePath), 'utf-8');
  cache.set(relativePath, content);
  return content;
}

let _sharedRulesCache: string | null = null;

function getSharedRules(): string {
  if (!isDev && _sharedRulesCache) return _sharedRulesCache;
  _sharedRulesCache = loadTemplate('extraction/shared-rules.md');
  return _sharedRulesCache;
}

export function loadPromptWithSharedRules(relativePath: string): string {
  const template = loadTemplate(relativePath);
  return template.replace('{{SHARED_RULES}}', getSharedRules());
}
