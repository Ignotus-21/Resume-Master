'use client';
import { useState, useEffect } from 'react';
import { MessagesSquare, Sparkles, ChevronRight, RotateCcw, History, ChevronLeft } from 'lucide-react';
import { apiFetch, apiJson } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

function scoreColor(score: number) {
  if (score >= 75) return 'text-[#1e8e3e]';
  if (score >= 50) return 'text-[#f9ab00]';
  return 'text-[#d93025]';
}

function avgScore(turns: any[]) {
  const scored = (turns || []).filter((t) => typeof t.score === 'number');
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((sum, t) => sum + t.score, 0) / scored.length);
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
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [reviewing, setReviewing] = useState<any>(null);

  useEffect(() => { fetchJobs(); fetchSessions(); }, []);
  const fetchJobs = async () => {
    try { setJobs(await apiFetch('/api/jobs')); } catch { /* non-fatal */ }
  };
  const fetchSessions = async () => {
    try { setPastSessions(await apiFetch('/api/interview')); } catch { /* non-fatal */ }
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
    fetchSessions();
  };

  const openReview = async (id: string) => {
    try {
      setReviewing(await apiFetch(`/api/interview/${id}`));
    } catch (e: any) {
      showToast(e.message || 'Failed to load session', 'error');
    }
  };

  const isLast = session && current >= session.questions.length - 1;
  const finished = session && current >= session.questions.length;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#202124] flex items-center gap-2">
          <MessagesSquare className="h-7 w-7 text-[#1a73e8]" /> Mock Interview
        </h1>
        <p className="text-[#5f6368]">Practice role-specific questions and get instant AI feedback.</p>
      </div>

      {reviewing ? (
        <div>
          <button onClick={() => setReviewing(null)} className="text-sm text-[#5f6368] hover:text-[#202124] flex items-center gap-1 mb-4">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <Card className="p-6">
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-lg font-bold text-[#202124]">{reviewing.job ? `${reviewing.job.role} @ ${reviewing.job.company}` : reviewing.role}</h2>
              {avgScore(reviewing.turns) !== null && (
                <span className={`text-lg font-bold ${scoreColor(avgScore(reviewing.turns)!)}`}>{avgScore(reviewing.turns)}/100 avg</span>
              )}
            </div>
            <p className="text-xs text-[#5f6368] mb-6">{new Date(reviewing.createdAt).toLocaleString()}</p>
            {(!reviewing.turns || reviewing.turns.length === 0) ? (
              <p className="text-[#5f6368] text-sm">No answers were recorded in this session.</p>
            ) : (
              <div className="space-y-5">
                {reviewing.turns.map((t: any, i: number) => (
                  <div key={i} className="border-b border-[#dadce0] last:border-0 pb-5 last:pb-0">
                    <p className="font-semibold text-[#202124] mb-1">{t.question}</p>
                    <p className="text-[#5f6368] text-sm mb-3 whitespace-pre-wrap">{t.answer}</p>
                    <div className="rounded-lg border border-[#dadce0] bg-[#f8f9fa]/60 p-3">
                      {typeof t.score === 'number' && <div className={`text-sm font-bold mb-1 ${scoreColor(t.score)}`}>{t.score}/100</div>}
                      <p className="text-[#202124] text-sm">{t.feedback}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : !session ? (
        <>
        <Card className="p-6">
          <label className="block text-sm font-medium text-[#5f6368] mb-2">Interview for</label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full border border-[#dadce0] bg-[#f8f9fa] rounded-lg px-4 py-2 h-11 text-[#202124] outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          >
            <option value="">-- Choose a job --</option>
            {jobs.map((j) => <option key={j._id} value={j._id}>{j.role} at {j.company}</option>)}
          </select>
          <Button onClick={startInterview} loading={starting}>
            <Sparkles className="h-4 w-4" /> Start Interview
          </Button>
        </Card>

        {pastSessions.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-[#5f6368] uppercase tracking-wider mb-3 flex items-center gap-2">
              <History className="h-4 w-4" /> Past interviews
            </h2>
            <div className="space-y-3">
              {pastSessions.map((s) => {
                const avg = avgScore(s.turns);
                return (
                  <button
                    key={s._id}
                    onClick={() => openReview(s._id)}
                    className="w-full text-left p-4 border border-[#dadce0] bg-[#f8f9fa]/50 rounded-xl hover:bg-[#f8f9fa] hover:border-[#dadce0] transition flex justify-between items-center gap-4"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[#202124] truncate">{s.job ? `${s.job.role} @ ${s.job.company}` : s.role || 'Interview'}</div>
                      <div className="text-xs text-[#5f6368]">{new Date(s.createdAt).toLocaleDateString()} · {s.turns?.length || 0} answered</div>
                    </div>
                    {avg !== null && <span className={`text-sm font-bold shrink-0 ${scoreColor(avg)}`}>{avg}/100</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        </>
      ) : finished ? (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold text-[#202124] mb-2">Interview complete 🎉</h2>
          <p className="text-[#5f6368] mb-6">You answered all {session.questions.length} questions. Review your feedback anytime, or run another round.</p>
          <Button onClick={reset}><RotateCcw className="h-4 w-4" /> New Interview</Button>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-[#5f6368]">Question {current + 1} of {session.questions.length}</span>
            <button onClick={reset} className="text-sm text-[#5f6368] hover:text-[#202124] flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Restart</button>
          </div>
          <div className="h-1.5 bg-[#f8f9fa] rounded-full mb-6 overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${(current / session.questions.length) * 100}%` }} />
          </div>

          <p className="text-lg font-semibold text-[#202124] mb-4">{session.questions[current]}</p>

          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={!!lastFeedback}
            placeholder="Type your answer..."
            className="w-full h-40 border border-[#dadce0] bg-[#f8f9fa] rounded-lg p-4 text-[#202124] outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          />

          {lastFeedback ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-[#dadce0] bg-[#f8f9fa]/60 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-2xl font-bold ${scoreColor(lastFeedback.score)}`}>{lastFeedback.score}/100</span>
                  <span className="text-sm text-[#5f6368]">Answer score</span>
                </div>
                <p className="text-[#202124] text-sm leading-relaxed">{lastFeedback.feedback}</p>
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
