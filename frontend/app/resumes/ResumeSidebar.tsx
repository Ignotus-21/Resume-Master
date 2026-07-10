'use client';
import { motion, AnimatePresence } from 'framer-motion';

export function ResumeSidebar({
  open,
  resumes,
  selectedJobId,
  activeResumeId,
  onSelect,
  onDeleteRequest,
}: {
  open: boolean;
  resumes: any[];
  selectedJobId: string;
  activeResumeId: string | null;
  onSelect: (resume: any) => void;
  onDeleteRequest: (id: string) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
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
              onClick={() => onSelect(resume)}
              className={`p-4 border rounded-xl cursor-pointer transition-all relative group ${activeResumeId === resume._id ? 'border-purple-300 bg-purple-50 ring-1 ring-purple-200 shadow-lg shadow-purple-100' : 'hover:bg-blue-50 border-[#dadce0] bg-white hover:border-[#dadce0]'}`}
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
                  onClick={(e) => { e.stopPropagation(); onDeleteRequest(resume._id); }}
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
  );
}
