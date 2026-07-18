'use client';
import { useState } from 'react';
import { MailWarning } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

// Shown to logged-in users who haven't verified their email yet. AI features are
// gated until they do, so we surface a persistent, dismissable reminder + resend.
export function VerifyEmailBanner() {
  const { user, loading } = useAuth();
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (loading || !user || user.emailVerified || dismissed) return null;

  const resend = async () => {
    setSending(true);
    try {
      await apiFetch('/api/auth/resend-verification', { method: 'POST' });
      showToast('Verification email sent, check your inbox', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not resend verification', 'error');
    }
    setSending(false);
  };

  return (
    <div className="bg-amber-50 border-b border-amber-300 text-amber-900 no-print">
      <div className="container mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2">
          <MailWarning className="h-4 w-4 shrink-0" />
          Verify your email to unlock AI features. We sent a link to {user.email}.
        </span>
        <div className="flex items-center gap-3">
          <button onClick={resend} disabled={sending} className="font-semibold underline text-amber-900 hover:text-amber-950 disabled:opacity-60">
            {sending ? 'Sending…' : 'Resend link'}
          </button>
          <button onClick={() => setDismissed(true)} className="text-amber-700 hover:text-amber-900" aria-label="Dismiss">✕</button>
        </div>
      </div>
    </div>
  );
}
