type PreviewPaneProps = {
    html: string;
    width: number;
    isDarkCanvas: boolean;
};

const DARK_CANVAS_STYLE = `<style>html{background:#0f1115 !important;color-scheme:dark;}</style>`;

function withCanvas(html: string, isDarkCanvas: boolean): string {
    if (!isDarkCanvas) return html;

    const headClose = html.toLowerCase().indexOf('</head>');
    if (headClose !== -1) {
        return html.slice(0, headClose) + DARK_CANVAS_STYLE + html.slice(headClose);
    }

    const bodyOpen = html.toLowerCase().indexOf('<body');
    if (bodyOpen === -1) return `${html}${DARK_CANVAS_STYLE}`;

    const bodyTagEnd = html.indexOf('>', bodyOpen);
    return html.slice(0, bodyTagEnd + 1) + DARK_CANVAS_STYLE + html.slice(bodyTagEnd + 1);
}

export function PreviewPane({ html, width, isDarkCanvas }: PreviewPaneProps) {
    return (
        <div className="preview-stage">
            <iframe
                className="preview-frame"
                title="Rendered output"
                style={{ width: `${width}px` }}
                srcDoc={withCanvas(html, isDarkCanvas)}
                sandbox=""
            />
        </div>
    );
}
