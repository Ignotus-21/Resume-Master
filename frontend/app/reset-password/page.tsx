'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';

function ResetPasswordContent() {
  const params = useSearchParams();
  const token = params.get('token');
  const router = useRouter();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      showToast('Passwords do not match', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await apiJson('/api/auth/reset-password', 'POST', { token, password });
      showToast('Password updated — please log in', 'success');
      router.push('/login');
    } catch (e: any) {
      showToast(e.message || 'Failed to reset password', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="flex items-center gap-2 justify-center mb-6">
          <KeyRound className="h-6 w-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">New password</h1>
        </div>

        {!token ? (
          <div className="text-center">
            <p className="text-slate-400 text-sm mb-6">This reset link is missing its token. Request a new one.</p>
            <Link href="/forgot-password"><Button variant="secondary" className="w-full">Request a new link</Button></Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">At least 8 characters</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Confirm password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button type="submit" loading={submitting} className="w-full">Update password</Button>
          </form>
        )}
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<PageSpinner label="Loading…" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
