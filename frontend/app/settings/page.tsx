'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Trash2, User as UserIcon, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, apiJson, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';

interface Quota {
  usingOwnKey: boolean;
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
}

export default function SettingsPage() {
  const { user, loading, logout, refresh } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);

  useEffect(() => {
    if (user) fetchQuota();
  }, [user]);

  const fetchQuota = async () => {
    try {
      const data = await apiFetch('/api/auth/quota');
      setQuota(data);
    } catch (error) {
      console.error('Failed to load quota', error);
    }
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiJson('/api/auth/gemini-key', 'PUT', { apiKey });
      showToast('API key saved — you now have unlimited AI requests.', 'success');
      setApiKey('');
      await Promise.all([refresh(), fetchQuota()]);
    } catch (error: any) {
      showToast(error.message || 'Failed to save API key', 'error');
    }
    setSaving(false);
  };

  const handleRemoveKey = async () => {
    if (!confirm('Remove your Gemini API key? You will go back to the shared free quota.')) return;
    try {
      await apiFetch('/api/auth/gemini-key', { method: 'DELETE' });
      showToast('API key removed', 'success');
      await Promise.all([refresh(), fetchQuota()]);
    } catch (error: any) {
      showToast(error.message || 'Failed to remove API key', 'error');
    }
  };

  if (loading) return <PageSpinner label="Loading settings…" />;

  if (!user) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <Card className="p-8">
          <ShieldCheck className="h-10 w-10 text-[#1a73e8] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#202124] mb-2">Sign in to manage settings</h1>
          <p className="text-[#5f6368] text-sm mb-6">
            Bringing your own Gemini API key (for unlimited AI requests) requires an account so we can store it securely.
          </p>
          <Button className="w-full" onClick={() => router.push('/signup')}>Create an account</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
      <h1 className="text-3xl font-bold text-[#202124]">Settings</h1>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <UserIcon className="h-5 w-5 text-[#1a73e8]" />
          <h2 className="text-lg font-bold text-[#202124]">Account</h2>
        </div>
        <p className="text-[#202124] text-sm">{user.name || 'No name set'}</p>
        <p className="text-[#5f6368] text-sm mb-4">{user.email}</p>
        <Button variant="secondary" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Log Out
        </Button>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <KeyRound className="h-5 w-5 text-[#1a73e8]" />
          <h2 className="text-lg font-bold text-[#202124]">Gemini API Key</h2>
        </div>

        {quota && (
          <div className="mb-4 text-sm rounded-lg border border-[#dadce0] bg-[#f8f9fa]/60 p-3">
            {quota.usingOwnKey ? (
              <span className="text-[#1e8e3e] font-medium">Using your own key — unlimited AI requests.</span>
            ) : (
              <span className="text-[#202124]">
                {quota.remaining}/{quota.limit} free requests remaining this window
                {quota.resetAt && (
                  <> · resets {new Date(quota.resetAt).toLocaleTimeString()}</>
                )}
              </span>
            )}
          </div>
        )}

        <p className="text-[#5f6368] text-sm mb-4">
          The app ships with a shared Gemini key limited to a small free quota. Add your own key (billed to your Google account) for unlimited AI requests.
        </p>

        {user.hasOwnKey ? (
          <Button variant="danger" onClick={handleRemoveKey}>
            <Trash2 className="h-4 w-4" />
            Remove Saved Key
          </Button>
        ) : (
          <form onSubmit={handleSaveKey} className="flex flex-col sm:flex-row gap-3">
            <input
              type="password"
              required
              minLength={10}
              placeholder="Paste your Gemini API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 border border-[#dadce0] bg-[#f8f9fa] rounded-lg px-4 py-2.5 text-[#202124] outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button type="submit" loading={saving}>Save Key</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
