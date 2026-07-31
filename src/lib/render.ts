import {
    Children,
    createElement,
    Fragment,
    isValidElement,
    type ReactElement,
    type ReactNode,
} from 'react';
import {
    Email,
    Page,
    Document,
    renderToHtml,
    renderToPlainText,
    renderToJson,
} from '@unlayer/react-elements';
import { tryCatchSync, type Result } from './try-catch';
import type { CompiledTemplate } from './compile';

export type RenderMode = 'email' | 'web' | 'document';

export const RENDER_MODES: ReadonlyArray<{ id: RenderMode; label: string; hint: string }> = [
    { id: 'email', label: 'Email', hint: 'Table-based XHTML, Outlook safe' },
    { id: 'web', label: 'Web', hint: 'Flexbox, responsive page' },
    { id: 'document', label: 'PDF', hint: 'Print-tuned, ready for paper' },
];

const WRAPPERS = { email: Email, web: Page, document: Document } as const;

export type RenderedHtml = {
    html: string;
    byteSize: number;
};

function isFragmentElement(node: ReactNode): node is ReactElement<{ children?: ReactNode }> {
    return isValidElement(node) && node.type === Fragment;
}

function toRows(Content: CompiledTemplate['Content']): ReactNode[] {
    const produced = Content({});
    if (produced instanceof Promise) {
        throw new Error('Async components are not supported in the playground.');
    }
    if (isFragmentElement(produced)) return Children.toArray(produced.props.children);
    return Children.toArray(produced);
}

function buildTree(template: CompiledTemplate, mode: RenderMode): ReactElement {
    return createElement(WRAPPERS[mode], template.config, ...toRows(template.Content));
}

export function renderHtml(template: CompiledTemplate, mode: RenderMode): Result<RenderedHtml> {
    return tryCatchSync(function run() {
        const html = renderToHtml(buildTree(template, mode));
        return { html, byteSize: new TextEncoder().encode(html).length };
    });
}

export function renderPlainText(template: CompiledTemplate, mode: RenderMode): Result<string> {
    return tryCatchSync(function run() {
        return renderToPlainText(buildTree(template, mode));
    });
}

export function renderDesignJson(template: CompiledTemplate, mode: RenderMode): Result<unknown> {
    return tryCatchSync(function run() {
        return renderToJson(buildTree(template, mode));
    });
}
