'use client';
import { useState } from 'react';
import { Contact, Sparkles, Copy, Check } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast('Copy failed — your browser blocked clipboard access', 'error');
    }
  };
  return (
    <button onClick={copy} className="text-slate-400 hover:text-blue-400 transition flex items-center gap-1 text-sm" aria-label="Copy">
      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function LinkedInPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<any>(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await apiJson('/api/ai/linkedin-rewrite', 'POST', {});
      setContent(data);
    } catch (e: any) {
      showToast(e.message || 'Failed to generate LinkedIn content', 'error');
    }
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-2">
          <Contact className="h-7 w-7 text-blue-400" /> LinkedIn Optimizer
        </h1>
        <p className="text-slate-400">Turn your master profile into polished, keyword-rich LinkedIn content.</p>
      </div>

      <Card className="p-6 mb-8 flex items-center justify-between flex-wrap gap-4">
        <p className="text-slate-300 text-sm">Generates a headline, About section, and experience highlights from your profile.</p>
        <Button onClick={handleGenerate} loading={loading}>
          <Sparkles className="h-4 w-4" /> {content ? 'Regenerate' : 'Generate'}
        </Button>
      </Card>

      {content && (
        <div className="space-y-6 animate-fade-in-up">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-blue-400">Headline</h3>
              <CopyButton text={content.headline || ''} />
            </div>
            <p className="text-slate-200">{content.headline}</p>
          </Card>

          <Card className="p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-blue-400">About</h3>
              <CopyButton text={content.about || ''} />
            </div>
            <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{content.about}</p>
          </Card>

          {content.experienceHighlights?.length > 0 && (
            <Card className="p-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold text-blue-400">Experience Highlights</h3>
                <CopyButton text={(content.experienceHighlights || []).map((h: string) => `• ${h}`).join('\n')} />
              </div>
              <ul className="list-disc list-outside ml-5 text-slate-200 space-y-2">
                {content.experienceHighlights.map((h: string, i: number) => <li key={i}>{h}</li>)}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
