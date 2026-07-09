'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get('token');
  const { refresh } = useAuth();
  const [status, setStatus] = useState<'pending' | 'ok' | 'error'>('pending');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the link.');
      return;
    }
    (async () => {
      try {
        await apiJson('/api/auth/verify-email', 'POST', { token });
        setStatus('ok');
        await refresh();
      } catch (e: any) {
        setStatus('error');
        setMessage(e.message || 'Verification failed.');
      }
    })();
  }, [token, refresh]);

  if (status === 'pending') return <PageSpinner label="Verifying your email…" />;

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <Card className="w-full max-w-sm p-8 text-center">
        {status === 'ok' ? (
          <>
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Email verified</h1>
            <p className="text-slate-400 text-sm mb-6">Your account is fully unlocked. You can now use every AI feature.</p>
            <Link href="/dashboard"><Button className="w-full">Go to Dashboard</Button></Link>
          </>
        ) : (
          <>
            <XCircle className="h-10 w-10 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Verification failed</h1>
            <p className="text-slate-400 text-sm mb-6">{message}</p>
            <Link href="/settings"><Button variant="secondary" className="w-full">Resend from Settings</Button></Link>
          </>
        )}
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<PageSpinner label="Loading…" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
