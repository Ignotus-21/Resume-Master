'use client';
import { useState, useEffect } from 'react';
import { apiFetch, apiJson } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

// All data/API state for the resumes page: list + job fetching, AI
// generation, feedback, LaTeX editing with debounced compilation, and CRUD.
// Pure UI state (sidebar open, download format, delete confirmation) stays
// in the page component.
export function useResumeGeneration(preSelectedJobId: string | null) {
  const { showToast } = useToast();

  const [resumes, setResumes] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState(preSelectedJobId || '');
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [viewResume, setViewResume] = useState<any>(null);
  const [activeView, setActiveView] = useState('preview'); // 'preview', 'code', 'feedback'
  const [recommendations, setRecommendations] = useState<any>(null);

  // Edit States
  const [editTitle, setEditTitle] = useState('');
  const [editCode, setEditCode] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [saving, setSaving] = useState(false);

  // Compilation States
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);

  useEffect(() => {
    fetchResumes(selectedJobId);
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId]);

  useEffect(() => {
    if (preSelectedJobId) setSelectedJobId(preSelectedJobId);
  }, [preSelectedJobId]);

  useEffect(() => {
    if (viewResume) {
      setEditTitle(viewResume.versionName);
      setEditCode(viewResume.latexCode);
      setRecommendations(null); // Clear old recommendations when switching resumes
      setPdfData(null);
      setCompileError(null);
    }
  }, [viewResume]);

  // Debounce Compilation
  useEffect(() => {
    if (activeView === 'code' && editCode) {
      const timer = setTimeout(() => {
        handleCompile();
      }, 1000); // 1s debounce
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editCode]);

  // Initial Compile on View Switch
  useEffect(() => {
    if ((activeView === 'code' || activeView === 'preview') && editCode && !pdfData) {
      handleCompile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  const handleCompile = async () => {
    setIsCompiling(true);
    try {
      const data = await apiJson('/api/resumes/compile', 'POST', { latexCode: editCode });
      if (data.success) {
        setPdfData(data.pdf);
        setCompileError(null);
      } else {
        setCompileError(data.log || data.error || 'Unknown compilation error');
      }
    } catch (error: any) {
      console.error('Compilation error:', error);
      setCompileError(error.message || 'Failed to connect to compilation server');
    }
    setIsCompiling(false);
  };

  const fetchResumes = async (filterJobId = '') => {
    try {
      const url = filterJobId ? `/api/resumes?jobId=${filterJobId}` : '/api/resumes';
      const data = await apiFetch(url);
      setResumes(data);
    } catch (error: any) {
      showToast(error.message || 'Failed to load resumes', 'error');
    }
  };

  const fetchJobs = async () => {
    try {
      const data = await apiFetch('/api/jobs');
      setJobs(data);
    } catch (error: any) {
      showToast(error.message || 'Failed to load jobs', 'error');
    }
  };

  const handleGenerate = async (templateStyle: string = 'classic') => {
    if (!selectedJobId) return showToast('Select a job first', 'info');
    setGenerating(true);
    try {
      const data = await apiJson('/api/resumes/generate', 'POST', { jobId: selectedJobId, templateStyle });
      setResumes(prev => [data, ...prev]);
      setViewResume(data);
      setActiveView('preview');
    } catch (error: any) {
      console.error('Error generating resume:', error);
      showToast(error.message || 'Failed to generate. Ensure Gemini Key is set.', 'error');
    }
    setGenerating(false);
  };

  const handleGetFeedback = async () => {
    if (!viewResume || !viewResume.job) return showToast('This resume is not linked to a specific job to analyze.', 'info');
    setAnalyzing(true);
    setActiveView('feedback');
    try {
      const data = await apiJson('/api/resumes/feedback', 'POST', { jobId: viewResume.job._id });
      setRecommendations(data);
    } catch (error: any) {
      console.error('Error getting feedback:', error);
      showToast(error.message || 'Failed to get feedback.', 'error');
    }
    setAnalyzing(false);
  };

  const handleUpdate = async () => {
    if (!viewResume) return;
    setSaving(true);
    try {
      const updated = await apiJson(`/api/resumes/${viewResume._id}`, 'PUT', {
        versionName: editTitle,
        latexCode: editCode,
      });
      setResumes(prev => prev.map(r => r._id === updated._id ? updated : r));
      setViewResume(updated);
      setIsEditingTitle(false);
    } catch (error: any) {
      console.error('Error updating resume:', error);
      showToast(error.message || 'Failed to save resume', 'error');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/resumes/${id}`, { method: 'DELETE' });
      setResumes(prev => prev.filter(r => r._id !== id));
      if (viewResume?._id === id) setViewResume(null);
      showToast('Resume deleted', 'success');
    } catch (error: any) {
      console.error('Error deleting resume:', error);
      showToast(error.message || 'Failed to delete resume', 'error');
    }
  };

  return {
    resumes, jobs,
    selectedJobId, setSelectedJobId,
    generating, analyzing,
    viewResume, setViewResume,
    activeView, setActiveView,
    recommendations,
    editTitle, setEditTitle,
    editCode, setEditCode,
    isEditingTitle, setIsEditingTitle,
    saving,
    pdfData, compileError, isCompiling,
    handleGenerate, handleGetFeedback, handleUpdate, handleDelete,
  };
}
