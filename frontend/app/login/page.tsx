'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn, Sparkles, Eye, EyeOff } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);

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
          <Sparkles className="h-6 w-6 text-[#1a73e8]" />
          <h1 className="text-2xl font-bold text-[#202124]">Log In</h1>
        </div>

        <GoogleSignInButton onCredential={handleGoogle} />

        <div className="flex items-center gap-3 my-6">
          <div className="h-px bg-[#dadce0] flex-1" />
          <span className="text-xs text-[#5f6368] uppercase font-medium">or</span>
          <div className="h-px bg-[#dadce0] flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#5f6368] mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[#dadce0] bg-[#f8f9fa] rounded-lg px-4 py-2.5 text-[#202124] outline-none focus:ring-2 focus:ring-[#1a73e8]"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-[#5f6368]">Password</label>
              <Link href="/forgot-password" className="text-xs text-[#1a73e8] hover:underline">Forgot password?</Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-[#dadce0] bg-[#f8f9fa] rounded-lg px-4 py-2.5 text-[#202124] outline-none focus:ring-2 focus:ring-[#1a73e8] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f6368] hover:text-[#202124]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <Button type="submit" loading={submitting} className="w-full">
            <LogIn className="h-4 w-4" />
            Log In
          </Button>
        </form>

        <p className="text-center text-sm text-[#5f6368] mt-6">
          No account? <Link href="/signup" className="text-[#1a73e8] hover:underline font-medium">Sign up</Link>
        </p>
        <p className="text-center text-sm text-[#5f6368] mt-2">
          <Link href="/dashboard" className="hover:text-[#202124] hover:underline">Continue as guest instead</Link>
        </p>
      </Card>
    </div>
  );
}
