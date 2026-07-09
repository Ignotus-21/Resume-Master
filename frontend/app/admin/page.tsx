'use client';
import { useState, useEffect } from 'react';
import { apiFetch, apiJson } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Users, Server, ShieldAlert, Activity, UserX, MessageSquare, FileText, Bot, Gauge, Link as LinkIcon, UserRound, Coins, Settings } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  
  const [stats, setStats] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [defaultTokens, setDefaultTokens] = useState('15000');
  const [guestTokens, setGuestTokens] = useState('5000');

  useEffect(() => {
    if (!authLoading) {
      if (!user || !user.isAdmin) {
        router.push('/');
        return;
      }
      fetchData();
    }
  }, [user, authLoading, router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsData, breakdownData] = await Promise.all([
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/token-breakdown')
      ]);
      setStats(statsData);
      setBreakdown(breakdownData);
      setDefaultTokens(breakdownData.config.defaultTokenLimit.toString());
      setGuestTokens(breakdownData.config.guestTokenLimit.toString());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async () => {
    try {
      await apiJson('/api/admin/config', 'POST', {
        defaultTokenLimit: parseInt(defaultTokens),
        guestTokenLimit: parseInt(guestTokens)
      });
      showToast('Global Config Updated Successfully', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update config', 'error');
    }
  };

  const handleGrantTokens = async (userId: string, amount: number) => {
    try {
      await apiJson(`/api/admin/users/${userId}/tokens`, 'POST', { amount });
      showToast(`Granted ${amount} tokens successfully`, 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Failed to grant tokens', 'error');
    }
  };

  if (authLoading || !user?.isAdmin) {
    return <div className="p-8 text-center text-[#5f6368] animate-pulse">Loading admin access...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-[#202124] mb-8">Admin Dashboard</h1>

      {error && (
        <div className="bg-[#fce8e6] border border-[#d93025] text-[#d93025] p-4 rounded-xl mb-8">
          {error}
        </div>
      )}

      {loading && !stats ? (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-[#f8f9fa] border border-[#dadce0] rounded-xl"></div>
          <div className="h-32 bg-[#f8f9fa] border border-[#dadce0] rounded-xl"></div>
        </div>
      ) : (
        <div className="space-y-12">
          
          {/* Global Config */}
          <div>
            <h2 className="text-xl font-bold text-[#202124] mb-4 flex items-center gap-2">
              <Settings className="w-6 h-6 text-[#1a73e8]" /> Global Token Limits
            </h2>
            <Card className="p-6 flex flex-col md:flex-row items-end gap-6 bg-[#f8f9fa]">
              <div className="flex-1">
                <label className="block text-sm font-bold text-[#5f6368] mb-2">Registered User Default Tokens</label>
                <input 
                  type="number" 
                  value={defaultTokens}
                  onChange={e => setDefaultTokens(e.target.value)}
                  className="w-full px-4 py-2 border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold text-[#5f6368] mb-2">Anonymous Guest Tokens (Rolling)</label>
                <input 
                  type="number" 
                  value={guestTokens}
                  onChange={e => setGuestTokens(e.target.value)}
                  className="w-full px-4 py-2 border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
                />
              </div>
              <Button onClick={handleUpdateConfig} className="bg-[#1e8e3e] hover:bg-[#188038] text-white">Save Changes</Button>
            </Card>
          </div>

          {/* Token Breakdown Table */}
          {breakdown && (
            <div>
              <h2 className="text-xl font-bold text-[#202124] mb-4 flex items-center gap-2">
                <Users className="w-6 h-6 text-[#1a73e8]" /> Registered Users Usage
              </h2>
              <div className="overflow-x-auto border border-[#dadce0] rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b border-[#dadce0]">
                      <th className="p-4 font-bold text-[#5f6368]">Email / Name</th>
                      <th className="p-4 font-bold text-[#5f6368]">Tokens Used</th>
                      <th className="p-4 font-bold text-[#5f6368]">Total Limit</th>
                      <th className="p-4 font-bold text-[#5f6368]">Cost (Est)</th>
                      <th className="p-4 font-bold text-[#5f6368]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.registeredUsers.map((u: any) => (
                      <tr key={u.id} className="border-b border-[#dadce0] hover:bg-[#f8f9fa] transition-colors">
                        <td className="p-4">
                          <div className="font-medium text-[#202124]">{u.email}</div>
                          <div className="text-sm text-[#5f6368]">{u.name}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-[#dadce0] rounded-full h-2 overflow-hidden">
                              <div className="bg-[#1a73e8] h-full" style={{ width: `${Math.min(100, (u.usedTokens / u.totalLimit) * 100)}%` }} />
                            </div>
                            <span className="text-sm font-medium text-[#202124]">{u.usedTokens.toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="p-4 font-medium text-[#202124]">{u.totalLimit.toLocaleString()}</td>
                        <td className="p-4 text-[#1e8e3e] font-medium">${((u.usedTokens / 1000000) * 0.15).toFixed(4)}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Button onClick={() => handleGrantTokens(u.id, 5000)} className="py-1 px-3 text-xs bg-blue-50 text-[#1a73e8] hover:bg-blue-100">+5k Tokens</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {breakdown.registeredUsers.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-[#5f6368]">No registered users yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Anonymous Usage */}
          {breakdown && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h2 className="text-xl font-bold text-[#202124] mb-4 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-[#1e8e3e]" /> Live Anonymous Users
                </h2>
                <div className="border border-[#dadce0] rounded-xl bg-white divide-y divide-[#dadce0]">
                  {breakdown.liveGuests.map((g: any, i: number) => (
                    <div key={i} className="p-4 flex items-center justify-between">
                      <span className="font-mono text-sm text-[#5f6368]">{g.identity.slice(0, 15)}...</span>
                      <span className="font-medium text-[#202124]">{g.usedTokens.toLocaleString()} / {guestTokens} tokens</span>
                    </div>
                  ))}
                  {breakdown.liveGuests.length === 0 && (
                    <div className="p-4 text-center text-[#5f6368]">No live guests right now.</div>
                  )}
                </div>
              </div>
              
              <div>
                <h2 className="text-xl font-bold text-[#202124] mb-4 flex items-center gap-2">
                  <UserX className="w-6 h-6 text-[#d93025]" /> Cumulative Inactive Anonymous
                </h2>
                <Card className="p-8 flex flex-col items-center justify-center text-center bg-[#f8f9fa]">
                  <p className="text-[#5f6368] mb-2">Total Tokens Consumed</p>
                  <p className="text-4xl font-extrabold text-[#202124]">{breakdown.cumulativeInactiveGuests?.totalUsed?.toLocaleString() || 0}</p>
                  <p className="text-sm text-[#5f6368] mt-2">Across {breakdown.cumulativeInactiveGuests?.count || 0} unique identities</p>
                </Card>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
