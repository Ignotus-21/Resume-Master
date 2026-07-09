'use client';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Users, Server, ShieldAlert, Activity } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user || !user.isAdmin) {
        router.push('/');
        return;
      }
      fetchStats();
    }
  }, [user, authLoading, router]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/admin/stats');
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch admin stats');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user?.isAdmin) {
    return <div className="p-8 text-center text-zinc-400 animate-pulse">Loading admin access...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-8">Admin Dashboard</h1>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-xl mb-8">
          {error}
        </div>
      )}

      {loading && !stats ? (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-white/5 rounded-xl"></div>
          <div className="h-32 bg-white/5 rounded-xl"></div>
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-purple-500/20 text-purple-400 rounded-xl">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-zinc-400">Total Users</p>
                <p className="text-3xl font-bold text-white">{stats.users?.total}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-blue-500/20 text-blue-400 rounded-xl">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-zinc-400">Tracked Quota Identities</p>
                <p className="text-3xl font-bold text-white">{stats.quota?.totalIdentitiesTracked}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Server className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-zinc-400">Tokens/Calls Used</p>
                <p className="text-3xl font-bold text-white">{stats.quota?.totalTokensUsed}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-red-500/20">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-red-500/20 text-red-400 rounded-xl">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-zinc-400">Users Exhausted Quota</p>
                <p className="text-3xl font-bold text-red-400">{stats.quota?.identitiesOverQuota}</p>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
