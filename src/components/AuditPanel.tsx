import {
    CLIP_WARNING_PERCENT,
    GMAIL_CLIP_LABEL,
    formatKilobytes,
    plural,
    type AuditReport,
    type Finding,
    type FindingLevel,
} from '../lib/audit';

type AuditPanelProps = {
    report: AuditReport;
};

const LEVEL_ICON: Record<FindingLevel, string> = {
    error: '✕',
    warning: '!',
    pass: '✓',
};

function meterTone(clipPercent: number): FindingLevel {
    if (clipPercent >= 100) return 'error';
    if (clipPercent > CLIP_WARNING_PERCENT) return 'warning';
    return 'pass';
}

function summarise(report: AuditReport): { headline: string; tone: FindingLevel } {
    const { errorCount, warningCount } = report;
    if (errorCount > 0) {
        return {
            headline: `${errorCount} blocking ${plural(errorCount, 'issue', 'issues')}`,
            tone: 'error',
        };
    }
    if (warningCount > 0) {
        return {
            headline: `${warningCount} ${plural(warningCount, 'warning', 'warnings')}`,
            tone: 'warning',
        };
    }
    return { headline: 'All checks passed', tone: 'pass' };
}

function ClipMeter({ report }: AuditPanelProps) {
    const tone = meterTone(report.clipPercent);

    return (
        <div className="clip-meter">
            <div className="clip-meter__head">
                <span>Gmail clipping budget</span>
                <strong>
                    {formatKilobytes(report.byteSize)} / {GMAIL_CLIP_LABEL}
                </strong>
            </div>
            <div className="clip-meter__track">
                <div
                    className={`clip-meter__fill clip-meter__fill--${tone}`}
                    style={{ width: `${Math.max(2, report.clipPercent)}%` }}
                />
            </div>
        </div>
    );
}

function FindingRow({ finding }: { finding: Finding }) {
    return (
        <li className={`finding finding--${finding.level}`}>
            <span className="finding__icon">{LEVEL_ICON[finding.level]}</span>
            <div className="finding__body">
                <p className="finding__title">{finding.title}</p>
                <p className="finding__detail">{finding.detail}</p>
                {finding.context ? <code className="finding__context">{finding.context}</code> : null}
            </div>
        </li>
    );
}

export function AuditPanel({ report }: AuditPanelProps) {
    const { headline, tone } = summarise(report);

    return (
        <section className="audit">
            <header className="audit__head">
                <h2 className="eyebrow">Preflight</h2>
                <span className={`audit__badge audit__badge--${tone}`}>{headline}</span>
            </header>

            <ClipMeter report={report} />

            <ul className="audit__list">
                {report.findings.map(function renderFinding(finding) {
                    return <FindingRow key={finding.id} finding={finding} />;
                })}
            </ul>
        </section>
    );
}
