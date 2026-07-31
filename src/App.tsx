import { useEffect, useMemo, useState } from 'react';
import { CodeEditor } from './components/CodeEditor';
import { PreviewPane } from './components/PreviewPane';
import { AuditPanel } from './components/AuditPanel';
import { compileTemplate } from './lib/compile';
import {
    renderHtml,
    renderPlainText,
    renderDesignJson,
    RENDER_MODES,
    type RenderMode,
} from './lib/render';
import { auditEmail } from './lib/audit';
import { PRESETS, DEFAULT_SOURCE } from './lib/presets';
import { buildShareUrl, clearShareHash, readSharedSource } from './lib/share';
import { tryCatch, tryCatchSync } from './lib/try-catch';
import { formatKilobytes } from './lib/audit';
import './App.css';

const DEBOUNCE_MS = 250;
const SHARE_RESET_MS = 1600;
const SHARED = readSharedSource();

const VIEWPORTS = [
    { label: 'Desktop', width: 680 },
    { label: 'Mobile 320', width: 320 },
] as const;

type OutputTab = 'preview' | 'html' | 'text' | 'json';

const OUTPUT_TABS: ReadonlyArray<{ id: OutputTab; label: string }> = [
    { id: 'preview', label: 'Preview' },
    { id: 'html', label: 'HTML' },
    { id: 'text', label: 'Plain text' },
    { id: 'json', label: 'Design JSON' },
];

function download(filename: string, contents: string, mimeType: string): void {
    const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function release() {
        URL.revokeObjectURL(url);
    }, 30_000);
}

export function App() {
    const [pendingShared, setPendingShared] = useState(SHARED.status === 'present');
    const [source, setSource] = useState(
        SHARED.status === 'present' ? SHARED.source : DEFAULT_SOURCE
    );
    const [debouncedSource, setDebouncedSource] = useState(source);
    const [mode, setMode] = useState<RenderMode>('email');
    const [viewportWidth, setViewportWidth] = useState<number>(VIEWPORTS[0].width);
    const [isDarkCanvas, setIsDarkCanvas] = useState(false);
    const [tab, setTab] = useState<OutputTab>('preview');
    const [shareLabel, setShareLabel] = useState('Share');

    useEffect(
        function debounceSource() {
            const timer = setTimeout(function apply() {
                setDebouncedSource(source);
            }, DEBOUNCE_MS);
            return function cancel() {
                clearTimeout(timer);
            };
        },
        [source]
    );

    const compiled = useMemo(
        function compile() {
            return pendingShared ? null : compileTemplate(debouncedSource);
        },
        [debouncedSource, pendingShared]
    );

    const emailResult = useMemo(
        function renderEmail() {
            return compiled?.data ? renderHtml(compiled.data, 'email') : null;
        },
        [compiled]
    );

    const activeResult = useMemo(
        function renderActive() {
            if (!compiled?.data) return null;
            return mode === 'email' ? emailResult : renderHtml(compiled.data, mode);
        },
        [compiled, mode, emailResult]
    );

    const report = useMemo(
        function runAudit() {
            if (!emailResult?.data) return null;
            const { html, byteSize } = emailResult.data;
            return tryCatchSync(function audit() {
                return auditEmail(html, byteSize);
            });
        },
        [emailResult]
    );

    const plainText = useMemo(
        function renderText() {
            if (tab !== 'text' || !compiled?.data) return null;
            return renderPlainText(compiled.data, mode);
        },
        [tab, compiled, mode]
    );

    const designJson = useMemo(
        function renderJson() {
            if (tab !== 'json' || !compiled?.data) return null;
            return renderDesignJson(compiled.data, mode);
        },
        [tab, compiled, mode]
    );

    const renderError =
        compiled?.error ?? activeResult?.error ?? plainText?.error ?? designJson?.error ?? null;

    const active = activeResult?.data ?? null;

    function describeMissingAudit(): string {
        if (pendingShared) return 'Run the shared template to see the audit.';
        if (compiled?.error) return 'The audit runs once your template compiles.';
        if (emailResult?.error) {
            return `The email render failed, so the audit could not run: ${emailResult.error.message}`;
        }
        if (report?.error) return `The audit could not run: ${report.error.message}`;
        return 'Run a template to see the audit.';
    }

    const auditUnavailableReason = describeMissingAudit();

    useEffect(
        function resetShareLabel() {
            if (shareLabel === 'Share') return;
            const timer = setTimeout(function reset() {
                setShareLabel('Share');
            }, SHARE_RESET_MS);
            return function cancel() {
                clearTimeout(timer);
            };
        },
        [shareLabel]
    );

    async function handleShare() {
        const url = buildShareUrl(source);
        window.history.replaceState(null, '', url);
        const { error } = await tryCatch(
            (async function copy() {
                await navigator.clipboard.writeText(url);
            })()
        );
        setShareLabel(error ? 'Copy failed' : 'Link copied');
    }

    function handleSourceChange(next: string) {
        clearShareHash();
        setSource(next);
    }

    function loadPreset(presetSource: string) {
        clearShareHash();
        setPendingShared(false);
        setSource(presetSource);
    }

    return (
        <div className="app">
            <header className="topbar">
                <div className="topbar__brand">
                    <svg
                        className="topbar__mark"
                        width="26"
                        height="26"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <rect
                            x="1.5"
                            y="1.5"
                            width="14"
                            height="14"
                            rx="3.5"
                            fill="#ff5a5f"
                            opacity="0.34"
                        />
                        <rect x="8.5" y="8.5" width="14" height="14" rx="3.5" fill="#ff5a5f" />
                    </svg>
                    <div>
                        <h1>Elements Lab</h1>
                        <p>Email, web and PDF from one component tree, with a preflight audit</p>
                    </div>
                </div>
                <div className="topbar__actions">
                    {PRESETS.map(function renderPreset(preset) {
                        return (
                            <button
                                key={preset.id}
                                type="button"
                                className="chip"
                                title={preset.blurb}
                                onClick={function load() {
                                    loadPreset(preset.source);
                                }}
                            >
                                {preset.label}
                            </button>
                        );
                    })}
                    <button type="button" className="chip chip--primary" onClick={handleShare}>
                        {shareLabel}
                    </button>
                </div>
            </header>

            <main className="workspace">
                <section className="pane pane--editor">
                    <div className="pane__head">
                        <span className="eyebrow">Content.tsx</span>
                        <span className="pane__hint">
                            default export renders into all three wrappers
                        </span>
                    </div>
                    <div className="pane__body">
                        <CodeEditor value={source} onChange={handleSourceChange} />
                    </div>
                </section>

                <section className="pane pane--output">
                    <div className="pane__head pane__head--tabs">
                        <div className="modes" role="tablist" aria-label="Render target">
                            {RENDER_MODES.map(function renderModeTab(entry) {
                                return (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={mode === entry.id}
                                        title={entry.hint}
                                        className={`mode ${mode === entry.id ? 'mode--active' : ''}`}
                                        onClick={function select() {
                                            setMode(entry.id);
                                        }}
                                    >
                                        {entry.label}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="toggles">
                            {VIEWPORTS.map(function renderViewport(entry) {
                                return (
                                    <button
                                        key={entry.label}
                                        type="button"
                                        aria-pressed={viewportWidth === entry.width}
                                        className={`toggle ${viewportWidth === entry.width ? 'toggle--active' : ''}`}
                                        onClick={function select() {
                                            setViewportWidth(entry.width);
                                        }}
                                    >
                                        {entry.label}
                                    </button>
                                );
                            })}
                            <button
                                type="button"
                                aria-pressed={isDarkCanvas}
                                className={`toggle ${isDarkCanvas ? 'toggle--active' : ''}`}
                                onClick={function toggleCanvas() {
                                    setIsDarkCanvas(!isDarkCanvas);
                                }}
                            >
                                Dark canvas
                            </button>
                        </div>
                    </div>

                    <div className="subtabs" role="tablist" aria-label="Output format">
                        {OUTPUT_TABS.map(function renderTab(entry) {
                            return (
                                <button
                                    key={entry.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === entry.id}
                                    className={`subtab ${tab === entry.id ? 'subtab--active' : ''}`}
                                    onClick={function select() {
                                        setTab(entry.id);
                                    }}
                                >
                                    {entry.label}
                                </button>
                            );
                        })}
                        <span className="subtabs__spacer" />
                        {active ? (
                            <>
                                <span className="bytes">{formatKilobytes(active.byteSize)}</span>
                                <button
                                    type="button"
                                    className="chip"
                                    onClick={function saveHtml() {
                                        download(`${mode}.html`, active.html, 'text/html');
                                    }}
                                >
                                    Download HTML
                                </button>
                            </>
                        ) : null}
                    </div>

                    <div className="pane__body pane__body--output">
                        {SHARED.status === 'corrupt' && !pendingShared ? (
                            <div className="share-gate">
                                <h2>That share link could not be read</h2>
                                <p>
                                    The <code>#c=</code> payload was truncated or malformed. Chat
                                    clients often wrap long links. Ask the sender for it again. The
                                    default template is loaded below.
                                </p>
                            </div>
                        ) : null}

                        {pendingShared ? (
                            <div className="share-gate">
                                <h2>This link contains a shared template</h2>
                                <p>
                                    Elements Lab runs template code in your browser. Code from a
                                    link you did not write is untrusted, so read it in the editor on
                                    the left before you run it.
                                </p>
                                <button
                                    type="button"
                                    className="chip chip--primary"
                                    onClick={function runShared() {
                                        setPendingShared(false);
                                    }}
                                >
                                    Run this template
                                </button>
                                <button
                                    type="button"
                                    className="chip"
                                    onClick={function discardShared() {
                                        loadPreset(DEFAULT_SOURCE);
                                    }}
                                >
                                    Discard and start fresh
                                </button>
                            </div>
                        ) : null}

                        {renderError ? (
                            <pre className="error-block">{renderError.message}</pre>
                        ) : null}

                        {!renderError && active && tab === 'preview' ? (
                            <PreviewPane
                                html={active.html}
                                width={viewportWidth}
                                isDarkCanvas={isDarkCanvas}
                            />
                        ) : null}

                        {!renderError && active && tab === 'html' ? (
                            <pre className="code-block">{active.html}</pre>
                        ) : null}

                        {!renderError && tab === 'text' && plainText?.data ? (
                            <pre className="code-block">{plainText.data}</pre>
                        ) : null}

                        {!renderError && tab === 'json' && designJson?.data ? (
                            <pre className="code-block">
                                {JSON.stringify(designJson.data, null, 2)}
                            </pre>
                        ) : null}
                    </div>
                </section>

                <aside className="pane pane--audit">
                    {report?.data ? (
                        <AuditPanel report={report.data} />
                    ) : (
                        <div className="audit audit--empty">
                            <h2 className="eyebrow">Preflight</h2>
                            <p>{auditUnavailableReason}</p>
                        </div>
                    )}
                </aside>
            </main>
        </div>
    );
}
