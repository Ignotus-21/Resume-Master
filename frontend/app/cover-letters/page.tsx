'use client';
import { useState, useEffect } from 'react';
import { Document, Packer, Paragraph } from 'docx';
import { saveAs } from 'file-saver';
import { FileText, Sparkles, Trash2, Download, Save } from 'lucide-react';
import { apiFetch, apiJson } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

const TONES = ['Professional', 'Friendly', 'Enthusiastic', 'Formal'];
const LENGTHS = ['Short', 'Medium', 'Long'];

export default function CoverLettersPage() {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [letters, setLetters] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [tone, setTone] = useState('Professional');
  const [length, setLength] = useState('Medium');
  const [generating, setGenerating] = useState(false);
  const [active, setActive] = useState<any>(null);
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJobs();
    fetchLetters();
  }, []);

  useEffect(() => {
    if (active) setEditBody(active.body);
  }, [active]);

  const fetchJobs = async () => {
    try { setJobs(await apiFetch('/api/jobs')); } catch { /* handled elsewhere */ }
  };
  const fetchLetters = async () => {
    try { setLetters(await apiFetch('/api/cover-letters')); }
    catch (e: any) { showToast(e.message || 'Failed to load cover letters', 'error'); }
  };

  const handleGenerate = async () => {
    if (!selectedJobId) return showToast('Select a job first', 'info');
    setGenerating(true);
    try {
      const letter = await apiJson('/api/cover-letters/generate', 'POST', { jobId: selectedJobId, tone, length });
      setLetters([letter, ...letters]);
      setActive(letter);
      showToast('Cover letter generated', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to generate cover letter', 'error');
    }
    setGenerating(false);
  };

  const handleSave = async () => {
    if (!active) return;
    setSaving(true);
    try {
      const updated = await apiJson(`/api/cover-letters/${active._id}`, 'PUT', { body: editBody });
      setLetters(letters.map((l) => (l._id === updated._id ? updated : l)));
      setActive(updated);
      showToast('Saved', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to save', 'error');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this cover letter?')) return;
    try {
      await apiFetch(`/api/cover-letters/${id}`, { method: 'DELETE' });
      setLetters(letters.filter((l) => l._id !== id));
      if (active?._id === id) setActive(null);
      showToast('Deleted', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to delete', 'error');
    }
  };

  const downloadDocx = async () => {
    try {
      const paragraphs = editBody.split('\n').map((line) => new Paragraph({ text: line }));
      const doc = new Document({ sections: [{ children: paragraphs }] });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${active.versionName || 'cover-letter'}.docx`);
    } catch (e: any) {
      showToast(e.message || 'Failed to generate DOCX', 'error');
    }
  };

  const downloadPdf = () => window.print();

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto min-h-screen">
      <div className="mb-8 no-print">
        <h1 className="text-3xl font-bold text-[#202124] flex items-center gap-2">
          <FileText className="h-7 w-7 text-[#1a73e8]" /> Cover Letters
        </h1>
        <p className="text-[#5f6368]">Generate a tailored cover letter for any job in your tracker.</p>
      </div>

      <Card className="p-6 mb-8 no-print">
        <h2 className="text-lg font-bold text-[#202124] mb-4">Create New</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[#5f6368] mb-2">Job Application</label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full border border-[#dadce0] bg-[#f8f9fa] rounded-lg px-4 py-2 h-11 text-[#202124] outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choose a job --</option>
              {jobs.map((j) => <option key={j._id} value={j._id}>{j.role} at {j.company}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5f6368] mb-2">Tone</label>
            <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full border border-[#dadce0] bg-[#f8f9fa] rounded-lg px-4 py-2 h-11 text-[#202124] outline-none focus:ring-2 focus:ring-blue-500">
              {TONES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5f6368] mb-2">Length</label>
            <select value={length} onChange={(e) => setLength(e.target.value)} className="w-full border border-[#dadce0] bg-[#f8f9fa] rounded-lg px-4 py-2 h-11 text-[#202124] outline-none focus:ring-2 focus:ring-blue-500">
              {LENGTHS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={handleGenerate} loading={generating}>
            <Sparkles className="h-4 w-4" /> Generate Cover Letter
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 no-print">
          <h2 className="font-bold text-[#202124] mb-4">Saved ({letters.length})</h2>
          <div className="space-y-3">
            {letters.length === 0 && <p className="text-[#5f6368] text-sm italic">No cover letters yet.</p>}
            {letters.map((l) => (
              <div
                key={l._id}
                onClick={() => setActive(l)}
                className={`p-4 border rounded-xl cursor-pointer transition group ${active?._id === l._id ? 'border-blue-500 bg-blue-900/20' : 'border-[#dadce0] bg-[#f8f9fa]/50 hover:bg-[#f8f9fa]'}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#202124] truncate">{l.job ? `${l.job.role} @ ${l.job.company}` : l.versionName}</div>
                    <div className="text-xs text-[#5f6368]">{l.tone} · {new Date(l.createdAt).toLocaleDateString()}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(l._id); }} className="text-[#5f6368] hover:text-[#d93025] opacity-0 group-hover:opacity-100 transition" aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          {active ? (
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4 no-print">
                <h2 className="font-bold text-[#202124] truncate">{active.versionName}</h2>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={handleSave} loading={saving}><Save className="h-4 w-4" /> Save</Button>
                  <Button variant="secondary" onClick={downloadDocx}><Download className="h-4 w-4" /> DOCX</Button>
                  <Button variant="secondary" onClick={downloadPdf}><Download className="h-4 w-4" /> PDF</Button>
                </div>
              </div>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="w-full h-[60vh] border border-[#dadce0] bg-[#f8f9fa] text-[#202124] rounded-xl p-5 outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed no-print"
              />
              <div className="printable-area hidden print:block whitespace-pre-wrap p-8 leading-relaxed">{editBody}</div>
            </Card>
          ) : (
            <EmptyState icon={FileText} title="No cover letter selected" description="Generate a new one or pick a saved letter to edit and export." />
          )}
        </div>
      </div>
    </div>
  );
}
