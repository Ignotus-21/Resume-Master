'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, apiJson } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { createAutosaver, type Autosaver, type AutosaveState } from '@/lib/autosave';
import type { ResumeDocument, ResumeContent, DesignTokens, TemplateId, CompileError } from '@/lib/resumeSchema';
import { DEFAULT_DESIGN } from '@/lib/resumeSchema';

// All data/API state for the resume workspace: list + job fetching,
// generation, the compile pipeline (debounced, cancellable, cache-friendly),
// saving (autosave with retry), eject/revert, duplication and feedback. Pure
// UI state stays in the components.

const AUTO_COMPILE_KEY = 'rm.autoCompile';
const COMPILE_DEBOUNCE_MS = 800;
// Deliberately a separate debounce from COMPILE_DEBOUNCE_MS: how often the
// preview refreshes and how often work is persisted are unrelated concerns.
const AUTOSAVE_DEBOUNCE_MS = 1500;

export function useWorkspace(preSelectedJobId: string | null) {
  const { showToast } = useToast();

  const [resumes, setResumes] = useState<ResumeDocument[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState(preSelectedJobId || '');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // The open document (editable working copy).
  const [doc, setDoc] = useState<ResumeDocument | null>(null);
  // Autosave state drives the top-bar indicator; `dirty` is derived from it.
  const [saveState, setSaveState] = useState<AutosaveState>('saved');
  const dirty = saveState !== 'saved';
  const autosaveRef = useRef<Autosaver | null>(null);
  // The autosaver reads the document through this ref at save time, so a
  // retry after more edits always persists the LATEST state, never a stale
  // snapshot captured when the save was first scheduled.
  const docRef = useRef<ResumeDocument | null>(null);
  useEffect(() => {
    docRef.current = doc;
  });

  // Compile state
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [tex, setTex] = useState<string>(''); // what the code pane shows
  const [compileErrors, setCompileErrors] = useState<CompileError[]>([]);
  const [compileLog, setCompileLog] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [autoCompile, setAutoCompileState] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const compileSeqRef = useRef(0);

  useEffect(() => {
    setAutoCompileState(localStorage.getItem(AUTO_COMPILE_KEY) !== 'off');
  }, []);

  const setAutoCompile = (on: boolean) => {
    setAutoCompileState(on);
    localStorage.setItem(AUTO_COMPILE_KEY, on ? 'on' : 'off');
  };

  const fetchResumes = useCallback(async (filterJobId = '') => {
    try {
      const url = filterJobId ? `/api/resumes?jobId=${filterJobId}` : '/api/resumes';
      setResumes(await apiFetch(url));
    } catch (error: any) {
      showToast(error.message || 'Failed to load resumes', 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      setJobs(await apiFetch('/api/jobs'));
    } catch (error: any) {
      showToast(error.message || 'Failed to load jobs', 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Master Profile snapshot: the entry screens branch on whether it has any
  // content yet (import onboarding vs. straight to generate).
  const [profile, setProfile] = useState<any>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const refreshProfile = useCallback(async () => {
    try {
      setProfile(await apiFetch('/api/master'));
    } catch {
      // Non-fatal: entry screens just behave as if the profile were empty.
    } finally {
      setProfileLoaded(true);
    }
  }, []);
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    fetchResumes(selectedJobId);
    fetchJobs();
  }, [selectedJobId, fetchResumes, fetchJobs]);

  useEffect(() => {
    if (preSelectedJobId) setSelectedJobId(preSelectedJobId);
  }, [preSelectedJobId]);

  // --- selection ------------------------------------------------------------

  const selectResume = useCallback(async (r: ResumeDocument | null) => {
    // Persist any pending edits on the outgoing document before switching —
    // the autosaver still points at it until the new one loads.
    await autosaveRef.current?.flush().catch(() => {});
    setCompileErrors([]);
    setCompileLog(null);
    setPdfData(null);
    setPages(null);
    if (!r) {
      setDoc(null);
      setTex('');
      return;
    }
    try {
      // Single-resume GET returns the derived `latex` and normalizes legacy rows.
      const full: ResumeDocument = await apiFetch(`/api/resumes/${r._id}`);
      if (!full.design) full.design = { ...DEFAULT_DESIGN };
      setDoc(full);
      setTex(full.mode === 'latex' ? (full.latexSource || full.latex || '') : (full.latex || ''));
    } catch (error: any) {
      showToast(error.message || 'Failed to open resume', 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- editing --------------------------------------------------------------

  const patchDoc = useCallback((patch: Partial<ResumeDocument>) => {
    setDoc((d) => (d ? { ...d, ...patch } : d));
    autosaveRef.current?.notifyChange();
  }, []);

  const setContent = useCallback((updater: (c: ResumeContent) => ResumeContent) => {
    setDoc((d) => (d ? { ...d, content: updater(d.content || {}) } : d));
    autosaveRef.current?.notifyChange();
  }, []);

  const setDesign = useCallback((patch: Partial<DesignTokens>) => {
    setDoc((d) => (d ? { ...d, design: { ...(d.design || DEFAULT_DESIGN), ...patch } } : d));
    autosaveRef.current?.notifyChange();
  }, []);

  const setTemplateId = useCallback((templateId: TemplateId) => patchDoc({ templateId }), [patchDoc]);
  const setLatexSource = useCallback((latexSource: string) => {
    setDoc((d) => (d ? { ...d, latexSource } : d));
    setTex(latexSource);
    autosaveRef.current?.notifyChange();
  }, []);

  // --- compile --------------------------------------------------------------

  const compile = useCallback(async (target?: ResumeDocument) => {
    const d = target || doc;
    if (!d) return;

    const body =
      d.mode === 'latex'
        ? { latexCode: d.latexSource || '' }
        : { content: d.content, design: d.design, templateId: d.templateId };
    if (d.mode === 'latex' && !d.latexSource) return;
    if (d.mode !== 'latex' && !d.content) return;

    // Cancel the in-flight compile; guard with a sequence number so an older
    // response can never overwrite a newer preview.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const seq = ++compileSeqRef.current;

    setIsCompiling(true);
    try {
      const data = await apiFetch('/api/resumes/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (seq !== compileSeqRef.current) return;
      if (data.success) {
        setPdfData(data.pdf);
        setPages(data.pages ?? null);
        if (data.tex) setTex(data.tex);
        setCompileErrors([]);
        setCompileLog(null);
      } else {
        setCompileErrors(data.errors || []);
        setCompileLog(data.log || data.error || 'Unknown compilation error');
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      if (seq !== compileSeqRef.current) return;
      console.error('Compilation error:', error);
      setCompileLog(error.message || 'Failed to reach the compile server');
    } finally {
      if (seq === compileSeqRef.current) setIsCompiling(false);
    }
  }, [doc]);

  // Debounced auto-compile on any change to what the document renders from.
  const compileKey = doc
    ? doc.mode === 'latex'
      ? `latex:${doc._id}:${doc.latexSource}`
      : `ir:${doc._id}:${doc.templateId}:${JSON.stringify(doc.content)}:${JSON.stringify(doc.design)}`
    : null;

  useEffect(() => {
    if (!doc || !autoCompile || compileKey === null) return;
    const timer = setTimeout(() => compile(), COMPILE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compileKey, autoCompile]);

  // --- persistence (autosave) -------------------------------------------------

  // The actual network save. Reads the document from docRef (latest state at
  // call time) and sends baseUpdatedAt so the server can detect that another
  // tab/session wrote this resume since we loaded it (last-write-wins, but
  // surfaced instead of silent).
  const performSave = useCallback(async () => {
    const d = docRef.current;
    if (!d) return;
    const payload: any = { versionName: d.versionName, baseUpdatedAt: d.updatedAt };
    if (d.mode === 'latex') {
      payload.latexSource = d.latexSource;
    } else {
      payload.content = d.content;
      payload.design = d.design;
      payload.templateId = d.templateId;
    }
    const updated: ResumeDocument & { conflict?: boolean } =
      await apiJson(`/api/resumes/${d._id}`, 'PUT', payload);
    if (updated.conflict) {
      showToast(
        'This resume was also edited in another tab or session — that version has been overwritten by this one.',
        'info'
      );
    }
    // Merge only server-authoritative fields. Replacing the whole doc would
    // clobber keystrokes typed while this request was in flight; those edits
    // stay local and the autosaver persists them on its next pass.
    setDoc((cur) => (cur && cur._id === updated._id ? { ...cur, updatedAt: updated.updatedAt } : cur));
    setResumes((prev) =>
      prev.map((r) =>
        r._id === updated._id ? { ...r, versionName: updated.versionName, updatedAt: updated.updatedAt } : r
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One autosaver per open document.
  const docId = doc?._id || null;
  useEffect(() => {
    if (!docId) {
      setSaveState('saved');
      return;
    }
    const saver = createAutosaver({
      save: performSave,
      debounceMs: AUTOSAVE_DEBOUNCE_MS,
      onStateChange: setSaveState,
    });
    autosaveRef.current = saver;
    setSaveState('saved');
    return () => {
      saver.dispose();
      if (autosaveRef.current === saver) autosaveRef.current = null;
    };
  }, [docId, performSave]);

  // The tab must not close silently while edits exist only in this tab's
  // memory — that's the one way autosave can still lose work.
  const saveStateRef = useRef(saveState);
  useEffect(() => {
    saveStateRef.current = saveState;
  });
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStateRef.current !== 'saved') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Manual save (top-bar chip, title blur): force the autosaver to persist
  // everything now instead of waiting out the debounce.
  const save = useCallback(async () => {
    const saver = autosaveRef.current;
    if (!saver) return null;
    const ok = await saver.flush();
    if (!ok) {
      showToast('Save failed — your changes are kept in this tab and will be retried.', 'error');
      return null;
    }
    return docRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eject = useCallback(async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const updated: ResumeDocument = await apiJson(`/api/resumes/${doc._id}`, 'PUT', {
        // Persist any unsaved structured edits first, then flip the mode —
        // the server freezes the render of exactly this content.
        content: doc.content,
        design: doc.design,
        templateId: doc.templateId,
        mode: 'latex',
      });
      setResumes((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
      setDoc(updated);
      setTex(updated.latexSource || '');
      // This request already persisted the full document — nothing pending.
      autosaveRef.current?.markClean();
      showToast('Ejected to LaTeX. The visual editor is disabled for this version.', 'info');
    } catch (error: any) {
      showToast(error.message || 'Failed to eject', 'error');
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  const revert = useCallback(async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const updated: ResumeDocument = await apiJson(`/api/resumes/${doc._id}`, 'PUT', { mode: 'structured' });
      setResumes((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
      setDoc(updated);
      setTex(updated.latex || '');
      autosaveRef.current?.markClean();
      showToast('Reverted to the structured version. LaTeX edits were discarded.', 'info');
    } catch (error: any) {
      showToast(error.message || 'Failed to revert', 'error');
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  const duplicate = useCallback(async (id: string) => {
    try {
      const copy: ResumeDocument = await apiJson(`/api/resumes/${id}/duplicate`, 'POST', {});
      setResumes((prev) => [copy, ...prev]);
      await selectResume(copy);
      showToast('Duplicated. You are now editing the copy.', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to duplicate', 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectResume]);

  // Three entry paths, mirroring the backend: a saved job, a pasted JD (the
  // Job record is created server-side, behind the scenes), or neither — an
  // instant untailored base resume from the Master Profile (no AI call).
  const generate = useCallback(async (
    templateId: string,
    source: { jobId?: string; jdText?: string } = {}
  ) => {
    setGenerating(true);
    try {
      const data: ResumeDocument = await apiJson('/api/resumes/generate', 'POST', {
        ...(source.jobId ? { jobId: source.jobId } : {}),
        ...(source.jdText ? { jdText: source.jdText } : {}),
        templateId,
      });
      setResumes((prev) => [data, ...prev]);
      await selectResume(data);
      if (source.jdText) {
        // The backend created a Job from the pasted JD — pick up its name.
        fetchJobs();
        const job: any = data.job;
        if (job?.role) showToast(`Added "${job.role}${job.company ? ` at ${job.company}` : ''}" to your job tracker.`, 'success');
      }
      return data;
    } catch (error: any) {
      console.error('Error generating resume:', error);
      showToast(error.message || 'Failed to generate. Ensure Gemini Key is set.', 'error');
      return null;
    } finally {
      setGenerating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectResume, fetchJobs]);

  const remove = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/resumes/${id}`, { method: 'DELETE' });
      setResumes((prev) => prev.filter((r) => r._id !== id));
      if (doc?._id === id) await selectResume(null);
      showToast('Resume deleted', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete resume', 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, selectResume]);

  return {
    resumes, jobs,
    profile, profileLoaded, refreshProfile,
    selectedJobId, setSelectedJobId,
    generating, saving, dirty, saveState,
    doc, selectResume, patchDoc, setContent, setDesign, setTemplateId, setLatexSource,
    pdfData, pages, tex, compileErrors, compileLog, isCompiling,
    autoCompile, setAutoCompile, compile,
    save, eject, revert, duplicate, generate, remove,
  };
}
