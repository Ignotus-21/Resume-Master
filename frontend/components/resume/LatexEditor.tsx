import React, { useRef } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';

interface LatexEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  onRecompile: () => void;
  saving: boolean;
  isCompiling: boolean;
}

export function LatexEditor({ value, onChange, onRecompile, saving, isCompiling }: LatexEditorProps) {
  const handleEditorDidMount = (editor: any, monaco: any) => {
    // Add command for Cmd+S or Ctrl+S to save/recompile
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onRecompile();
    });
  };

  return (
    <div className="flex flex-col h-full border border-[#dadce0] rounded-xl overflow-hidden bg-white">
      <div className="flex justify-between items-center px-4 py-2 bg-[#f8f9fa] border-b border-[#dadce0]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#202124]">main.tex</span>
          {isCompiling && <span className="text-xs text-[#1a73e8] animate-pulse">Compiling...</span>}
        </div>
        <button
          onClick={onRecompile}
          disabled={saving || isCompiling}
          className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {saving || isCompiling ? (
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
             </svg>
          )}
          Recompile
        </button>
      </div>
      <div className="flex-1 min-h-0 relative">
        <Editor
          height="100%"
          defaultLanguage="latex"
          theme="light"
          value={value}
          onChange={onChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: "on",
            padding: { top: 16 },
            lineNumbers: "on",
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
}
