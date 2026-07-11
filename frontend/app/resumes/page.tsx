'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { saveAs } from 'file-saver';
import { useToast } from '@/components/ui/Toast';
import { FileText, Sparkles, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/Modal';
import { useResumeGeneration } from './useResumeGeneration';
import { generateDocx } from './generateDocx';
import { ResumeSidebar } from './ResumeSidebar';
import { PdfPane } from './PdfPane';
import { FeedbackPanel } from './FeedbackPanel';

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

  const {
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
  } = useResumeGeneration(preSelectedJobId);

  // Pure UI state
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'docx'>('pdf');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleDownload = async () => {
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
      } else {
        showToast("No tailored data available for DOCX export", 'info');
      }
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
        <ResumeSidebar
          open={isSidebarOpen}
          resumes={resumes}
          selectedJobId={selectedJobId}
          activeResumeId={viewResume?._id ?? null}
          onSelect={setViewResume}
          onDeleteRequest={setPendingDeleteId}
        />

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
                                onClick={handleDownload}
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
                        <PdfPane isCompiling={isCompiling} compileError={compileError} pdfData={pdfData} />
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
                        <PdfPane isCompiling={isCompiling} compileError={compileError} pdfData={pdfData} />
                    </div>
                  </div>
              )}

              {activeView === 'feedback' && (
                  <FeedbackPanel analyzing={analyzing} recommendations={recommendations} />
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
      <ConfirmModal
        open={pendingDeleteId !== null}
        title="Delete resume"
        message="Are you sure you want to delete this resume? This can't be undone."
        onConfirm={() => {
          if (pendingDeleteId) handleDelete(pendingDeleteId);
          setPendingDeleteId(null);
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
