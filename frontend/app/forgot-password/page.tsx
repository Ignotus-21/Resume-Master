'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function ForgotPasswordPage() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiJson('/api/auth/request-password-reset', 'POST', { email });
      setSent(true);
    } catch (e: any) {
      // The endpoint is intentionally generic; still show a friendly message.
      showToast(e.message || 'Something went wrong', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="flex items-center gap-2 justify-center mb-6">
          <Mail className="h-6 w-6 text-[#1a73e8]" />
          <h1 className="text-2xl font-bold text-[#202124]">Reset password</h1>
        </div>

        {sent ? (
          <div className="text-center">
            <p className="text-[#202124] text-sm mb-6">
              If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way. Check your inbox.
            </p>
            <Link href="/login"><Button variant="secondary" className="w-full">Back to log in</Button></Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-[#5f6368] text-sm">Enter your email and we&apos;ll send you a link to reset your password.</p>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[#dadce0] bg-[#f8f9fa] rounded-lg px-4 py-2.5 text-[#202124] outline-none focus:ring-2 focus:ring-[#1a73e8]"
            />
            <Button type="submit" loading={submitting} className="w-full">Send reset link</Button>
            <p className="text-center text-sm text-[#5f6368]">
              <Link href="/login" className="hover:text-[#202124] hover:underline">Back to log in</Link>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
