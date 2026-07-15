'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Contact, Sparkles, Copy, Check, UserRound } from 'lucide-react';
import { apiFetch, apiJson } from '@/lib/api';
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
    <button onClick={copy} className="text-[#5f6368] hover:text-[#1a73e8] transition flex items-center gap-1 text-sm" aria-label="Copy">
      {copied ? <Check className="h-4 w-4 text-[#1e8e3e]" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// Mirrors the backend's profileHasContent check (aiController.linkedinRewrite):
// the optimizer needs real material to work from, and getProfile auto-creates
// an empty profile, so existence alone isn't a signal.
const profileHasContent = (profile: any) => {
  if (!profile) return false;
  const skills = profile.skills || {};
  return Boolean(
    profile.experience?.length ||
    profile.education?.length ||
    profile.projects?.length ||
    ['languages', 'frameworks', 'tools', 'other'].some((k) => skills[k]?.length) ||
    profile.rawText?.trim()
  );
};

export default function LinkedInPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<any>(null);
  // null = still checking; afterwards a definite yes/no.
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    apiFetch('/api/master')
      .then((profile) => setHasProfile(profileHasContent(profile)))
      // If the check itself fails, don't block the page — the backend
      // enforces the same gate and will answer with PROFILE_EMPTY.
      .catch(() => setHasProfile(true));
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await apiJson('/api/ai/linkedin-rewrite', 'POST', {});
      setContent(data);
    } catch (e: any) {
      if (e.body?.code === 'PROFILE_EMPTY') {
        setHasProfile(false);
      } else {
        showToast(e.message || 'Failed to generate LinkedIn content', 'error');
      }
    }
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#202124] flex items-center gap-2">
          <Contact className="h-7 w-7 text-[#1a73e8]" /> LinkedIn Optimizer
        </h1>
        <p className="text-[#5f6368]">Turn your master profile into polished, keyword-rich LinkedIn content.</p>
      </div>

      {hasProfile === null && (
        <Card className="p-6 mb-8 text-[#5f6368] text-sm animate-pulse">Checking your master profile…</Card>
      )}

      {hasProfile === false && (
        <Card className="p-8 mb-8 text-center">
          <UserRound className="h-10 w-10 mx-auto mb-4 text-[#5f6368]" />
          <h2 className="text-xl font-bold text-[#202124] mb-2">We need to know you first</h2>
          <p className="text-[#5f6368] mb-6 max-w-md mx-auto">
            The optimizer writes your headline and About section from your master profile,
            and yours is still empty. Add your experience, education, or skills — or upload
            an existing resume — and come back.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/profile">
              <Button>
                <UserRound className="h-4 w-4" /> Build your profile
              </Button>
            </Link>
            <Link href="/profile" className="text-[#1a73e8] hover:underline text-sm font-medium">
              or upload a resume
            </Link>
          </div>
        </Card>
      )}

      {hasProfile === true && (
        <Card className="p-6 mb-8 flex items-center justify-between flex-wrap gap-4">
          <p className="text-[#202124] text-sm">Generates a headline, About section, and experience highlights from your profile.</p>
          <Button onClick={handleGenerate} loading={loading}>
            <Sparkles className="h-4 w-4" /> {content ? 'Regenerate' : 'Generate'}
          </Button>
        </Card>
      )}

      {content && (
        <div className="space-y-6 animate-fade-in-up">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-[#1a73e8]">Headline</h3>
              <CopyButton text={content.headline || ''} />
            </div>
            <p className="text-[#202124]">{content.headline}</p>
          </Card>

          <Card className="p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-[#1a73e8]">About</h3>
              <CopyButton text={content.about || ''} />
            </div>
            <p className="text-[#202124] whitespace-pre-wrap leading-relaxed">{content.about}</p>
          </Card>

          {content.experienceHighlights?.length > 0 && (
            <Card className="p-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold text-[#1a73e8]">Experience Highlights</h3>
                <CopyButton text={(content.experienceHighlights || []).map((h: string) => `• ${h}`).join('\n')} />
              </div>
              <ul className="list-disc list-outside ml-5 text-[#202124] space-y-2">
                {content.experienceHighlights.map((h: string, i: number) => <li key={i}>{h}</li>)}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
