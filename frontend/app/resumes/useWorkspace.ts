'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, apiJson } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import type { ResumeDocument, ResumeContent, DesignTokens, TemplateId, CompileError } from '@/lib/resumeSchema';
import { DEFAULT_DESIGN } from '@/lib/resumeSchema';

// All data/API state for the resume workspace: list + job fetching,
// generation, the compile pipeline (debounced, cancellable, cache-friendly),
// saving, eject/revert, duplication and feedback. Pure UI state stays in the
// components.

const AUTO_COMPILE_KEY = 'rm.autoCompile';
const COMPILE_DEBOUNCE_MS = 800;

export function useWorkspace(preSelectedJobId: string | null) {
  const { showToast } = useToast();

  const [resumes, setResumes] = useState<ResumeDocument[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState(preSelectedJobId || '');
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // The open document (editable working copy).
  const [doc, setDoc] = useState<ResumeDocument | null>(null);
  const [dirty, setDirty] = useState(false);

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

  useEffect(() => {
    fetchResumes(selectedJobId);
    fetchJobs();
  }, [selectedJobId, fetchResumes, fetchJobs]);

  useEffect(() => {
    if (preSelectedJobId) setSelectedJobId(preSelectedJobId);
  }, [preSelectedJobId]);

  // --- selection ------------------------------------------------------------

  const selectResume = useCallback(async (r: ResumeDocument | null) => {
    setRecommendations(null);
    setCompileErrors([]);
    setCompileLog(null);
    setPdfData(null);
    setPages(null);
    setDirty(false);
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
    setDirty(true);
  }, []);

  const setContent = useCallback((updater: (c: ResumeContent) => ResumeContent) => {
    setDoc((d) => (d ? { ...d, content: updater(d.content || {}) } : d));
    setDirty(true);
  }, []);

  const setDesign = useCallback((patch: Partial<DesignTokens>) => {
    setDoc((d) => (d ? { ...d, design: { ...(d.design || DEFAULT_DESIGN), ...patch } } : d));
    setDirty(true);
  }, []);

  const setTemplateId = useCallback((templateId: TemplateId) => patchDoc({ templateId }), [patchDoc]);
  const setLatexSource = useCallback((latexSource: string) => {
    setDoc((d) => (d ? { ...d, latexSource } : d));
    setTex(latexSource);
    setDirty(true);
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

  // --- persistence ----------------------------------------------------------

  const save = useCallback(async (extra?: Partial<ResumeDocument>) => {
    if (!doc) return null;
    setSaving(true);
    try {
      const payload: any = { versionName: doc.versionName, ...extra };
      if (doc.mode === 'latex') {
        payload.latexSource = doc.latexSource;
      } else {
        payload.content = doc.content;
        payload.design = doc.design;
        payload.templateId = doc.templateId;
      }
      const updated: ResumeDocument = await apiJson(`/api/resumes/${doc._id}`, 'PUT', payload);
      setResumes((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
      setDoc(updated);
      setDirty(false);
      return updated;
    } catch (error: any) {
      showToast(error.message || 'Failed to save resume', 'error');
      return null;
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

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
      setDirty(false);
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
      setDirty(false);
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

  const generate = useCallback(async (templateId: string) => {
    if (!selectedJobId) {
      showToast('Select a job first', 'info');
      return;
    }
    setGenerating(true);
    try {
      const data: ResumeDocument = await apiJson('/api/resumes/generate', 'POST', {
        jobId: selectedJobId,
        templateId,
      });
      setResumes((prev) => [data, ...prev]);
      await selectResume(data);
    } catch (error: any) {
      console.error('Error generating resume:', error);
      showToast(error.message || 'Failed to generate. Ensure Gemini Key is set.', 'error');
    }
    setGenerating(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId, selectResume]);

  const getFeedback = useCallback(async () => {
    if (!doc?.job) {
      showToast('This resume is not linked to a specific job to analyze.', 'info');
      return;
    }
    setAnalyzing(true);
    try {
      setRecommendations(await apiJson('/api/resumes/feedback', 'POST', { jobId: (doc.job as any)._id }));
    } catch (error: any) {
      showToast(error.message || 'Failed to get feedback.', 'error');
    }
    setAnalyzing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

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
    selectedJobId, setSelectedJobId,
    generating, analyzing, saving, dirty,
    recommendations,
    doc, selectResume, patchDoc, setContent, setDesign, setTemplateId, setLatexSource,
    pdfData, pages, tex, compileErrors, compileLog, isCompiling,
    autoCompile, setAutoCompile, compile,
    save, eject, revert, duplicate, generate, getFeedback, remove,
  };
}
