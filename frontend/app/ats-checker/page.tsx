'use client';
import { useState, useEffect } from 'react';
import { Gauge, Sparkles } from 'lucide-react';
import { apiFetch, apiJson } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

function scoreColor(score: number) {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

export default function AtsCheckerPage() {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [jdText, setJdText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => { fetchJobs(); }, []);
  const fetchJobs = async () => {
    try { setJobs(await apiFetch('/api/jobs')); } catch { /* non-fatal */ }
  };

  const handleScan = async () => {
    if (!selectedJobId && !jdText.trim()) return showToast('Select a job or paste a job description', 'info');
    setAnalyzing(true);
    setResult(null);
    try {
      const payload = selectedJobId ? { jobId: selectedJobId } : { jdText };
      const data = await apiJson('/api/resumes/feedback', 'POST', payload);
      setResult(data);
    } catch (e: any) {
      showToast(e.message || 'Failed to analyze', 'error');
    }
    setAnalyzing(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-2">
          <Gauge className="h-7 w-7 text-blue-400" /> ATS Checker
        </h1>
        <p className="text-slate-400">Score your master profile against a job description and see what's missing.</p>
      </div>

      <Card className="p-6 mb-8">
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-400 mb-2">Pick a tracked job</label>
          <select
            value={selectedJobId}
            onChange={(e) => { setSelectedJobId(e.target.value); if (e.target.value) setJdText(''); }}
            className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2 h-11 text-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Choose a job --</option>
            {jobs.map((j) => <option key={j._id} value={j._id}>{j.role} at {j.company}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3 my-4">
          <div className="h-px bg-slate-700 flex-1" />
          <span className="text-xs text-slate-500 uppercase">or paste a description</span>
          <div className="h-px bg-slate-700 flex-1" />
        </div>
        <textarea
          value={jdText}
          onChange={(e) => { setJdText(e.target.value); if (e.target.value) setSelectedJobId(''); }}
          placeholder="Paste a job description here..."
          className="w-full h-40 border border-slate-700 bg-slate-900 rounded-lg p-4 text-white outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="mt-4">
          <Button onClick={handleScan} loading={analyzing}>
            <Sparkles className="h-4 w-4" /> Run ATS Scan
          </Button>
        </div>
      </Card>

      {analyzing && <div className="text-center py-16 text-blue-400 animate-pulse">Analyzing your profile against the job…</div>}

      {result && (
        <Card className="p-6 space-y-6 animate-fade-in-up">
          <div className="flex items-center gap-6 border-b border-slate-700 pb-6">
            <div className={`text-5xl font-bold ${scoreColor(result.matchScore)}`}>{result.matchScore}%</div>
            <div>
              <div className="text-lg font-bold text-white">Match Score</div>
              <div className="text-sm text-slate-400">How well your profile fits this job</div>
            </div>
          </div>

          {result.missingSkills?.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-red-400 mb-2">Missing Skills</h3>
              <div className="flex flex-wrap gap-2">
                {result.missingSkills.map((s: string, i: number) => (
                  <span key={i} className="bg-red-900/30 text-red-200 px-3 py-1 rounded-full text-sm border border-red-800">{s}</span>
                ))}
              </div>
            </div>
          )}

          {result.missingKeywords?.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-yellow-400 mb-2">Missing Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {result.missingKeywords.map((k: string, i: number) => (
                  <span key={i} className="bg-yellow-900/30 text-yellow-200 px-3 py-1 rounded-full text-sm border border-yellow-800">{k}</span>
                ))}
              </div>
            </div>
          )}

          {result.gapAnalysis && (
            <div>
              <h3 className="text-lg font-bold text-blue-400 mb-2">Gap Analysis</h3>
              <p className="text-slate-300 leading-relaxed bg-slate-900 p-4 rounded-lg border border-slate-700">{result.gapAnalysis}</p>
            </div>
          )}

          {result.improvements?.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-emerald-400 mb-2">Recommended Improvements</h3>
              <ul className="list-disc list-outside ml-5 text-slate-300 space-y-2">
                {result.improvements.map((imp: string, i: number) => <li key={i}>{imp}</li>)}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
