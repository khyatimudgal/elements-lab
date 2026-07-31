export type Rgb = { red: number; green: number; blue: number };

const NAMED_COLORS: Record<string, string> = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
    gray: '#808080',
    grey: '#808080',
    silver: '#c0c0c0',
    navy: '#000080',
    teal: '#008080',
    orange: '#ffa500',
    yellow: '#ffff00',
    purple: '#800080',
};

const ABSENT_KEYWORDS = new Set(['transparent', 'inherit', 'initial', 'none', 'unset', 'currentcolor']);
const LEADING_HEX = /^#([0-9a-f]{3,8})(?:\s|$)/;
const VALID_HEX_LENGTHS = new Set([3, 4, 6, 8]);
const CHANNEL_MAX = 255;

function clampChannel(value: number): number {
    return Math.max(0, Math.min(CHANNEL_MAX, value));
}

function fromHex(digits: string): Rgb | null {
    if (!VALID_HEX_LENGTHS.has(digits.length)) return null;

    const expanded =
        digits.length <= 4
            ? digits
                  .split('')
                  .map(function double(character) {
                      return character + character;
                  })
                  .join('')
            : digits;

    if (expanded.length === 8 && Number.parseInt(expanded.slice(6, 8), 16) === 0) return null;

    const parsed = Number.parseInt(expanded.slice(0, 6), 16);
    return {
        red: (parsed >> 16) & CHANNEL_MAX,
        green: (parsed >> 8) & CHANNEL_MAX,
        blue: parsed & CHANNEL_MAX,
    };
}

export function parseColor(input: string | undefined): Rgb | null {
    if (!input) return null;

    const value = input
        .trim()
        .toLowerCase()
        .replace(/\s*!important\s*$/, '')
        .trim();
    if (!value || ABSENT_KEYWORDS.has(value)) return null;

    const declared = Object.hasOwn(NAMED_COLORS, value) ? NAMED_COLORS[value] : value;

    const hex = declared.match(LEADING_HEX);
    if (hex) return fromHex(hex[1]);
    if (declared.startsWith('#')) return null;

    const functional = declared.match(/^rgba?\(([^)]+)\)/);
    if (!functional) return null;

    const parts = functional[1].split(/[,/\s]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
    if (parts.length > 3 && parts[3] === 0) return null;

    return {
        red: clampChannel(parts[0]),
        green: clampChannel(parts[1]),
        blue: clampChannel(parts[2]),
    };
}

function channelLuminance(channel: number): number {
    const normalized = channel / CHANNEL_MAX;
    return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

export function relativeLuminance({ red, green, blue }: Rgb): number {
    return (
        0.2126 * channelLuminance(red) +
        0.7152 * channelLuminance(green) +
        0.0722 * channelLuminance(blue)
    );
}

export function contrastRatio(foreground: Rgb, background: Rgb): number {
    const first = relativeLuminance(foreground);
    const second = relativeLuminance(background);
    const lighter = Math.max(first, second);
    const darker = Math.min(first, second);
    return (lighter + 0.05) / (darker + 0.05);
}

export function toHex({ red, green, blue }: Rgb): string {
    return `#${[red, green, blue]
        .map(function pad(channel) {
            return clampChannel(Math.round(channel)).toString(16).padStart(2, '0');
        })
        .join('')}`;
}
