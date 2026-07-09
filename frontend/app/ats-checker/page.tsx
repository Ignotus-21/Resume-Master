'use client';
import { useState, useEffect } from 'react';
import { Gauge, Sparkles } from 'lucide-react';
import { apiFetch, apiJson } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

function scoreColor(score: number) {
  if (score >= 75) return 'text-[#1e8e3e]';
  if (score >= 50) return 'text-[#f9ab00]';
  return 'text-[#d93025]';
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
        <h1 className="text-3xl font-bold text-[#202124] flex items-center gap-2">
          <Gauge className="h-7 w-7 text-[#1a73e8]" /> ATS Checker
        </h1>
        <p className="text-[#5f6368]">Score your master profile against a job description and see what's missing.</p>
      </div>

      <Card className="p-6 mb-8">
        <div className="mb-4">
          <label className="block text-sm font-medium text-[#5f6368] mb-2">Pick a tracked job</label>
          <select
            value={selectedJobId}
            onChange={(e) => { setSelectedJobId(e.target.value); if (e.target.value) setJdText(''); }}
            className="w-full border border-[#dadce0] bg-[#f8f9fa] rounded-lg px-4 py-2 h-11 text-[#202124] outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Choose a job --</option>
            {jobs.map((j) => <option key={j._id} value={j._id}>{j.role} at {j.company}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3 my-4">
          <div className="h-px bg-white flex-1" />
          <span className="text-xs text-[#5f6368] uppercase">or paste a description</span>
          <div className="h-px bg-white flex-1" />
        </div>
        <textarea
          value={jdText}
          onChange={(e) => { setJdText(e.target.value); if (e.target.value) setSelectedJobId(''); }}
          placeholder="Paste a job description here..."
          className="w-full h-40 border border-[#dadce0] bg-[#f8f9fa] rounded-lg p-4 text-[#202124] outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="mt-4">
          <Button onClick={handleScan} loading={analyzing}>
            <Sparkles className="h-4 w-4" /> Run ATS Scan
          </Button>
        </div>
      </Card>

      {analyzing && <div className="text-center py-16 text-[#1a73e8] animate-pulse">Analyzing your profile against the job…</div>}

      {result && (
        <Card className="p-6 space-y-6 animate-fade-in-up">
          <div className="flex items-center gap-6 border-b border-[#dadce0] pb-6">
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
        </Card>
      )}
    </div>
  );
}
