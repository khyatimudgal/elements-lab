import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { transform } from 'sucrase';
import * as sucrase from 'sucrase';
import * as React from 'react';
import * as elements from '@unlayer/react-elements';

const dom = new JSDOM('<!doctype html><html></html>');
globalThis.DOMParser = dom.window.DOMParser;

const EXTERNALS = {
    '@unlayer/react-elements': elements,
    react: React,
    React,
    sucrase,
};

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = new Map();

function loadTypeScript(filePath) {
    const resolved = path.resolve(PROJECT_ROOT, filePath);
    if (registry.has(resolved)) return registry.get(resolved);

    const { code } = transform(fs.readFileSync(resolved, 'utf8'), {
        transforms: ['jsx', 'typescript', 'imports'],
        jsxRuntime: 'classic',
        production: true,
    });

    const moduleShim = { exports: {} };
    registry.set(resolved, moduleShim.exports);

    function requireShim(specifier) {
        if (EXTERNALS[specifier]) return EXTERNALS[specifier];
        if (!specifier.startsWith('.')) throw new Error(`Unexpected import: ${specifier}`);

        const base = path.resolve(path.dirname(resolved), specifier.replace(/\.js$/, ''));
        const candidate = [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find(
            function exists(option) {
                return fs.existsSync(option);
            }
        );
        if (!candidate) throw new Error(`Cannot resolve ${specifier} from ${resolved}`);
        return loadTypeScript(candidate);
    }

    new Function('require', 'module', 'exports', 'React', code)(
        requireShim,
        moduleShim,
        moduleShim.exports,
        React
    );
    registry.set(resolved, moduleShim.exports);
    return moduleShim.exports;
}

const { PRESETS } = loadTypeScript('src/lib/presets.ts');
const { auditEmail } = loadTypeScript('src/lib/audit/index.ts');
const { compileTemplate } = loadTypeScript('src/lib/compile.ts');
const { renderHtml, renderPlainText, renderDesignJson, RENDER_MODES } =
    loadTypeScript('src/lib/render.ts');

const EXPECTATIONS = {
    welcome: { errors: 0 },
    receipt: { errors: 0 },
    newsletter: { errors: 0 },
    broken: { minErrors: 5 },
};

let failed = 0;

function check(label, passed, detail) {
    console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
    if (!passed) failed += 1;
}

for (const preset of PRESETS) {
    console.log(`\n${preset.label}`);

    const compiled = compileTemplate(preset.source);
    check('compiles', compiled.error === null, compiled.error?.message);
    if (!compiled.data) continue;

    for (const { id, label } of RENDER_MODES) {
        const result = renderHtml(compiled.data, id);
        check(
            `renders as ${label}`,
            result.error === null && (result.data?.html.length ?? 0) > 100,
            result.error?.message ?? `${((result.data?.byteSize ?? 0) / 1024).toFixed(1)}KB`
        );
    }

    const text = renderPlainText(compiled.data, 'email');
    check('produces a plain-text fallback', text.error === null && (text.data?.length ?? 0) > 20);

    const design = renderDesignJson(compiled.data, 'email');
    const rows = design.data?.body?.rows ?? [];
    check(
        'produces valid design JSON',
        design.error === null && rows.length > 0,
        design.error?.message ?? `${rows.length} rows, schema ${design.data?.schemaVersion}`
    );

    const email = renderHtml(compiled.data, 'email');
    if (!email.data) {
        check('audit runs on the email output', false, email.error?.message);
        continue;
    }

    const expectation = EXPECTATIONS[preset.id];
    if (!expectation) {
        check(`has an EXPECTATIONS entry for "${preset.id}"`, false, 'add one to scripts/verify.mjs');
        continue;
    }

    const report = auditEmail(email.data.html, email.data.byteSize);

    if (expectation.minErrors === undefined) {
        check('audit reports a clean template', report.errorCount === expectation.errors, `${report.errorCount} errors`);
    } else {
        check(
            'audit catches the planted defects',
            report.errorCount >= expectation.minErrors,
            `${report.errorCount} errors, ${report.warningCount} warnings`
        );
    }
}

const { parseColor, contrastRatio } = loadTypeScript('src/lib/audit/colors.ts');

function rgbEquals(colour, red, green, blue) {
    return colour?.red === red && colour?.green === green && colour?.blue === blue;
}

console.log('\nColour parsing');
check('expands 3-digit hex', rgbEquals(parseColor('#fff'), 255, 255, 255));
check('reads 6-digit hex', rgbEquals(parseColor('#1d4ed8'), 29, 78, 216));
check('reads rgb()', rgbEquals(parseColor('rgb(29, 78, 216)'), 29, 78, 216));
check('strips !important', rgbEquals(parseColor('#333 !important'), 51, 51, 51));
check('reads hex from a background shorthand', rgbEquals(parseColor('#fff url(hero.png)'), 255, 255, 255));
check('rejects malformed hex instead of inventing a colour', parseColor('#12345z') === null);
check('rejects a 5-digit hex', parseColor('#12345') === null);
check('treats fully transparent rgba as absent', parseColor('rgba(0,0,0,0)') === null);
check('treats fully transparent 8-digit hex as absent', parseColor('#00000000') === null);
check('keeps opaque 8-digit hex', rgbEquals(parseColor('#1d4ed8ff'), 29, 78, 216));
check('treats the transparent keyword as absent', parseColor('transparent') === null);
check('rejects nonsense', parseColor('not-a-colour') === null);

console.log('\nContrast maths');
const black = parseColor('#000');
const white = parseColor('#ffffff');
check('black on white is 21:1', Math.round(contrastRatio(black, white)) === 21);
check('white on white is 1:1', Math.round(contrastRatio(white, white)) === 1);
check(
    'clamps out-of-range rgb so the ratio cannot exceed 21',
    contrastRatio(parseColor('rgb(300,300,300)'), black) <= 21
);

console.log('\nMerge tag scanning');
function mergeFindings(html) {
    return auditEmail(`<html><body><p>${html}</p></body></html>`, 500).findings;
}
function hasFinding(html, idPrefix) {
    return mergeFindings(html).some(function match(finding) {
        return finding.id.startsWith(idPrefix) && finding.level !== 'pass';
    });
}
check('accepts a multi-line merge tag', !hasFinding('Hi {{\n  first_name\n}}', 'merge-tag'));
check('accepts a Liquid filter', !hasFinding("{{ first_name | default: 'there' }}", 'merge-tag'));
check('accepts array access', !hasFinding('{{ items[0].name }}', 'merge-tag'));
check('accepts a hyphenated field', !hasFinding('{{ first-name }}', 'merge-tag'));
check('flags a genuinely unclosed tag', hasFinding('ends {{ expires_at', 'merge-tag-unclosed'));
check('flags an empty tag', hasFinding('empty {{ }} here', 'merge-tag-empty'));
check('warns on a space inside a field name', hasFinding('{{ first name }}', 'merge-tag-suspicious'));

console.log('\nHidden content');
function contrastErrors(markup) {
    return auditEmail(`<html><body>${markup}</body></html>`, 500).findings.filter(
        function isContrastError(finding) {
            return finding.id.startsWith('contrast-');
        }
    ).length;
}
const PREHEADER =
    '<div style="display:none;font-size:1px;color:#ffffff;max-height:0px;opacity:0;overflow:hidden;">Preview text</div>';
check('ignores a hidden email preheader', contrastErrors(PREHEADER) === 0);
check('ignores visibility:hidden text', contrastErrors('<p style="visibility:hidden;color:#fff">x</p>') === 0);
check(
    'still flags visible low-contrast text',
    contrastErrors('<p style="color:#eeeeee;background-color:#ffffff">x</p>') === 1
);

console.log('\nLink scanning');
function linkFindings(href) {
    return auditEmail(
        `<html><body><a href="${href}">x</a></body></html>`,
        500
    ).findings.filter(function insecure(finding) {
        return finding.id === 'link-insecure' || finding.id === 'link-empty';
    });
}
check('catches uppercase HTTP://', linkFindings('HTTP://example.com').length === 1);
check('catches a padded placeholder href', linkFindings('  #  ').length === 1);
check('accepts https', linkFindings('https://example.com').length === 0);

const badSource = 'export const config = {};';
const badCompile = compileTemplate(badSource);
console.log('\nError handling');
check('rejects a template with no default export', badCompile.error !== null);
check(
    'reports a readable message',
    badCompile.error?.message.includes('default export') ?? false,
    badCompile.error?.message
);

console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
