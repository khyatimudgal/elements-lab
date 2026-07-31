import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { transform } from 'sucrase';
import * as React from 'react';
import * as elements from '@unlayer/react-elements';

const dom = new JSDOM('<!doctype html><html></html>');
globalThis.DOMParser = dom.window.DOMParser;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = new Map();
const EXTERNALS = { '@unlayer/react-elements': elements, react: React, React };

function load(file) {
  const resolved = path.resolve(ROOT, file);
  if (registry.has(resolved)) return registry.get(resolved);
  const { code } = transform(fs.readFileSync(resolved, 'utf8'), { transforms:['jsx','typescript','imports'], jsxRuntime:'classic', production:true });
  const m = { exports: {} };
  registry.set(resolved, m.exports);
  new Function('require','module','exports','React', code)((s) => {
    if (EXTERNALS[s]) return EXTERNALS[s];
    const base = path.resolve(path.dirname(resolved), s.replace(/\.js$/,''));
    const c = [`${base}.ts`, `${base}.tsx`, path.join(base,'index.ts')].find(f => fs.existsSync(f));
    return load(c);
  }, m, m.exports, React);
  registry.set(resolved, m.exports);
  return m.exports;
}

const { auditEmail } = load('src/lib/audit/index.ts');
const target = process.argv[2];
if (!target) {
  console.error('Usage: npm run audit -- <path-to-rendered-email.html>');
  process.exit(1);
}
const html = fs.readFileSync(target, 'utf8');
const report = auditEmail(html, Buffer.byteLength(html));
console.log(`\n${path.basename(target)}: ${report.errorCount} errors, ${report.warningCount} warnings, ${report.clipPercent.toFixed(0)}% of Gmail budget\n`);
for (const f of report.findings) {
  console.log(` ${f.level === 'error' ? 'X' : f.level === 'warning' ? '!' : 'v'} ${f.title}${f.context ? `  [${f.context.slice(0,50)}]` : ''}`);
}
process.exit(report.errorCount > 0 ? 1 : 0);
