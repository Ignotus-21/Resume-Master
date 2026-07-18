'use client';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Sparkles, Loader2, ClipboardPaste, Briefcase } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useWorkspace } from './useWorkspace';
import { ResumeWorkspace } from './ResumeWorkspace';
import { ImportFlow } from './ImportFlow';
import { TEMPLATE_IDS, TEMPLATE_LABELS, type TemplateId } from '@/lib/resumeSchema';

// M9 entry points: the primary path is "paste a JD -> Generate" (no job form
// first — the Job record is created behind the scenes). A saved job from the
// tracker is the secondary path. Brand-new users (empty profile) see the
// import-your-resume onboarding instead of a generator they can't use yet.

const profileHasContent = (profile: any) =>
  Boolean(
    profile &&
      (profile.user?.name?.trim() ||
        profile.experience?.length ||
        profile.education?.length ||
        profile.projects?.length)
  );

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
  const {
    jobs, selectedJobId, setSelectedJobId, generating, generate, doc,
    profile, profileLoaded, refreshProfile,
  } = ws;

  const [templateId, setTemplateId] = useState<TemplateId>('sheets');
  const [mode, setMode] = useState<'paste' | 'saved'>(preSelectedJobId ? 'saved' : 'paste');
  const [jdText, setJdText] = useState('');

  const hasProfile = profileHasContent(profile);
  const showOnboarding = profileLoaded && !hasProfile && !doc;

  const canGenerate =
    !generating && (mode === 'paste' ? jdText.trim().length > 0 : Boolean(selectedJobId));

  const handleGenerate = async () => {
    if (mode === 'paste') {
      const data = await generate(templateId, { jdText: jdText.trim() });
      if (data) setJdText('');
    } else {
      await generate(templateId, { jobId: selectedJobId });
    }
  };

  // Import onboarding finished: profile is saved — drop the user into the
  // workspace immediately with an untailored base resume (no AI call, so
  // this is near-instant; the PDF then compiles in the open workspace).
  const handleImportComplete = async () => {
    await refreshProfile();
    await generate(templateId);
  };

  const modePill = (m: 'paste' | 'saved', icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setMode(m)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
        mode === m ? 'bg-[#1a73e8] text-white shadow' : 'text-[#5f6368] hover:text-[#202124]'
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="p-4 max-w-full mx-auto h-screen flex flex-col">
      {showOnboarding ? (
        /* ---------- first-run onboarding: no profile yet ---------- */
        <Card className="no-print relative overflow-hidden mb-4 p-8">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-50 via-transparent to-blue-50 pointer-events-none" />
          <div className="relative z-10 max-w-xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-2 text-[#202124] flex items-center justify-center gap-2">
              <Sparkles className="h-6 w-6 text-[#1a73e8]" /> Let&apos;s build your first resume
            </h2>
            <p className="text-sm text-[#5f6368] mb-6">
              Start from the resume you already have. We&apos;ll pull out your experience,
              education and skills, you check the result, and you&apos;re in the editor.
            </p>
            <ImportFlow onComplete={handleImportComplete} />
            <p className="text-xs text-[#5f6368] mt-4">
              No resume handy?{' '}
              <Link href="/profile" className="text-[#1a73e8] hover:underline">
                Fill in your profile from scratch
              </Link>{' '}
              then come back here and paste a job description.
            </p>
          </div>
        </Card>
      ) : (
        /* ---------- generator bar — compact when a document is open ---------- */
        <Card className={`no-print relative overflow-hidden mb-4 ${doc ? 'p-3' : 'p-8'}`}>
          <div className="absolute inset-0 bg-gradient-to-r from-purple-50 via-transparent to-blue-50 pointer-events-none" />
          {!doc && (
            <h2 className="text-2xl font-bold mb-4 text-[#202124] relative z-10 flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-[#1a73e8]" /> Create New Resume
            </h2>
          )}
          <div className="relative z-10">
            <div className={`flex bg-white border border-[#dadce0] rounded-xl p-0.5 w-fit ${doc ? 'mb-2' : 'mb-3'}`}>
              {modePill('paste', <ClipboardPaste className="h-3.5 w-3.5" />, 'Paste a job description')}
              {modePill('saved', <Briefcase className="h-3.5 w-3.5" />, `Saved job${jobs.length ? ` (${jobs.length})` : ''}`)}
            </div>

            <div className="flex flex-col md:flex-row gap-3 items-end">
              {mode === 'paste' ? (
                <div className="flex-1 w-full">
                  <textarea
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    rows={doc ? 2 : 5}
                    placeholder="Paste the job description here. We'll tailor your resume to it and add the job to your tracker automatically."
                    className="w-full border border-[#dadce0] bg-[#f8f9fa] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 text-sm text-[#202124] custom-scrollbar resize-y"
                  />
                </div>
              ) : (
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
                  {jobs.length === 0 && (
                    <p className="text-xs text-[#5f6368] mt-1">
                      No saved jobs yet. <Link href="/dashboard" className="text-[#1a73e8] hover:underline">Add one in the tracker</Link>, or just paste a description.
                    </p>
                  )}
                </div>
              )}
              <div className="w-full md:w-60">
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
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#1a73e8] to-[#174ea6] text-white px-6 py-2 rounded-xl hover:opacity-90 disabled:opacity-50 text-sm font-semibold transition-all shadow-lg shadow-blue-200/50 w-full md:w-auto"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? 'Tailoring…' : 'Generate'}
              </button>
              {mode === 'saved' && selectedJobId && (
                <button onClick={() => setSelectedJobId('')} className="text-xs text-[#5f6368] hover:text-[#202124] whitespace-nowrap pb-2">
                  Clear filter
                </button>
              )}
            </div>
          </div>
        </Card>
      )}

      <ResumeWorkspace ws={ws} />
    </div>
  );
}
