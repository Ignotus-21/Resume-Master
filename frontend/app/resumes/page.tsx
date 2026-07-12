'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sparkles, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useWorkspace } from './useWorkspace';
import { ResumeWorkspace } from './ResumeWorkspace';
import { TEMPLATE_IDS, TEMPLATE_LABELS, type TemplateId } from '@/lib/resumeSchema';

export default function ResumesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[#5f6368]">Loading…</div>}>
      <ResumesPageContent />
    </Suspense>
  );
}

function ResumesPageContent() {
  const searchParams = useSearchParams();
  const preSelectedJobId = searchParams.get('jobId');
  const ws = useWorkspace(preSelectedJobId);
  const { jobs, selectedJobId, setSelectedJobId, generating, generate, doc } = ws;

  const [templateId, setTemplateId] = useState<TemplateId>('sheets');

  return (
    <div className="p-4 max-w-full mx-auto h-screen flex flex-col">
      {/* Generator bar — compact when a document is open */}
      <Card className={`no-print relative overflow-hidden mb-4 ${doc ? 'p-4' : 'p-8'}`}>
        <div className="absolute inset-0 bg-gradient-to-r from-purple-50 via-transparent to-blue-50 pointer-events-none" />
        {!doc && (
          <h2 className="text-2xl font-bold mb-6 text-[#202124] relative z-10 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-[#1a73e8]" /> Create New Resume
          </h2>
        )}
        <div className="flex flex-col md:flex-row gap-3 items-end relative z-10">
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium mb-1 text-[#5f6368]">Job application</label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full border border-[#dadce0] bg-[#f8f9fa] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 text-sm text-[#202124] appearance-none cursor-pointer"
            >
              <option value="">-- Choose a job --</option>
              {jobs.map((job) => (
                <option key={job._id} value={job._id}>{job.role} at {job.company}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-72">
            <label className="block text-xs font-medium mb-1 text-[#5f6368]">Template</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value as TemplateId)}
              className="w-full border border-[#dadce0] bg-[#f8f9fa] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 text-sm text-[#202124] appearance-none cursor-pointer"
            >
              {TEMPLATE_IDS.map((t) => (
                <option key={t} value={t}>{TEMPLATE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => generate(templateId)}
            disabled={generating || !selectedJobId}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#1a73e8] to-[#174ea6] text-white px-6 py-2 rounded-xl hover:opacity-90 disabled:opacity-50 text-sm font-semibold transition-all shadow-lg shadow-blue-200/50 w-full md:w-auto"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? 'Tailoring…' : 'Generate'}
          </button>
          {selectedJobId && (
            <button onClick={() => setSelectedJobId('')} className="text-xs text-[#5f6368] hover:text-[#202124] whitespace-nowrap pb-2">
              Clear filter
            </button>
          )}
        </div>
      </Card>

      <ResumeWorkspace ws={ws} />
    </div>
  );
}
