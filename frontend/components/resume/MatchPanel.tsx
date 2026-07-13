'use client';

import { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { apiFetch, apiJson } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

// THE match surface: master profile scored against a job description, with
// missing skills/keywords and a gap analysis. One implementation, rendered in
// two places — the workspace's Match side panel (linked job preselected,
// auto-runs) and the standalone /ats-checker page. Both used to have their
// own copy of this UI; this component replaced them.

function scoreColor(score: number) {
  if (score >= 75) return 'text-[#1e8e3e]';
  if (score >= 50) return 'text-[#f9ab00]';
  return 'text-[#d93025]';
}

export function MatchPanel({
  jobs: jobsProp,
  defaultJobId,
  autoRun = false,
}: {
  /** Tracked jobs for the picker; fetched here when not provided. */
  jobs?: any[];
  /** Preselected job (the open resume's linked job in the workspace). */
  defaultJobId?: string;
  /** Run the scan immediately when a job is preselected. */
  autoRun?: boolean;
}) {
  const { showToast } = useToast();
  const [fetchedJobs, setFetchedJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState(defaultJobId || '');
  const [jdText, setJdText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const jobs = jobsProp ?? fetchedJobs;

  useEffect(() => {
    if (jobsProp) return;
    apiFetch('/api/jobs').then(setFetchedJobs).catch(() => { /* picker just stays empty */ });
  }, [jobsProp]);

  const runScan = async (source: { jobId?: string; jdText?: string }) => {
    if (!source.jobId && !source.jdText?.trim()) {
      showToast('Select a job or paste a job description', 'info');
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const payload = source.jobId ? { jobId: source.jobId } : { jdText: source.jdText };
      setResult(await apiJson('/api/resumes/feedback', 'POST', payload));
    } catch (e: any) {
      showToast(e.message || 'Failed to analyze', 'error');
    }
    setAnalyzing(false);
  };

  // Auto-run once per preselected job — the workspace's "click Match, get the
  // analysis" behavior. StrictMode double-invokes effects, hence the ref.
  const autoRanFor = useRef<string | null>(null);
  useEffect(() => {
    if (!autoRun || !defaultJobId || autoRanFor.current === defaultJobId) return;
    autoRanFor.current = defaultJobId;
    runScan({ jobId: defaultJobId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, defaultJobId]);

  return (
    <div className="space-y-6">
      {/* Source picker */}
      <div className="border border-[#dadce0] rounded-xl p-4 bg-white">
        <label className="block text-sm font-medium text-[#5f6368] mb-2">Pick a tracked job</label>
        <select
          value={selectedJobId}
          onChange={(e) => { setSelectedJobId(e.target.value); if (e.target.value) setJdText(''); }}
          className="w-full border border-[#dadce0] bg-[#f8f9fa] rounded-lg px-4 py-2 h-11 text-[#202124] outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Choose a job --</option>
          {jobs.map((j) => <option key={j._id} value={j._id}>{j.role} at {j.company}</option>)}
        </select>
        <div className="flex items-center gap-3 my-4">
          <div className="h-px bg-[#dadce0] flex-1" />
          <span className="text-xs text-[#5f6368] uppercase">or paste a description</span>
          <div className="h-px bg-[#dadce0] flex-1" />
        </div>
        <textarea
          value={jdText}
          onChange={(e) => { setJdText(e.target.value); if (e.target.value) setSelectedJobId(''); }}
          placeholder="Paste a job description here..."
          className="w-full h-32 border border-[#dadce0] bg-[#f8f9fa] rounded-lg p-4 text-sm text-[#202124] outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="mt-3">
          <Button onClick={() => runScan({ jobId: selectedJobId, jdText })} loading={analyzing}>
            <Sparkles className="h-4 w-4" /> Run match scan
          </Button>
        </div>
      </div>

      {analyzing && <div className="text-center py-12 text-[#1a73e8] animate-pulse">Analyzing your profile against the job…</div>}

      {result && (
        <div className="space-y-6">
          <div className="flex items-center gap-5 border-b border-[#dadce0] pb-5">
            <div className={`text-5xl font-bold ${scoreColor(result.matchScore)}`}>{result.matchScore}%</div>
            <div>
              <div className="text-lg font-bold text-[#202124]">Match Score</div>
              <div className="text-sm text-[#5f6368]">How well your profile fits this job</div>
            </div>
          </div>

          {result.missingSkills?.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-[#d93025] mb-2">Missing Skills</h3>
              <div className="flex flex-wrap gap-2">
                {result.missingSkills.map((s: string, i: number) => (
                  <span key={i} className="bg-[#fce8e6] text-[#d93025] px-3 py-1 rounded-full text-sm border border-[#d93025]">{s}</span>
                ))}
              </div>
            </div>
          )}

          {result.missingKeywords?.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-[#f9ab00] mb-2">Missing Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {result.missingKeywords.map((k: string, i: number) => (
                  <span key={i} className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-sm border border-yellow-200">{k}</span>
                ))}
              </div>
            </div>
          )}

          {result.gapAnalysis && (
            <div>
              <h3 className="text-lg font-bold text-[#1a73e8] mb-2">Gap Analysis</h3>
              <p className="text-[#202124] leading-relaxed bg-[#f8f9fa] p-4 rounded-lg border border-[#dadce0]">{result.gapAnalysis}</p>
            </div>
          )}

          {result.improvements?.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-[#1e8e3e] mb-2">Recommended Improvements</h3>
              <ul className="list-disc list-outside ml-5 text-[#202124] space-y-2">
                {result.improvements.map((imp: string, i: number) => <li key={i}>{imp}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
