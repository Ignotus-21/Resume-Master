'use client';
import { useState, useEffect } from 'react';
import { MessagesSquare, Sparkles, ChevronRight, RotateCcw } from 'lucide-react';
import { apiFetch, apiJson } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

function scoreColor(score: number) {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

export default function InterviewPage() {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [session, setSession] = useState<any>(null);
  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState('');
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<any>(null);

  useEffect(() => { fetchJobs(); }, []);
  const fetchJobs = async () => {
    try { setJobs(await apiFetch('/api/jobs')); } catch { /* non-fatal */ }
  };

  const startInterview = async () => {
    if (!selectedJobId) return showToast('Select a job first', 'info');
    setStarting(true);
    setLastFeedback(null);
    try {
      const s = await apiJson('/api/interview/start', 'POST', { jobId: selectedJobId });
      setSession(s);
      setCurrent(0);
      setAnswer('');
    } catch (e: any) {
      showToast(e.message || 'Failed to start interview', 'error');
    }
    setStarting(false);
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return showToast('Write an answer first', 'info');
    setSubmitting(true);
    try {
      const question = session.questions[current];
      const data = await apiJson('/api/interview/answer', 'POST', { sessionId: session._id, question, answer });
      setLastFeedback({ score: data.score, feedback: data.feedback });
    } catch (e: any) {
      showToast(e.message || 'Failed to evaluate answer', 'error');
    }
    setSubmitting(false);
  };

  const nextQuestion = () => {
    setLastFeedback(null);
    setAnswer('');
    setCurrent((c) => c + 1);
  };

  const reset = () => {
    setSession(null);
    setLastFeedback(null);
    setAnswer('');
    setCurrent(0);
  };

  const isLast = session && current >= session.questions.length - 1;
  const finished = session && current >= session.questions.length;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-2">
          <MessagesSquare className="h-7 w-7 text-blue-400" /> Mock Interview
        </h1>
        <p className="text-slate-400">Practice role-specific questions and get instant AI feedback.</p>
      </div>

      {!session ? (
        <Card className="p-6">
          <label className="block text-sm font-medium text-slate-400 mb-2">Interview for</label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2 h-11 text-white outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          >
            <option value="">-- Choose a job --</option>
            {jobs.map((j) => <option key={j._id} value={j._id}>{j.role} at {j.company}</option>)}
          </select>
          <Button onClick={startInterview} loading={starting}>
            <Sparkles className="h-4 w-4" /> Start Interview
          </Button>
        </Card>
      ) : finished ? (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Interview complete 🎉</h2>
          <p className="text-slate-400 mb-6">You answered all {session.questions.length} questions. Review your feedback anytime, or run another round.</p>
          <Button onClick={reset}><RotateCcw className="h-4 w-4" /> New Interview</Button>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-slate-500">Question {current + 1} of {session.questions.length}</span>
            <button onClick={reset} className="text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Restart</button>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full mb-6 overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${(current / session.questions.length) * 100}%` }} />
          </div>

          <p className="text-lg font-semibold text-slate-100 mb-4">{session.questions[current]}</p>

          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={!!lastFeedback}
            placeholder="Type your answer..."
            className="w-full h-40 border border-slate-700 bg-slate-900 rounded-lg p-4 text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          />

          {lastFeedback ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-2xl font-bold ${scoreColor(lastFeedback.score)}`}>{lastFeedback.score}/100</span>
                  <span className="text-sm text-slate-400">Answer score</span>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{lastFeedback.feedback}</p>
              </div>
              <Button onClick={nextQuestion}>
                {isLast ? 'Finish' : 'Next Question'} <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="mt-4">
              <Button onClick={submitAnswer} loading={submitting}>Submit Answer</Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
