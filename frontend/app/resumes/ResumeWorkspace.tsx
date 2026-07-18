'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { saveAs } from 'file-saver';
import {
  Code2, Eye, Download, Loader2, Palette, LayoutGrid, BarChart3,
  Copy, Trash2, RefreshCw, PanelLeftClose, PanelLeftOpen, FileText, Pencil,
  Check, CloudOff, GitCompareArrows,
} from 'lucide-react';
import type { AutosaveState } from '@/lib/autosave';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/Modal';
import { LatexEditor, LatexEditorHandle } from '@/components/resume/LatexEditor';
import { PdfPane, PdfPaneHandle } from './PdfPane';
import { VisualEditor } from './VisualEditor';
import { DesignPanel } from './DesignPanel';
import { TemplateGallery } from './TemplateGallery';
import { MatchPanel } from '@/components/resume/MatchPanel';
import { VersionDiffModal } from './VersionDiff';
import { generateDocx } from './generateDocx';
import type { useWorkspace } from './useWorkspace';
import type { SectionKey, TemplateId } from '@/lib/resumeSchema';
import { DEFAULT_DESIGN, sectionTitle, sectionHasContent } from '@/lib/resumeSchema';

// The Overleaf-shaped shell: LEFT outline + version list, CENTER Visual|Code,
// RIGHT live PDF. Code|Visual is the architecture: structured docs generate
// their LaTeX (read-only until eject), ejected docs edit it directly.

type Workspace = ReturnType<typeof useWorkspace>;

const RIGHT_WIDTH_KEY = 'rm.rightPaneWidth';

export function ResumeWorkspace({ ws }: { ws: Workspace }) {
  const { showToast } = useToast();
  const {
    resumes, jobs, doc, selectResume, patchDoc, setContent, setDesign, setTemplateId, setLatexSource,
    pdfData, pages, tex, compileErrors, compileLog, isCompiling,
    autoCompile, setAutoCompile, compile,
    save, eject, revert, duplicate, remove,
    saveState, generating,
  } = ws;

  const [view, setView] = useState<'visual' | 'code'>('visual');
  const [railOpen, setRailOpen] = useState(true);
  const [sidePanel, setSidePanel] = useState<null | 'design' | 'templates' | 'feedback'>(null);
  const [showEject, setShowEject] = useState(false);
  const [showRevert, setShowRevert] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [compareTarget, setCompareTarget] = useState<string | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [rightWidth, setRightWidth] = useState(46); // % of the main area

  const pdfRef = useRef<PdfPaneHandle>(null);
  const editorRef = useRef<LatexEditorHandle>(null);
  const sectionEls = useRef(new Map<SectionKey, HTMLDivElement>());
  const mainRef = useRef<HTMLDivElement>(null);

  const isLatexMode = doc?.mode === 'latex';
  const design = doc?.design || DEFAULT_DESIGN;
  const errorCount = compileErrors.filter((e) => e.severity === 'error').length;
  const warningCount = compileErrors.length - errorCount;

  useEffect(() => {
    const stored = Number(localStorage.getItem(RIGHT_WIDTH_KEY));
    if (stored >= 25 && stored <= 70) setRightWidth(stored);
  }, []);

  // Ejected docs have no visual editor.
  useEffect(() => {
    if (isLatexMode) setView('code');
  }, [isLatexMode]);

  // --- divider drag ---------------------------------------------------------
  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const main = mainRef.current;
    if (!main) return;
    const onMove = (ev: MouseEvent) => {
      const rect = main.getBoundingClientRect();
      const pct = Math.min(70, Math.max(25, ((rect.right - ev.clientX) / rect.width) * 100));
      setRightWidth(pct);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setRightWidth((w) => {
        localStorage.setItem(RIGHT_WIDTH_KEY, String(Math.round(w)));
        return w;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // --- outline navigation ----------------------------------------------------
  const jumpToSection = (key: SectionKey) => {
    const title = sectionTitle(key, design);
    if (view === 'visual') {
      sectionEls.current.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      editorRef.current?.scrollToSection(title);
    }
    pdfRef.current?.scrollToText(title);
  };

  // --- downloads --------------------------------------------------------------
  const downloadPdf = () => {
    if (!pdfData) return showToast('PDF not ready yet', 'info');
    const bytes = Uint8Array.from(atob(pdfData), (c) => c.charCodeAt(0));
    saveAs(new Blob([bytes], { type: 'application/pdf' }), `${doc?.versionName || 'resume'}.pdf`);
  };

  const downloadDocx = async () => {
    if (!doc?.content) return showToast('No structured content for DOCX export', 'info');
    try {
      const blob = await generateDocx(doc.content, design);
      saveAs(blob, `${doc.versionName || 'resume'}.docx`);
    } catch (e) {
      console.error('DOCX generation failed', e);
      showToast('Failed to generate DOCX', 'error');
    }
  };

  const downloadTex = () => {
    const source = isLatexMode ? doc?.latexSource : tex;
    if (!source) return showToast('No LaTeX available yet', 'info');
    saveAs(new Blob([source], { type: 'text/x-tex' }), `${doc?.versionName || 'resume'}.tex`);
  };

  // --- page meter ---------------------------------------------------------------
  const bulletCount = (doc?.content?.experience || []).concat(doc?.content?.projects as any[] || [])
    .reduce((n, item: any) => n + (item?.bulletPoints?.length || 0), 0);
  const trimEstimate = pages && pages > 1 && bulletCount > 0
    ? Math.max(1, Math.ceil((bulletCount * (pages - 1)) / pages / 2))
    : 0;

  if (!doc && generating) {
    // Generation takes a few seconds (one Gemini call). First impressions
    // matter most right here, so show the shape of the workspace that is
    // about to appear — not a blank spinner page.
    return <WorkspaceSkeleton />;
  }

  if (!doc) {
    // Without this list an existing resume is unreachable after a tab close —
    // the Versions rail only renders once a document is open.
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-[#5f6368] bg-[#f8f9fa] rounded-xl border border-dashed border-[#dadce0] min-h-[400px] py-8">
        <FileText className="h-10 w-10 mb-2" />
        <p>{resumes.length > 0 ? 'Pick a version to continue editing, or generate a new one' : 'Generate a resume to get started'}</p>
        {resumes.length > 0 && (
          <div className="mt-4 w-full max-w-md space-y-1 overflow-y-auto max-h-72 px-4">
            {resumes.map((r) => (
              <button
                key={r._id}
                onClick={() => selectResume(r)}
                title={r.versionName}
                className="block w-full text-left text-sm px-3 py-2 rounded-lg border border-[#dadce0] bg-white hover:border-[#1a73e8] hover:text-[#1a73e8] truncate"
              >
                {r.versionName}
                {r.parentResumeId && <span className="ml-1 text-[10px] opacity-60">↳ fork</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 border border-[#dadce0] rounded-xl overflow-hidden bg-white">
      {/* ------------------------------------------------ top bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#f8f9fa] border-b border-[#dadce0] flex-wrap">
        <button onClick={() => setRailOpen(!railOpen)} className="p-1.5 text-[#5f6368] hover:text-[#202124]" title={railOpen ? 'Hide sidebar' : 'Show sidebar'}>
          {railOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>

        {/* Code | Visual */}
        <div className="flex bg-white border border-[#dadce0] rounded-lg p-0.5">
          <button
            onClick={() => !isLatexMode && setView('visual')}
            disabled={isLatexMode}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium transition ${view === 'visual' ? 'bg-[#1a73e8] text-white' : 'text-[#5f6368] hover:text-[#202124] disabled:opacity-40'}`}
            title={isLatexMode ? 'Ejected to LaTeX: visual editing disabled' : 'Visual editor'}
          >
            <Eye className="h-3.5 w-3.5" /> Visual
          </button>
          <button
            onClick={() => setView('code')}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium transition ${view === 'code' ? 'bg-[#1a73e8] text-white' : 'text-[#5f6368] hover:text-[#202124]'}`}
          >
            <Code2 className="h-3.5 w-3.5" /> Code
          </button>
        </div>

        {/* Recompile + auto */}
        <div className="flex items-center bg-white border border-[#dadce0] rounded-lg">
          <button onClick={() => compile()} disabled={isCompiling} className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-[#1e8e3e] hover:bg-green-50 rounded-l-lg disabled:opacity-50">
            {isCompiling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Recompile
          </button>
          <label className="flex items-center gap-1 px-2 py-1 text-xs text-[#5f6368] border-l border-[#dadce0] cursor-pointer select-none" title="Recompile automatically as you edit">
            <input type="checkbox" checked={autoCompile} onChange={(e) => setAutoCompile(e.target.checked)} />
            auto
          </label>
        </div>

        {/* Error badge */}
        {(errorCount > 0 || warningCount > 0) && (
          <button
            onClick={() => setView('code')}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${errorCount > 0 ? 'bg-[#d93025] text-white' : 'bg-amber-400 text-amber-950'}`}
            title={compileLog || 'Compile issues: open Code view for line markers'}
          >
            {errorCount > 0 ? errorCount : warningCount}
          </button>
        )}

        {/* Page meter */}
        {pages !== null && (
          <span className="text-xs text-[#5f6368]" title="Real page count from the compiled PDF">
            {pages} page{pages === 1 ? '' : 's'}
            {trimEstimate > 0 && ` (trim ~${trimEstimate} bullets to fit ${pages - 1})`}
          </span>
        )}

        <div className="flex-1" />

        {/* Right-side tools */}
        <button onClick={() => setSidePanel(sidePanel === 'design' ? null : 'design')} disabled={isLatexMode} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm ${sidePanel === 'design' ? 'bg-[#1a73e8] text-white' : 'text-[#5f6368] hover:text-[#202124]'} disabled:opacity-40`} title="Design tokens">
          <Palette className="h-4 w-4" /> Design
        </button>
        <button onClick={() => setSidePanel(sidePanel === 'templates' ? null : 'templates')} disabled={isLatexMode} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm ${sidePanel === 'templates' ? 'bg-[#1a73e8] text-white' : 'text-[#5f6368] hover:text-[#202124]'} disabled:opacity-40`} title="Template gallery">
          <LayoutGrid className="h-4 w-4" /> Templates
        </button>
        <button onClick={() => setSidePanel(sidePanel === 'feedback' ? null : 'feedback')} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm ${sidePanel === 'feedback' ? 'bg-[#1a73e8] text-white' : 'text-[#5f6368] hover:text-[#202124]'}`} title="JD match analysis">
          <BarChart3 className="h-4 w-4" /> Match
        </button>

        {/* Download */}
        <div className="relative">
          <button onClick={() => setDownloadOpen(!downloadOpen)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm text-[#5f6368] hover:text-[#202124]">
            <Download className="h-4 w-4" /> Download ▾
          </button>
          {downloadOpen && (
            <div className="absolute right-0 z-30 mt-1 w-36 bg-white border border-[#dadce0] rounded-xl shadow-xl py-1" onMouseLeave={() => setDownloadOpen(false)}>
              <button onClick={() => { downloadPdf(); setDownloadOpen(false); }} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-[#f8f9fa] text-[#202124]">PDF</button>
              <button onClick={() => { downloadDocx(); setDownloadOpen(false); }} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-[#f8f9fa] text-[#202124]">DOCX</button>
              <button onClick={() => { downloadTex(); setDownloadOpen(false); }} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-[#f8f9fa] text-[#202124]">.tex</button>
            </div>
          )}
        </div>

        {/* Autosave status / eject / revert */}
        <SaveStatus state={saveState} onSave={() => save()} />
        {isLatexMode ? (
          <button onClick={() => setShowRevert(true)} className="px-2.5 py-1 rounded-lg text-sm text-[#5f6368] border border-[#dadce0] hover:text-[#202124]" title="Back to the structured version">
            Revert to structured
          </button>
        ) : (
          <button onClick={() => setShowEject(true)} className="px-2.5 py-1 rounded-lg text-sm text-[#5f6368] border border-[#dadce0] hover:text-[#202124]" title="Edit the LaTeX directly (one-way for this version)">
            Eject to LaTeX
          </button>
        )}
      </div>

      {/* ------------------------------------------------ main area */}
      <div ref={mainRef} className="flex flex-1 min-h-0">
        {/* LEFT rail */}
        {railOpen && (
          <div className="w-56 shrink-0 border-r border-[#dadce0] flex flex-col min-h-0 bg-[#fbfbfc]">
            {/* Title */}
            <div className="p-3 border-b border-[#dadce0]">
              {editingTitle ? (
                <input
                  autoFocus
                  className="w-full text-sm font-semibold border border-[#dadce0] rounded px-1.5 py-0.5"
                  value={doc.versionName || ''}
                  onChange={(e) => patchDoc({ versionName: e.target.value })}
                  onBlur={() => { setEditingTitle(false); save(); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setEditingTitle(false); save(); } }}
                />
              ) : (
                <button onClick={() => setEditingTitle(true)} className="flex items-center gap-1 w-full text-left group" title={doc.versionName}>
                  <span className="text-sm font-semibold text-[#202124] truncate">{doc.versionName}</span>
                  <Pencil className="h-3 w-3 text-[#5f6368] opacity-0 group-hover:opacity-100 shrink-0" />
                </button>
              )}
              {isLatexMode && <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">ejected · LaTeX</span>}
            </div>

            {/* Outline */}
            <div className="p-3 border-b border-[#dadce0]">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#5f6368] mb-1.5">Outline</div>
              {design.sectionOrder
                .filter((k) => !design.hiddenSections.includes(k) && sectionHasContent(k, doc.content))
                .map((key) => (
                  <button key={key} onClick={() => jumpToSection(key)} className="block w-full text-left text-sm text-[#5f6368] hover:text-[#1a73e8] py-0.5 truncate">
                    {sectionTitle(key, design)}
                  </button>
                ))}
            </div>

            {/* Versions */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#5f6368] mb-1.5">Versions</div>
              {resumes.map((r) => (
                <div key={r._id} className={`group flex items-center gap-1 rounded-lg px-2 py-1 mb-0.5 ${r._id === doc._id ? 'bg-blue-50 text-[#1a73e8]' : 'text-[#5f6368] hover:bg-[#f1f3f4]'}`}>
                  <button onClick={() => selectResume(r)} className="flex-1 text-left text-xs truncate" title={r.versionName}>
                    {r.versionName}
                    {r.parentResumeId && <span className="ml-1 text-[9px] opacity-60">↳ fork</span>}
                  </button>
                  {r._id !== doc._id && (
                    <button onClick={() => setCompareTarget(r._id)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-[#202124]" title="Compare with the open version">
                      <GitCompareArrows className="h-3 w-3" />
                    </button>
                  )}
                  <button onClick={() => duplicate(r._id)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-[#202124]" title="Duplicate">
                    <Copy className="h-3 w-3" />
                  </button>
                  <button onClick={() => setPendingDelete(r._id)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-[#d93025]" title="Delete">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CENTER pane */}
        <div className="flex-1 min-w-0 min-h-0" style={{ width: `${100 - rightWidth}%` }}>
          {view === 'visual' && !isLatexMode ? (
            <VisualEditor
              content={doc.content || {}}
              design={design}
              setContent={setContent}
              setDesign={setDesign}
              jd={(doc.job as any)?.jdText}
              onSectionRef={(key, el) => {
                if (el) sectionEls.current.set(key, el);
                else sectionEls.current.delete(key);
              }}
            />
          ) : (
            <LatexEditor
              ref={editorRef}
              value={isLatexMode ? (doc.latexSource || '') : tex}
              onChange={(v) => isLatexMode && setLatexSource(v || '')}
              onRecompile={() => compile()}
              readOnly={!isLatexMode}
              errors={compileErrors}
              onEject={() => setShowEject(true)}
            />
          )}
        </div>

        {/* divider */}
        <div onMouseDown={startDrag} className="w-1.5 shrink-0 cursor-col-resize bg-[#e8eaed] hover:bg-[#1a73e8]/40 transition-colors" title="Drag to resize" />

        {/* RIGHT pane: PDF or a tool panel over it */}
        <div className="shrink-0 min-h-0 relative border-l border-[#dadce0]" style={{ width: `${rightWidth}%` }}>
          <PdfPane
            ref={pdfRef}
            pdfData={pdfData}
            isCompiling={isCompiling}
            compileError={compileLog}
            errors={compileErrors}
            pages={pages ?? undefined}
          />
          {sidePanel && (
            <div className="absolute inset-0 bg-white overflow-y-auto z-10 border-l border-[#dadce0]">
              <div className="flex justify-between items-center px-4 pt-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#5f6368]">{sidePanel}</span>
                <button onClick={() => setSidePanel(null)} className="text-[#5f6368] hover:text-[#202124] text-lg leading-none">×</button>
              </div>
              {sidePanel === 'design' && <DesignPanel design={design} setDesign={setDesign} />}
              {sidePanel === 'templates' && (
                <TemplateGallery
                  content={doc.content || {}}
                  design={design}
                  activeTemplate={(doc.templateId as TemplateId) || 'sheets'}
                  onPick={(t) => { setTemplateId(t); setSidePanel(null); }}
                />
              )}
              {sidePanel === 'feedback' && (
                <div className="p-4">
                  <MatchPanel jobs={jobs} defaultJobId={(doc.job as any)?._id} autoRun />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------ modals */}
      <ConfirmModal
        open={showEject}
        title="Eject to LaTeX?"
        message="You'll be editing LaTeX directly. The visual editor and AI tailoring won't be available for this version. Your structured version is kept, so you can revert anytime."
        onConfirm={() => { setShowEject(false); eject(); }}
        onCancel={() => setShowEject(false)}
      />
      <ConfirmModal
        open={showRevert}
        title="Revert to structured?"
        message="This restores the visual editor from your saved content and design. Your hand-written LaTeX edits for this version will be discarded."
        onConfirm={() => { setShowRevert(false); revert(); }}
        onCancel={() => setShowRevert(false)}
      />
      <VersionDiffModal targetId={compareTarget} currentDoc={doc} onClose={() => setCompareTarget(null)} />
      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete resume"
        message="Are you sure you want to delete this resume? This can't be undone."
        onConfirm={() => { if (pendingDelete) remove(pendingDelete); setPendingDelete(null); }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

// The three-pane workspace, as pulsing placeholders, while the tailored
// content is being generated. Mirrors the real layout (left rail, center
// editor, right PDF page) so the transition to the loaded workspace is a
// fill-in, not a layout jump.
function WorkspaceSkeleton() {
  const line = (w: string) => <div className={`h-3 rounded bg-[#e8eaed] animate-pulse ${w}`} />;
  return (
    <div className="flex flex-col flex-1 min-h-0 border border-[#dadce0] rounded-xl overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[#f8f9fa] border-b border-[#dadce0]">
        <div className="h-6 w-40 rounded-lg bg-[#e8eaed] animate-pulse" />
        <div className="h-6 w-28 rounded-lg bg-[#e8eaed] animate-pulse" />
        <div className="flex-1" />
        <span className="flex items-center gap-2 text-sm font-medium text-[#1a73e8]">
          <Loader2 className="h-4 w-4 animate-spin" /> Tailoring your resume…
        </span>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-56 shrink-0 border-r border-[#dadce0] p-4 space-y-3 bg-[#fbfbfc]">
          {line('w-3/4')}{line('w-1/2')}{line('w-2/3')}{line('w-1/2')}{line('w-3/5')}
        </div>
        <div className="flex-1 p-8 space-y-4">
          <div className="h-6 w-1/3 rounded bg-[#e8eaed] animate-pulse" />
          {line('w-full')}{line('w-5/6')}{line('w-2/3')}
          <div className="h-5 w-1/4 rounded bg-[#e8eaed] animate-pulse mt-6" />
          {line('w-full')}{line('w-4/5')}{line('w-3/4')}
        </div>
        <div className="w-[46%] shrink-0 border-l border-[#dadce0] bg-[#e8eaed] p-6 flex flex-col items-center">
          <div className="w-full max-w-md aspect-[8.5/11] bg-white shadow-md rounded-sm p-8 space-y-3">
            <div className="h-5 w-1/2 mx-auto rounded bg-[#f1f3f4] animate-pulse" />
            <div className="h-3 w-2/3 mx-auto rounded bg-[#f1f3f4] animate-pulse" />
            <div className="pt-4 space-y-2.5">
              {['w-full', 'w-11/12', 'w-full', 'w-4/5', 'w-full', 'w-5/6', 'w-3/4'].map((w, i) => (
                <div key={i} className={`h-2.5 rounded bg-[#f1f3f4] animate-pulse ${w}`} />
              ))}
            </div>
          </div>
          <p className="text-xs text-[#5f6368] mt-4">The preview compiles as soon as your content is ready.</p>
        </div>
      </div>
    </div>
  );
}

// Small trust-signal chip for the autosave lifecycle. Clicking it forces a
// save (useful in 'pending' and mandatory UX in 'failed'); otherwise it's
// purely informational.
function SaveStatus({ state, onSave }: { state: AutosaveState; onSave: () => void }) {
  if (state === 'failed') {
    return (
      <button
        onClick={onSave}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#d93025] text-white hover:opacity-90"
        title="Automatic saving failed repeatedly. Your changes are kept in this tab, click to retry."
      >
        <CloudOff className="h-3.5 w-3.5" /> Save failed, retry
      </button>
    );
  }
  const view = {
    saved: { label: 'Saved', cls: 'text-[#5f6368]', icon: <Check className="h-3.5 w-3.5 text-[#1e8e3e]" /> },
    pending: { label: 'Unsaved changes', cls: 'text-[#5f6368]', icon: <span className="h-2 w-2 rounded-full bg-[#f9ab00]" /> },
    saving: { label: 'Saving…', cls: 'text-[#5f6368]', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
    retrying: { label: 'Save failed, retrying…', cls: 'text-amber-700', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  }[state];
  return (
    <button
      onClick={onSave}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${view.cls} hover:bg-[#f1f3f4]`}
      title="Changes save automatically. Click to save now."
    >
      {view.icon} {view.label}
    </button>
  );
}
