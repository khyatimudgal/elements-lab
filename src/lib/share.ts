import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { tryCatchSync } from './try-catch';

const SHARE_KEY = 'c';

export type SharedSource =
    | { status: 'absent' }
    | { status: 'corrupt' }
    | { status: 'present'; source: string };

export function readSharedSource(): SharedSource {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const encoded = params.get(SHARE_KEY);
    if (!encoded) return { status: 'absent' };

    const { data } = tryCatchSync(function decode() {
        return decompressFromEncodedURIComponent(encoded);
    });

    if (!data) return { status: 'corrupt' };
    return { status: 'present', source: data };
}

export function buildShareUrl(source: string): string {
    const encoded = compressToEncodedURIComponent(source);
    const { origin, pathname } = window.location;
    return `${origin}${pathname}#${SHARE_KEY}=${encoded}`;
}

export function clearShareHash(): void {
    if (!window.location.hash) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
