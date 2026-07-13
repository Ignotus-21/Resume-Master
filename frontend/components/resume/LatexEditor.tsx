import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Editor from '@monaco-editor/react';
import type { CompileError } from '@/lib/resumeSchema';

interface LatexEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  onRecompile: () => void;
  readOnly?: boolean;
  errors?: CompileError[];
  onEject?: () => void;
}

export interface LatexEditorHandle {
  /** Reveal a \section heading by its (rendered) title text. */
  scrollToSection: (title: string) => void;
}

// Monaco doesn't ship a LaTeX language — register a small Monarch tokenizer
// once so \commands, comments, math and braces highlight properly.
const registerLatex = (monaco: any) => {
  if (monaco.languages.getLanguages().some((l: any) => l.id === 'latex')) return;
  monaco.languages.register({ id: 'latex' });
  monaco.languages.setMonarchTokensProvider('latex', {
    defaultToken: '',
    tokenizer: {
      root: [
        [/%.*$/, 'comment'],
        [/\\(?:begin|end)\b/, 'keyword'],
        [/\\[a-zA-Z@]+\*?/, 'tag'],
        [/\\[^a-zA-Z@]/, 'string.escape'],
        [/\$\$?/, { token: 'string', next: '@math' }],
        [/[{}[\]]/, 'delimiter'],
        [/&/, 'delimiter'],
      ],
      math: [
        [/\$\$?/, { token: 'string', next: '@pop' }],
        [/\\[a-zA-Z@]+/, 'tag'],
        [/[^$\\]+/, 'string'],
        [/./, 'string'],
      ],
    },
  });
  monaco.languages.setLanguageConfiguration('latex', {
    comments: { lineComment: '%' },
    brackets: [['{', '}'], ['[', ']']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '$', close: '$' },
    ],
  });
};

export const LatexEditor = forwardRef<LatexEditorHandle, LatexEditorProps>(function LatexEditor(
  { value, onChange, onRecompile, readOnly = false, errors = [], onEject },
  ref
) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  // Keep the latest recompile callback without re-registering the command.
  const recompileRef = useRef(onRecompile);
  recompileRef.current = onRecompile;

  const handleEditorWillMount = (monaco: any) => {
    registerLatex(monaco);
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // Cmd/Ctrl+S = recompile (Overleaf muscle memory).
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      recompileRef.current();
    });
  };

  // Structured compile errors -> gutter markers.
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;
    const markers = (errors || [])
      .filter((e) => e.line !== null && e.line !== undefined)
      .map((e) => ({
        startLineNumber: Math.max(1, Math.min(e.line as number, model.getLineCount())),
        endLineNumber: Math.max(1, Math.min(e.line as number, model.getLineCount())),
        startColumn: 1,
        endColumn: model.getLineMaxColumn(Math.max(1, Math.min(e.line as number, model.getLineCount()))),
        message: e.message + (e.context ? `\n${e.context}` : ''),
        severity: e.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
      }));
    monaco.editor.setModelMarkers(model, 'latex-compile', markers);
  }, [errors, value]);

  // Outline navigation: reveal a \section heading by its title text.
  useImperativeHandle(ref, () => ({
    scrollToSection: (title: string) => {
      const editor = editorRef.current;
      const model = editor?.getModel();
      if (!editor || !model) return;
      const match = model.findNextMatch(title, { lineNumber: 1, column: 1 }, false, false, null, false);
      if (match) editor.revealLineNearTop(match.range.startLineNumber);
    },
  }));

  return (
    <div className="flex flex-col h-full border border-[#dadce0] rounded-xl overflow-hidden bg-white">
      {readOnly && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 text-sm">
          <span>
            This LaTeX is generated from your content. Eject to edit it directly.
          </span>
          {onEject && (
            <button
              onClick={onEject}
              className="shrink-0 border border-amber-400 text-amber-900 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-amber-100 transition"
            >
              Eject to LaTeX
            </button>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0 relative">
        <Editor
          height="100%"
          language="latex"
          theme="light"
          value={value}
          onChange={onChange}
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            padding: { top: 16 },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            renderValidationDecorations: 'on',
          }}
        />
      </div>
    </div>
  );
});
