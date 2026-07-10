'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { apiFetch, apiJson } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FileText, Sparkles, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';

interface ResumeData {
  user?: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  experience?: Array<{
    role: string;
    company: string;
    startDate: string;
    endDate?: string;
    bulletPoints?: string[];
    location?: string;
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    endDate: string;
    gpa?: string;
    coursework?: string[];
  }>;
  skills?: {
    languages?: string[];
    frameworks?: string[];
    tools?: string[];
    other?: string[];
  } | string[]; // Skills can be object or array
  projects?: Array<{
    title: string;
    techStack?: string[];
    description: string;
    link?: string;
    bulletPoints?: string[];
  }>;
  certificates?: Array<{
    name: string;
    issuer?: string;
    date?: string;
    link?: string;
  }>;
  achievements?: Array<{
    title: string;
    date?: string;
    description?: string;
  }>;
  patents?: Array<{
    title: string;
    number?: string;
    date?: string;
    description?: string;
  }>;
  volunteering?: Array<{
    organization: string;
    role: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  customSections?: Array<{
    title: string;
    items: Array<{
      title: string;
      subtitle?: string;
      date?: string;
      description?: string;
    }>;
  }>;
}

export default function ResumesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[#5f6368]">Loading…</div>}>
      <ResumesPageContent />
    </Suspense>
  );
}

function ResumesPageContent() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const preSelectedJobId = searchParams.get('jobId');

  const [resumes, setResumes] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState(preSelectedJobId || '');
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [viewResume, setViewResume] = useState<any>(null);
  const [activeView, setActiveView] = useState('preview'); // 'preview', 'code', 'feedback'
  const [recommendations, setRecommendations] = useState<any>(null);
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'docx'>('pdf');
  
  // Edit States
  const [editTitle, setEditTitle] = useState('');
  const [editCode, setEditCode] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [saving, setSaving] = useState(false);

  // Compilation States
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    fetchResumes(selectedJobId);
    fetchJobs();
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
  }, [editCode]);

  // Initial Compile on View Switch
  useEffect(() => {
    if ((activeView === 'code' || activeView === 'preview') && editCode && !pdfData) {
        handleCompile();
    }
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

  const handleGenerate = async () => {
    if (!selectedJobId) return showToast('Select a job first', 'info');
    setGenerating(true);
    try {
      const data = await apiJson('/api/resumes/generate', 'POST', { jobId: selectedJobId });
      setResumes([data, ...resumes]);
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
      setResumes(resumes.map(r => r._id === updated._id ? updated : r));
      setViewResume(updated);
      setIsEditingTitle(false);
    } catch (error: any) {
      console.error('Error updating resume:', error);
      showToast(error.message || 'Failed to save resume', 'error');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resume?')) return;
    try {
      await apiFetch(`/api/resumes/${id}`, { method: 'DELETE' });
      setResumes(resumes.filter(r => r._id !== id));
      if (viewResume?._id === id) setViewResume(null);
      showToast('Resume deleted', 'success');
    } catch (error: any) {
      console.error('Error deleting resume:', error);
      showToast(error.message || 'Failed to delete resume', 'error');
    }
  };

  return (
    <div className="p-4 max-w-full mx-auto min-h-screen">
      <div className="flex justify-between items-center mb-6 no-print">
        <h1 className="text-3xl font-bold text-[#202124]">Resume Creator</h1>
        {selectedJobId && (
            <button 
                onClick={() => setSelectedJobId('')}
                className="text-sm text-[#5f6368] hover:text-[#202124]"
            >
                Clear Filter (Show All)
            </button>
        )}
      </div>

      {/* Generator Section */}
      <Card className="p-8 mb-8 no-print relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-50 via-transparent to-blue-50 pointer-events-none" />
        <h2 className="text-2xl font-bold mb-6 text-[#202124] relative z-10 flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-[#1a73e8]" /> Create New Resume
        </h2>
        <div className="flex flex-col md:flex-row gap-4 items-end relative z-10">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium mb-2 text-[#5f6368]">Select Job Application</label>
            <select 
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full border border-[#dadce0] bg-[#f8f9fa] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 text-[#202124] transition-all appearance-none cursor-pointer"
            >
              <option value="">-- Choose a Job (Filter List) --</option>
              {jobs.map(job => (
                <option key={job._id} value={job._id}>{job.role} at {job.company}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedJobId}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#1a73e8] to-[#174ea6] text-white px-8 py-3 rounded-xl hover:opacity-90 disabled:opacity-50 font-semibold transition-all shadow-lg shadow-blue-200/50 w-full md:w-auto h-12"
          >
            {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            {generating ? 'AI Generating...' : 'Generate Resume'}
          </button>
        </div>
      </Card>

      <div className={`grid grid-cols-1 ${isSidebarOpen ? 'md:grid-cols-4' : 'md:grid-cols-1'} gap-4 transition-all duration-300`}>
        {/* List */}
        <AnimatePresence>
          {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="col-span-1 border-r border-[#dadce0] pr-6 no-print overflow-hidden"
          >
            <h2 className="font-bold mb-4 text-[#202124]">
              {selectedJobId ? 'Resumes for Job' : 'All Resumes'} ({resumes.length})
            </h2>
            <div className="space-y-4 h-[calc(100vh-140px)] overflow-y-auto pr-2 custom-scrollbar">
              {resumes.map(resume => (
                <motion.div 
                  layout
                  key={resume._id} 
                  onClick={() => setViewResume(resume)}
                  className={`p-4 border rounded-xl cursor-pointer transition-all relative group ${viewResume?._id === resume._id ? 'border-purple-300 bg-purple-50 ring-1 ring-purple-200 shadow-lg shadow-purple-100' : 'hover:bg-blue-50 border-[#dadce0] bg-white hover:border-[#dadce0]'}`}
                >
                  <div className="font-bold text-[#202124] mb-1 pr-6 truncate">{resume.versionName}</div>
                  {resume.job && (
                      <div className="text-xs text-purple-700 mb-2 truncate">
                          Linked: {resume.job.role} @ {resume.job.company}
                      </div>
                  )}
                  <div className="text-sm text-[#5f6368] flex justify-between">
                      <span>{new Date(resume.createdAt).toLocaleDateString()}</span>
                      {resume.atsScore && <span className="text-[#1e8e3e] font-medium">ATS: {resume.atsScore}</span>}
                  </div>
                  
                  <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(resume._id); }}
                      className="absolute top-2 right-2 text-[#5f6368] hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition"
                      title="Delete Resume"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                  </button>
                </motion.div>
              ))}
              {resumes.length === 0 && <div className="text-[#5f6368] italic">No resumes found. Generate one above.</div>}
            </div>
          </motion.div>
          )}
        </AnimatePresence>

        {/* Viewer */}
        <div className={isSidebarOpen ? "col-span-3" : "col-span-1"}>
          {viewResume ? (
            <div>
              <div className="flex justify-between items-center mb-4 bg-[#f8f9fa] p-4 rounded-xl border border-[#dadce0] no-print">
                 <div className="flex items-center gap-4 flex-1 min-w-0">
                    <button 
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 hover:bg-white rounded-lg text-[#5f6368] hover:text-[#202124] transition"
                        title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                    >
                        {isSidebarOpen ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>
                    {isEditingTitle ? (
                        <input 
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="bg-[#f8f9fa] border border-[#dadce0] text-[#202124] px-2 py-1 rounded w-full max-w-sm"
                            autoFocus
                            onBlur={() => { handleUpdate(); setIsEditingTitle(false); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { handleUpdate(); setIsEditingTitle(false); } }}
                        />
                    ) : (
                        <div className="flex items-center gap-2 min-w-0">
                            <h2 className="text-xl font-bold text-[#202124] truncate" title={viewResume.versionName}>
                                {viewResume.versionName}
                            </h2>
                            <button onClick={() => setIsEditingTitle(true)} className="text-[#5f6368] hover:text-[#1a73e8] flex-shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                            </button>
                        </div>
                    )}
                 </div>

                 <div className="flex gap-2 flex-shrink-0">
                    <div className="flex bg-[#f8f9fa] rounded-lg p-1">
                        <button 
                        onClick={() => setActiveView('preview')}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition ${activeView === 'preview' ? 'bg-[#1a73e8] text-white' : 'text-[#5f6368] hover:text-[#202124]'}`}
                        >
                        Preview
                        </button>
                        <button 
                        onClick={() => setActiveView('code')}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition ${activeView === 'code' ? 'bg-[#1a73e8] text-white' : 'text-[#5f6368] hover:text-[#202124]'}`}
                        >
                        Code
                        </button>
                        <button 
                        onClick={handleGetFeedback}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition ${activeView === 'feedback' ? 'bg-[#1a73e8] text-white' : 'text-[#5f6368] hover:text-[#202124]'}`}
                        >
                        Feedback
                        </button>
                    </div>
                    {activeView === 'preview' && (
                        <div className="flex bg-[#f8f9fa] rounded-lg p-1">
                            <button 
                                onClick={() => setDownloadFormat('pdf')}
                                className={`px-3 py-1 rounded-md text-sm font-medium transition ${downloadFormat === 'pdf' ? 'bg-[#1a73e8] text-white' : 'text-[#5f6368] hover:text-[#202124]'}`}
                            >
                                PDF
                            </button>
                            <button 
                                onClick={() => setDownloadFormat('docx')}
                                className={`px-3 py-1 rounded-md text-sm font-medium transition ${downloadFormat === 'docx' ? 'bg-[#1a73e8] text-white' : 'text-[#5f6368] hover:text-[#202124]'}`}
                            >
                                DOCX
                            </button>
                            <button 
                                onClick={async () => {
                                    if (downloadFormat === 'pdf') {
                                        if (pdfData) {
                                            try {
                                                const byteCharacters = atob(pdfData);
                                                const byteNumbers = new Array(byteCharacters.length);
                                                for (let i = 0; i < byteCharacters.length; i++) {
                                                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                                                }
                                                const byteArray = new Uint8Array(byteNumbers);
                                                const blob = new Blob([byteArray], { type: "application/pdf" });
                                                saveAs(blob, `${viewResume.versionName || 'resume'}.pdf`);
                                            } catch (e) {
                                                console.error("Download failed", e);
                                                showToast("Failed to download PDF", 'error');
                                            }
                                        } else {
                                            showToast("PDF not ready. Please wait for preview.", 'info');
                                        }
                                    } else {
                                        if (viewResume?.tailoredData) {
                                            try {
                                                const blob = await generateDocx(viewResume.tailoredData);
                                                saveAs(blob, `${viewResume.versionName || 'resume'}.docx`);
                                            } catch (error) {
                                                console.error("DOCX generation failed", error);
                                                showToast("Failed to generate DOCX", 'error');
                                            }
                                        }
                                    }
                                }}
                                className="bg-white text-[#202124] px-3 py-1 rounded-md text-sm font-medium hover:bg-white flex items-center gap-1 ml-2"
                            >
                                <span className="text-lg">⬇</span>
                            </button>
                        </div>
                    )}
                    {activeView === 'code' && (
                        <button 
                            onClick={handleUpdate}
                            disabled={saving}
                            className="bg-green-600 text-white px-4 py-1 rounded-lg text-sm font-medium hover:bg-green-500 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    )}
                 </div>
              </div>

              {activeView === 'preview' && (
                  <div className="w-full h-[calc(100vh-140px)] border border-[#dadce0] bg-[#f8f9fa] rounded-xl overflow-hidden relative">
                        {isCompiling && (
                             <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500 animate-pulse z-10"></div>
                        )}
                        {compileError ? (
                            <div className="p-4 bg-[#fce8e6] text-[#d93025] h-full overflow-auto font-mono text-xs whitespace-pre-wrap">
                                <div className="font-bold mb-2">Compilation Error:</div>
                                {compileError}
                            </div>
                        ) : pdfData ? (
                            <iframe 
                                src={`data:application/pdf;base64,${pdfData}#toolbar=0&navpanes=0&scrollbar=0`}
                                className="w-full h-full bg-white"
                                title="Resume PDF Preview"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-[#5f6368]">
                                {isCompiling ? 'Compiling Preview...' : 'Generating Preview...'}
                            </div>
                        )}
                  </div>
              )}

              {activeView === 'code' && (
                  <div className="grid grid-cols-2 gap-4 h-[calc(100vh-140px)]">
                    <div className="flex flex-col h-full">
                        <div className="flex justify-between items-center mb-2">
                             <p className="text-sm text-[#5f6368]">LaTeX Code</p>
                             {isCompiling && <span className="text-xs text-[#1a73e8] animate-pulse">Compiling...</span>}
                        </div>
                        <textarea 
                            value={editCode}
                            onChange={(e) => setEditCode(e.target.value)}
                            className="w-full flex-1 font-mono text-xs border border-[#dadce0] p-4 rounded-xl bg-[#f8f9fa] text-[#202124] outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                            spellCheck={false}
                        />
                    </div>
                    <div className="flex flex-col h-full bg-[#f8f9fa] rounded-xl border border-[#dadce0] overflow-hidden relative">
                        {isCompiling && (
                             <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500 animate-pulse z-10"></div>
                        )}
                        
                        {compileError ? (
                            <div className="p-4 bg-[#fce8e6] text-[#d93025] h-full overflow-auto font-mono text-xs whitespace-pre-wrap">
                                <div className="font-bold mb-2">Compilation Error:</div>
                                {compileError}
                            </div>
                        ) : pdfData ? (
                            <iframe 
                                src={`data:application/pdf;base64,${pdfData}#toolbar=0&navpanes=0&scrollbar=0`}
                                className="w-full h-full bg-white"
                                title="Resume PDF Preview"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-[#5f6368]">
                                {isCompiling ? 'Compiling Preview...' : 'Generating Preview...'}
                            </div>
                        )}
                    </div>
                  </div>
              )}

              {activeView === 'feedback' && (
                  <div className="w-full min-h-[600px] border border-[#dadce0] p-6 rounded-xl bg-[#f8f9fa] text-[#202124]">
                      {analyzing ? (
                          <div className="text-center py-20 animate-pulse text-[#1a73e8]">AI Analysis in progress...</div>
                      ) : recommendations ? (
                          <div className="space-y-6">
                              <div className="flex items-center gap-4 border-b border-[#dadce0] pb-4">
                                  <div className="text-4xl font-bold text-[#1e8e3e]">{recommendations.matchScore}%</div>
                                  <div>
                                      <div className="text-lg font-bold text-[#202124]">Match Score</div>
                                      <div className="text-sm text-[#5f6368]">Based on Job Description</div>
                                  </div>
                              </div>
                              
                              <div>
                                  <h3 className="text-lg font-bold text-[#d93025] mb-2">Missing Skills</h3>
                                  <div className="flex flex-wrap gap-2">
                                      {recommendations.missingSkills?.map((s: string, i: number) => (
                                          <span key={i} className="bg-[#fce8e6] text-[#d93025] px-3 py-1 rounded-full text-sm border border-[#d93025]">{s}</span>
                                      ))}
                                  </div>
                              </div>

                              <div>
                                  <h3 className="text-lg font-bold text-[#f9ab00] mb-2">Missing Keywords</h3>
                                  <div className="flex flex-wrap gap-2">
                                      {recommendations.missingKeywords?.map((k: string, i: number) => (
                                          <span key={i} className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-sm border border-yellow-200">{k}</span>
                                      ))}
                                  </div>
                              </div>

                              <div>
                                  <h3 className="text-lg font-bold text-[#1a73e8] mb-2">Gap Analysis</h3>
                                  <p className="text-[#202124] leading-relaxed bg-[#f8f9fa] p-4 rounded-lg border border-[#dadce0]">
                                      {recommendations.gapAnalysis}
                                  </p>
                              </div>

                              <div>
                                  <h3 className="text-lg font-bold text-[#1e8e3e] mb-2">Recommended Improvements</h3>
                                  <ul className="list-disc list-outside ml-5 text-[#202124] space-y-2">
                                      {recommendations.improvements?.map((imp: string, i: number) => (
                                          <li key={i}>{imp}</li>
                                      ))}
                                  </ul>
                              </div>
                          </div>
                      ) : (
                          <div className="text-center py-20 text-[#5f6368]">
                              Click &quot;Feedback&quot; to analyze your resume against the job description.
                          </div>
                      )}
                  </div>
              )}
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center h-64 text-[#5f6368] bg-[#f8f9fa] rounded-xl border border-dashed border-[#dadce0]">
               <FileText className="h-10 w-10 mb-2 text-[#5f6368]" />
               <p>Select a resume from history to view or edit</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Generate DOCX using 'docx' library
const generateDocx = async (data: ResumeData) => {
    const children = [];

    // Header
    children.push(
        new Paragraph({
            text: data.user?.name || "Name",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
            text: [data.user?.email, data.user?.phone, data.user?.location, data.user?.linkedin].filter(Boolean).join(" | "),
            alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: "" })
    );

    // Experience
    if (data.experience?.length) {
        children.push(new Paragraph({ text: "EXPERIENCE", heading: HeadingLevel.HEADING_2 }));
        data.experience.forEach((exp) => {
            children.push(
                new Paragraph({ 
                    children: [new TextRun({ text: exp.role, bold: true, size: 24 })]
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: exp.company, italics: true }),
                        new TextRun({ text: `  |  ${exp.startDate} - ${exp.endDate || 'Present'}`, size: 20 })
                    ]
                }),
            );
            if (exp.bulletPoints?.length) {
                exp.bulletPoints.forEach((bp: string) => {
                    children.push(new Paragraph({ text: `• ${bp}`, indent: { left: 400 } }));
                });
            }
            children.push(new Paragraph({ text: "" }));
        });
    }

    // Education
    if (data.education?.length) {
        children.push(new Paragraph({ text: "EDUCATION", heading: HeadingLevel.HEADING_2 }));
        data.education.forEach((edu) => {
            children.push(
                new Paragraph({ 
                    children: [new TextRun({ text: edu.institution, bold: true })]
                }),
                new Paragraph({ text: `${edu.degree} in ${edu.fieldOfStudy}${edu.gpa ? ` (GPA: ${edu.gpa})` : ''}` }),
                new Paragraph({ text: `${edu.startDate} - ${edu.endDate}` }),
            );
            if (edu.coursework?.length) {
                children.push(new Paragraph({ text: `Relevant Coursework: ${edu.coursework.join(', ')}` }));
            }
            children.push(new Paragraph({ text: "" }));
        });
    }

    // Skills
    if (data.skills) {
        children.push(new Paragraph({ text: "SKILLS", heading: HeadingLevel.HEADING_2 }));
        if (Array.isArray(data.skills)) {
            // Handle array format
            children.push(new Paragraph({ text: data.skills.join(", ") }));
        } else {
            // Handle object format
            if (data.skills.languages?.length) {
                children.push(new Paragraph({ children: [new TextRun({ text: "Languages: ", bold: true }), new TextRun(data.skills.languages.join(", "))] }));
            }
            if (data.skills.frameworks?.length) {
                children.push(new Paragraph({ children: [new TextRun({ text: "Frameworks: ", bold: true }), new TextRun(data.skills.frameworks.join(", "))] }));
            }
            if (data.skills.tools?.length) {
                children.push(new Paragraph({ children: [new TextRun({ text: "Tools: ", bold: true }), new TextRun(data.skills.tools.join(", "))] }));
            }
            if (data.skills.other?.length) {
                children.push(new Paragraph({ children: [new TextRun({ text: "Other: ", bold: true }), new TextRun(data.skills.other.join(", "))] }));
            }
        }
    }

    // Projects
    if (data.projects?.length) {
        children.push(new Paragraph({ text: "PROJECTS", heading: HeadingLevel.HEADING_2 }));
        data.projects.forEach((proj) => {
            children.push(
                new Paragraph({ 
                    children: [new TextRun({ text: proj.title, bold: true })]
                }),
                new Paragraph({ 
                    children: [new TextRun({ text: `Stack: ${proj.techStack?.join(', ')}`, italics: true })] 
                }),
                new Paragraph({ text: proj.description }),
                new Paragraph({ text: "" })
            );
        });
    }

    // Certificates
    if (data.certificates?.length) {
        children.push(new Paragraph({ text: "CERTIFICATES", heading: HeadingLevel.HEADING_2 }));
        data.certificates.forEach((cert) => {
            children.push(new Paragraph({ 
                children: [
                    new TextRun({ text: cert.name, bold: true }),
                    new TextRun({ text: cert.issuer ? ` - ${cert.issuer}` : '' }),
                    new TextRun({ text: cert.date ? ` (${cert.date})` : '', italics: true })
                ]
            }));
        });
    }

    // Achievements
    if (data.achievements?.length) {
        children.push(new Paragraph({ text: "ACHIEVEMENTS", heading: HeadingLevel.HEADING_2 }));
        data.achievements.forEach((ach) => {
            children.push(new Paragraph({ 
                children: [
                    new TextRun({ text: ach.title, bold: true }),
                    new TextRun({ text: ach.date ? ` (${ach.date})` : '', italics: true })
                ]
            }));
            if (ach.description) children.push(new Paragraph({ text: ach.description }));
        });
    }

    // Patents
    if (data.patents?.length) {
        children.push(new Paragraph({ text: "PATENTS", heading: HeadingLevel.HEADING_2 }));
        data.patents.forEach((pat) => {
            children.push(new Paragraph({ 
                children: [
                    new TextRun({ text: pat.title, bold: true }),
                    new TextRun({ text: pat.date ? ` (${pat.date})` : '', italics: true })
                ]
            }));
            if (pat.number) children.push(new Paragraph({ children: [new TextRun({ text: `Patent #: ${pat.number}`, italics: true })] }));
            if (pat.description) children.push(new Paragraph({ text: pat.description }));
        });
    }

    // Volunteering
    if (data.volunteering?.length) {
        children.push(new Paragraph({ text: "VOLUNTEERING", heading: HeadingLevel.HEADING_2 }));
        data.volunteering.forEach((vol) => {
            children.push(new Paragraph({ 
                children: [
                    new TextRun({ text: vol.organization, bold: true }),
                    new TextRun({ text: ` - ${vol.role}`, italics: true }),
                    ...(vol.startDate || vol.endDate ? [new TextRun({ text: `  |  ${vol.startDate || ''} - ${vol.endDate || ''}`, size: 20 })] : [])
                ]
            }));
            if (vol.description) children.push(new Paragraph({ text: vol.description }));
        });
    }

    const doc = new Document({
        sections: [{
            properties: {},
            children: children,
        }],
    });

    return await Packer.toBlob(doc);
};

// Simple HTML Resume Renderer (Unchanged)
const ResumePreview = ({ data }: { data: any }) => {
    if (!data || !data.user) return <div className="text-center text-[#5f6368] mt-20">No preview data available</div>;

    return (
        <div className="max-w-3xl mx-auto font-sans leading-relaxed">
            {/* Header */}
            <div className="text-center border-b pb-4 mb-4">
                <h1 className="text-3xl font-bold uppercase tracking-wider mb-2">{data.user.name}</h1>
                <div className="text-sm text-[#5f6368] flex justify-center gap-4 flex-wrap">
                    {data.user.email && <span>{data.user.email}</span>}
                    {data.user.phone && <span>{data.user.phone}</span>}
                    {data.user.location && <span>{data.user.location}</span>}
                    {data.user.linkedin && <a href={data.user.linkedin} className="text-blue-600 hover:underline">LinkedIn</a>}
                    {data.user.github && <a href={data.user.github} className="text-blue-600 hover:underline">GitHub</a>}
                </div>
            </div>

            {/* Experience */}
            {data.experience && data.experience.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-sm font-bold uppercase tracking-widest border-b border-black mb-3 pb-1">Experience</h2>
                    {data.experience.map((exp: any, i: number) => (
                        <div key={i} className="mb-4 break-inside-avoid">
                            <div className="flex justify-between items-baseline mb-1">
                                <h3 className="font-bold text-lg">{exp.role}</h3>
                                <span className="text-sm text-[#5f6368]">{exp.startDate} – {exp.endDate || 'Present'}</span>
                            </div>
                            <div className="flex justify-between items-baseline mb-2">
                                <span className="text-md font-semibold text-gray-700 italic">{exp.company}</span>
                                <span className="text-sm text-gray-500">{exp.location}</span>
                            </div>
                            <ul className="list-disc list-outside ml-5 text-sm space-y-1 text-gray-700">
                                {exp.bulletPoints?.map((bp: string, j: number) => (
                                    <li key={j}>{bp}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}

            {/* Projects */}
            {data.projects && data.projects.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-sm font-bold uppercase tracking-widest border-b border-black mb-3 pb-1">Projects</h2>
                    {data.projects.map((proj: any, i: number) => (
                        <div key={i} className="mb-3 break-inside-avoid">
                            <div className="flex justify-between items-baseline">
                                <h3 className="font-bold">{proj.title}</h3>
                                {proj.techStack && <span className="text-xs text-gray-500 italic">[{proj.techStack.join(', ')}]</span>}
                            </div>
                            <p className="text-sm text-gray-700 mt-1">{proj.description}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Skills */}
            {data.skills && (
                <div className="mb-6 break-inside-avoid">
                    <h2 className="text-sm font-bold uppercase tracking-widest border-b border-black mb-3 pb-1">Technical Skills</h2>
                    <div className="text-sm text-gray-700 space-y-1">
                        {Array.isArray(data.skills) ? (
                            <div>{data.skills.join(', ')}</div>
                        ) : (
                            <>
                                {data.skills.languages?.length > 0 && <div><span className="font-bold">Languages:</span> {data.skills.languages.join(', ')}</div>}
                                {data.skills.frameworks?.length > 0 && <div><span className="font-bold">Frameworks:</span> {data.skills.frameworks.join(', ')}</div>}
                                {data.skills.tools?.length > 0 && <div><span className="font-bold">Tools:</span> {data.skills.tools.join(', ')}</div>}
                                {data.skills.other?.length > 0 && <div><span className="font-bold">Other:</span> {data.skills.other.join(', ')}</div>}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Education */}
            {data.education && data.education.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-sm font-bold uppercase tracking-widest border-b border-black mb-3 pb-1">Education</h2>
                    {data.education.map((edu: any, i: number) => (
                        <div key={i} className="mb-2 break-inside-avoid">
                            <div className="flex justify-between font-bold text-sm">
                                <span>{edu.institution}</span>
                                <span>{edu.startDate} – {edu.endDate}</span>
                            </div>
                            <div className="text-sm text-gray-700">
                                {edu.degree} in {edu.fieldOfStudy} {edu.gpa && <span>(GPA: {edu.gpa})</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Certificates */}
            {data.certificates && data.certificates.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-sm font-bold uppercase tracking-widest border-b border-black mb-3 pb-1">Certificates</h2>
                    {data.certificates.map((cert: any, i: number) => (
                        <div key={i} className="mb-2 break-inside-avoid">
                            <div className="flex justify-between text-sm">
                                <span className="font-bold">{cert.name}</span>
                                <span className="text-[#5f6368]">{cert.date}</span>
                            </div>
                            <div className="text-sm text-gray-700 italic">{cert.issuer}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Achievements */}
            {data.achievements && data.achievements.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-sm font-bold uppercase tracking-widest border-b border-black mb-3 pb-1">Achievements</h2>
                    {data.achievements.map((ach: any, i: number) => (
                        <div key={i} className="mb-3 break-inside-avoid">
                            <div className="flex justify-between text-sm font-bold">
                                <span>{ach.title}</span>
                                <span className="text-[#5f6368] font-normal">{ach.date}</span>
                            </div>
                            <p className="text-sm text-gray-700">{ach.description}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Patents */}
            {data.patents && data.patents.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-sm font-bold uppercase tracking-widest border-b border-black mb-3 pb-1">Patents</h2>
                    {data.patents.map((pat: any, i: number) => (
                        <div key={i} className="mb-3 break-inside-avoid">
                            <div className="flex justify-between text-sm font-bold">
                                <span>{pat.title}</span>
                                <span className="text-[#5f6368] font-normal">{pat.date}</span>
                            </div>
                            <div className="text-xs text-gray-500 mb-1">{pat.number}</div>
                            <p className="text-sm text-gray-700">{pat.description}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Volunteering */}
            {data.volunteering && data.volunteering.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-sm font-bold uppercase tracking-widest border-b border-black mb-3 pb-1">Volunteering</h2>
                    {data.volunteering.map((vol: any, i: number) => (
                        <div key={i} className="mb-3 break-inside-avoid">
                            <div className="flex justify-between text-sm font-bold">
                                <span>{vol.organization}</span>
                                <span className="text-[#5f6368] font-normal">{vol.startDate} - {vol.endDate}</span>
                            </div>
                            <div className="text-sm text-gray-700 italic mb-1">{vol.role}</div>
                            <p className="text-sm text-gray-700">{vol.description}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
