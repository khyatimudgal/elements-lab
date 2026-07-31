import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';

type CodeEditorProps = {
    value: string;
    onChange: (next: string) => void;
};

const EXTENSIONS = [
    javascript({ jsx: true, typescript: true }),
    // The editor pane is the narrowest of the three, so long attribute values
    // would otherwise scroll out of sight rather than reveal themselves.
    EditorView.lineWrapping,
];

const BASIC_SETUP = {
    lineNumbers: true,
    foldGutter: false,
    highlightActiveLine: false,
    highlightActiveLineGutter: false,
};

export function CodeEditor({ value, onChange }: CodeEditorProps) {
    return (
        <CodeMirror
            value={value}
            onChange={onChange}
            theme={oneDark}
            extensions={EXTENSIONS}
            height="100%"
            style={{ height: '100%', fontSize: '13px' }}
            basicSetup={BASIC_SETUP}
        />
    );
}
