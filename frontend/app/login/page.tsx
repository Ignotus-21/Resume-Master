'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      showToast('Welcome back!', 'success');
      router.push('/dashboard');
    } catch (error: any) {
      showToast(error.message || 'Failed to log in', 'error');
    }
    setSubmitting(false);
  };

  const handleGoogle = async (credential: string) => {
    try {
      await loginWithGoogle(credential);
      showToast('Welcome back!', 'success');
      router.push('/dashboard');
    } catch (error: any) {
      showToast(error.message || 'Google sign-in failed', 'error');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="flex items-center gap-2 justify-center mb-6">
          <Sparkles className="h-6 w-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Log In</h1>
        </div>

        <GoogleSignInButton onCredential={handleGoogle} />

        <div className="flex items-center gap-3 my-6">
          <div className="h-px bg-slate-700 flex-1" />
          <span className="text-xs text-slate-500 uppercase">or</span>
          <div className="h-px bg-slate-700 flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-400">Password</label>
              <Link href="/forgot-password" className="text-xs text-blue-400 hover:underline">Forgot password?</Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button type="submit" loading={submitting} className="w-full">
            <LogIn className="h-4 w-4" />
            Log In
          </Button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-6">
          No account? <Link href="/signup" className="text-blue-400 hover:underline">Sign up</Link>
        </p>
        <p className="text-center text-sm text-slate-500 mt-2">
          <Link href="/dashboard" className="hover:text-slate-300 hover:underline">Continue as guest instead</Link>
        </p>
      </Card>
    </div>
  );
}
