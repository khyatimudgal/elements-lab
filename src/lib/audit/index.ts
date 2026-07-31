import { contrastRatio, parseColor, toHex } from './colors.js';

export type FindingLevel = 'error' | 'warning' | 'pass';

export type Finding = {
    id: string;
    level: FindingLevel;
    title: string;
    detail: string;
    context?: string;
};

export type AuditReport = {
    findings: Finding[];
    errorCount: number;
    warningCount: number;
    byteSize: number;
    clipPercent: number;
};

export const GMAIL_CLIP_BYTES = 102400;
export const BYTES_PER_KB = 1000;
export const GMAIL_CLIP_LABEL = `${Math.round(GMAIL_CLIP_BYTES / BYTES_PER_KB)}KB`;
export const CLIP_WARNING_PERCENT = 80;
const CLIP_WARNING_RATIO = CLIP_WARNING_PERCENT / 100;
const AA_NORMAL_RATIO = 4.5;
const AA_LARGE_RATIO = 3;
const LARGE_TEXT_PX = 24;
const LARGE_BOLD_TEXT_PX = 18.66;
const DEFAULT_FONT_PX = 16;
const BOLD_WEIGHT = 700;

export function plural(count: number, singular: string, pluralForm: string): string {
    return count === 1 ? singular : pluralForm;
}

const TEXT_NODE = 3;
const declarationCache = new WeakMap<Element, Map<string, string>>();

function declarations(element: Element): Map<string, string> {
    const cached = declarationCache.get(element);
    if (cached) return cached;

    const parsed = new Map<string, string>();
    for (const declaration of (element.getAttribute('style') ?? '').split(';')) {
        const separator = declaration.indexOf(':');
        if (separator === -1) continue;
        parsed.set(
            declaration.slice(0, separator).trim().toLowerCase(),
            declaration.slice(separator + 1).trim()
        );
    }

    declarationCache.set(element, parsed);
    return parsed;
}

function readStyle(element: Element, property: string): string | undefined {
    return declarations(element).get(property);
}

function resolveStyle(element: Element, property: string): string | undefined {
    let current: Element | null = element;
    while (current) {
        const declared = readStyle(current, property);
        if (declared) return declared;
        current = current.parentElement;
    }
    return undefined;
}

type ColourSources = (candidate: Element) => Array<string | null | undefined>;

function resolveInherited(element: Element, sources: ColourSources, fallback: string): string {
    let current: Element | null = element;
    while (current) {
        for (const declared of sources(current)) {
            if (declared && parseColor(declared)) return declared;
        }
        current = current.parentElement;
    }
    return fallback;
}

function resolveBackground(element: Element): string {
    return resolveInherited(
        element,
        function backgroundSources(candidate) {
            return [
                readStyle(candidate, 'background-color'),
                readStyle(candidate, 'background'),
                candidate.getAttribute('bgcolor'),
            ];
        },
        '#ffffff'
    );
}

function resolveForeground(element: Element): string {
    return resolveInherited(
        element,
        function foregroundSources(candidate) {
            return [readStyle(candidate, 'color'), candidate.getAttribute('color')];
        },
        '#000000'
    );
}

function isVisuallyHidden(element: Element): boolean {
    let current: Element | null = element;
    while (current) {
        const style = declarations(current);
        if (style.get('display') === 'none') return true;
        if (style.get('visibility') === 'hidden') return true;
        if (Number.parseFloat(style.get('opacity') ?? '1') === 0) return true;
        if (Number.parseFloat(style.get('max-height') ?? '1') === 0) return true;
        current = current.parentElement;
    }
    return false;
}

function isLargeText(element: Element): boolean {
    const fontSize = Number.parseFloat(resolveStyle(element, 'font-size') ?? '') || DEFAULT_FONT_PX;
    const weight = resolveStyle(element, 'font-weight') ?? '';
    const isBold = weight === 'bold' || Number.parseInt(weight, 10) >= BOLD_WEIGHT;
    return fontSize >= LARGE_TEXT_PX || (isBold && fontSize >= LARGE_BOLD_TEXT_PX);
}

function directText(element: Element): string {
    let text = '';
    for (const node of Array.from(element.childNodes)) {
        if (node.nodeType === TEXT_NODE) text += node.nodeValue ?? '';
    }
    return text.trim();
}

export function formatKilobytes(byteSize: number): string {
    return `${(byteSize / BYTES_PER_KB).toFixed(1)}KB`;
}

function checkMessageSize(byteSize: number): Finding {
    const size = formatKilobytes(byteSize);

    if (byteSize >= GMAIL_CLIP_BYTES) {
        return {
            id: 'gmail-clip',
            level: 'error',
            title: 'Gmail will clip this message',
            detail: `The rendered HTML is ${size}, over Gmail's ${GMAIL_CLIP_LABEL} limit. Gmail truncates the rest and hides your unsubscribe link, which is a compliance risk.`,
        };
    }
    if (byteSize > GMAIL_CLIP_BYTES * CLIP_WARNING_RATIO) {
        return {
            id: 'gmail-clip',
            level: 'warning',
            title: 'Approaching Gmail clipping limit',
            detail: `The rendered HTML is ${size} of the ${GMAIL_CLIP_LABEL} budget. Add much more content and Gmail will start truncating.`,
        };
    }
    return {
        id: 'gmail-clip',
        level: 'pass',
        title: 'Within Gmail size budget',
        detail: `${size} of ${GMAIL_CLIP_LABEL} used.`,
    };
}

type ContrastFailure = {
    ratio: number;
    required: number;
    foreground: string;
    background: string;
    sample: string;
    elementCount: number;
};

function checkContrast(root: Document): Finding[] {
    const failures = new Map<string, ContrastFailure>();

    for (const element of Array.from(root.body?.querySelectorAll('*') ?? [])) {
        const text = directText(element);
        if (!text || isVisuallyHidden(element)) continue;

        const foreground = parseColor(resolveForeground(element));
        const background = parseColor(resolveBackground(element));
        if (!foreground || !background) continue;

        const ratio = contrastRatio(foreground, background);
        const required = isLargeText(element) ? AA_LARGE_RATIO : AA_NORMAL_RATIO;
        if (ratio >= required) continue;

        const signature = `${toHex(foreground)}|${toHex(background)}|${required}`;
        const existing = failures.get(signature);
        if (existing) {
            existing.elementCount += 1;
            continue;
        }

        failures.set(signature, {
            ratio,
            required,
            foreground: toHex(foreground),
            background: toHex(background),
            sample: text.length > 60 ? `${text.slice(0, 60)}...` : text,
            elementCount: 1,
        });
    }

    if (failures.size === 0) {
        return [
            {
                id: 'contrast',
                level: 'pass',
                title: 'Colour contrast meets WCAG AA',
                detail: 'Every inline colour pair clears the required ratio. Colours declared only in a <style> block are not evaluated.',
            },
        ];
    }

    return Array.from(failures.values()).map(function describe(failure, index) {
        const scope =
            failure.elementCount === 1
                ? ''
                : ` Affects ${failure.elementCount} elements with this colour pair.`;
        return {
            id: `contrast-${index}`,
            level: 'error',
            title: `Contrast ${failure.ratio.toFixed(2)}:1 fails WCAG AA`,
            detail: `${failure.foreground} on ${failure.background} needs at least ${failure.required}:1. Readers with low vision, and anyone reading on a phone in sunlight, will struggle.${scope}`,
            context: failure.sample,
        };
    });
}

function checkAltText(root: Document): Finding[] {
    const images = Array.from(root.querySelectorAll('img'));
    if (images.length === 0) {
        return [
            {
                id: 'alt-text',
                level: 'pass',
                title: 'No images to check',
                detail: 'This template has no image elements.',
            },
        ];
    }

    function sources(matches: Element[]): string {
        return matches
            .map(function describe(image) {
                return image.getAttribute('src') ?? '(no src)';
            })
            .slice(0, 3)
            .join(', ');
    }

    const absent = images.filter(function hasNoAltAttribute(image) {
        return image.getAttribute('alt') === null;
    });
    const empty = images.filter(function hasEmptyAlt(image) {
        return image.getAttribute('alt')?.trim() === '';
    });

    const findings: Finding[] = [];

    if (absent.length > 0) {
        findings.push({
            id: 'alt-text-absent',
            level: 'error',
            title: `${absent.length} ${plural(absent.length, 'image has', 'images have')} no alt attribute`,
            detail: 'Most email clients block images by default, so alt text is often the only thing a reader sees. Screen readers depend on it too.',
            context: sources(absent),
        });
    }

    if (empty.length > 0) {
        findings.push({
            id: 'alt-text-empty',
            level: 'warning',
            title: `${empty.length} ${plural(empty.length, 'image has', 'images have')} empty alt text`,
            detail: 'An empty alt is correct for a purely decorative image, and wrong for one that carries meaning. Elements emits alt="" when you omit the prop, so check this was deliberate.',
            context: sources(empty),
        });
    }

    if (findings.length === 0) {
        findings.push({
            id: 'alt-text',
            level: 'pass',
            title: 'All images have alt text',
            detail: `${images.length} ${plural(images.length, 'image', 'images')} checked.`,
        });
    }

    return findings;
}

const MERGE_TAG = /\{\{([^{}<>]{0,200})\}\}/g;
const SUSPICIOUS_GAP = /\w[ \t]+\w/;

function countUnclosedTags(html: string): number {
    let unclosed = 0;
    let opening = html.indexOf('{{');

    while (opening !== -1) {
        const closing = html.indexOf('}}', opening + 2);
        const nextOpening = html.indexOf('{{', opening + 2);
        if (closing === -1 || (nextOpening !== -1 && nextOpening < closing)) unclosed += 1;
        opening = nextOpening;
    }

    return unclosed;
}

function checkMergeTags(html: string): Finding[] {
    const problems: Finding[] = [];
    const closed = Array.from(html.matchAll(MERGE_TAG));

    const unclosed = countUnclosedTags(html);
    if (unclosed > 0) {
        problems.push({
            id: 'merge-tag-unclosed',
            level: 'error',
            title: `${unclosed} unclosed merge ${plural(unclosed, 'tag', 'tags')}`,
            detail: 'An opening {{ has no matching }}. The rest of that line renders as raw text.',
        });
    }

    const empty = closed.filter(function isEmpty(match) {
        return match[1].trim() === '';
    });
    if (empty.length > 0) {
        problems.push({
            id: 'merge-tag-empty',
            level: 'error',
            title: `${empty.length} empty merge ${plural(empty.length, 'tag', 'tags')}`,
            detail: 'A {{ }} with no field name ships to your reader as literal text.',
        });
    }

    const suspicious = new Set(
        closed
            .filter(function looksLikeATypo(match) {
                const inner = match[1].trim();
                return inner !== '' && !inner.includes('|') && SUSPICIOUS_GAP.test(inner);
            })
            .map(function readTag(match) {
                return match[0];
            })
    );
    for (const tag of suspicious) {
        problems.push({
            id: `merge-tag-suspicious-${problems.length}`,
            level: 'warning',
            title: 'Merge tag contains a space',
            detail: `${tag} has a space inside the field name. Most providers expect an underscore, so check this is not a typo.`,
            context: tag,
        });
    }

    if (problems.length > 0) return problems;

    const names = new Set(
        closed.map(function readTag(match) {
            return match[0];
        })
    );
    return [
        {
            id: 'merge-tags',
            level: 'pass',
            title:
                names.size > 0
                    ? `${names.size} merge ${plural(names.size, 'tag', 'tags')} well-formed`
                    : 'No merge tags used',
            detail: names.size > 0 ? Array.from(names).join(', ') : 'Nothing to validate.',
        },
    ];
}

function checkLinks(root: Document): Finding[] {
    const anchors = Array.from(root.querySelectorAll('a'));
    const problems: Finding[] = [];

    const empty = anchors.filter(function isEmptyTarget(anchor) {
        const href = anchor.getAttribute('href')?.trim() ?? '';
        return href === '' || href === '#';
    });
    if (empty.length > 0) {
        problems.push({
            id: 'link-empty',
            level: 'error',
            title: `${empty.length} ${plural(empty.length, 'link goes', 'links go')} nowhere`,
            detail: 'A placeholder href that ships to production is a dead call-to-action.',
            context: empty
                .map(function label(anchor) {
                    return anchor.textContent?.trim() || '(no text)';
                })
                .slice(0, 3)
                .join(', '),
        });
    }

    const insecure = anchors.filter(function isInsecure(anchor) {
        return anchor.getAttribute('href')?.trim().toLowerCase().startsWith('http://') ?? false;
    });
    if (insecure.length > 0) {
        problems.push({
            id: 'link-insecure',
            level: 'warning',
            title: `${insecure.length} insecure http:// link${insecure.length === 1 ? '' : 's'}`,
            detail: 'Mail clients and security scanners flag plain http. Use https to avoid warnings and broken tracking.',
            context: insecure
                .map(function readHref(anchor) {
                    return anchor.getAttribute('href') ?? '';
                })
                .slice(0, 3)
                .join(', '),
        });
    }

    if (problems.length === 0) {
        return [
            {
                id: 'links',
                level: 'pass',
                title:
                    anchors.length > 0
                        ? `${anchors.length} ${plural(anchors.length, 'link looks', 'links look')} healthy`
                        : 'No links to check',
                detail:
                    anchors.length > 0
                        ? 'No placeholder or insecure http:// destinations found.'
                        : 'This template has no anchors.',
            },
        ];
    }
    return problems;
}

export function auditEmail(html: string, byteSize: number): AuditReport {
    const root = new DOMParser().parseFromString(html, 'text/html');

    const findings = [
        checkMessageSize(byteSize),
        ...checkContrast(root),
        ...checkAltText(root),
        ...checkMergeTags(html),
        ...checkLinks(root),
    ];

    return {
        findings,
        errorCount: findings.filter(function isError(finding) {
            return finding.level === 'error';
        }).length,
        warningCount: findings.filter(function isWarning(finding) {
            return finding.level === 'warning';
        }).length,
        byteSize,
        clipPercent: Math.min(100, (byteSize / GMAIL_CLIP_BYTES) * 100),
    };
}
