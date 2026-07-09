'use client';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Users, Server, ShieldAlert, Activity, UserX, MessageSquare, FileText, Bot, Gauge, Link as LinkIcon, UserRound, Coins } from 'lucide-react';
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
    return <div className="p-8 text-center text-[#5f6368] animate-pulse">Loading admin access...</div>;
  }

  const tokenTotalInput = stats?.tokens ? Object.values(stats.tokens).reduce((acc: any, t: any) => acc + t.input, 0) : 0;
  const tokenTotalOutput = stats?.tokens ? Object.values(stats.tokens).reduce((acc: any, t: any) => acc + t.output, 0) : 0;

  return (
    <div className="container mx-auto px-4 py-8">
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
      ) : stats ? (
        <div className="space-y-8">
          {/* User Stats section */}
          <div>
            <h2 className="text-xl font-bold text-[#202124] mb-4">User Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-blue-50 text-[#1a73e8] rounded-xl">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-[#5f6368]">Total Registered Users</p>
                    <p className="text-3xl font-bold text-[#202124]">{stats.users?.total}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-green-50 text-[#1e8e3e] rounded-xl">
                    <Activity className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-[#5f6368]">Live Registered Users</p>
                    <p className="text-3xl font-bold text-[#202124]">{stats.users?.liveRegistered}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-purple-50 text-purple-600 rounded-xl">
                    <UserX className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-[#5f6368]">Live Anonymous Users</p>
                    <p className="text-3xl font-bold text-[#202124]">{stats.users?.liveAnonymous}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-orange-50 text-[#f9ab00] rounded-xl">
                    <UserRound className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-[#5f6368]">Total Anonymous Visitors</p>
                    <p className="text-3xl font-bold text-[#202124]">{stats.users?.totalAnonymous}</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Token Usage by Service */}
          <div>
            <h2 className="text-xl font-bold text-[#202124] mb-4">Token Usage by Service</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {stats.tokens && Object.keys(stats.tokens).map(service => {
                const s = stats.tokens[service];
                const icons: any = {
                  chat: <MessageSquare className="h-6 w-6" />,
                  resume: <FileText className="h-6 w-6" />,
                  master_profile: <Bot className="h-6 w-6" />,
                  ats_checker: <Gauge className="h-6 w-6" />,
                  linkedin_optimizer: <LinkIcon className="h-6 w-6" />
                };
                return (
                  <Card key={service} className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-blue-50 text-[#1a73e8] rounded-xl">
                        {icons[service] || <Activity className="h-6 w-6" />}
                      </div>
                      <h3 className="text-lg font-bold text-[#202124] capitalize">{service.replace('_', ' ')}</h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#5f6368]">Input Tokens:</span>
                        <span className="font-bold text-[#202124]">{s.input.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#5f6368]">Output Tokens:</span>
                        <span className="font-bold text-[#202124]">{s.output.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-[#dadce0] pt-2 mt-2">
                        <span className="text-[#5f6368]">Total Requests:</span>
                        <span className="font-bold text-[#1a73e8]">{s.requests.toLocaleString()}</span>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Overall Quota & Security Stats */}
          <div>
            <h2 className="text-xl font-bold text-[#202124] mb-4">API & Quota Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-emerald-50 text-[#1e8e3e] rounded-xl">
                    <Coins className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-[#5f6368]">Global Total Tokens</p>
                    <p className="text-3xl font-bold text-[#202124]">
                      {((tokenTotalInput as number) + (tokenTotalOutput as number)).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-blue-50 text-[#1a73e8] rounded-xl">
                    <Server className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-[#5f6368]">Legacy Requests Made</p>
                    <p className="text-3xl font-bold text-[#202124]">{stats.quota?.totalApiRequests}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-orange-50 text-[#f9ab00] rounded-xl">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-[#5f6368]">Identities Tracked</p>
                    <p className="text-3xl font-bold text-[#202124]">{stats.quota?.totalIdentitiesTracked}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-6 border-[#fce8e6] bg-[#fce8e6]/30">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-[#fce8e6] text-[#d93025] rounded-xl">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-[#5f6368]">Users Exhausted Quota</p>
                    <p className="text-3xl font-bold text-[#d93025]">{stats.quota?.identitiesOverQuota}</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
          
        </div>
      ) : null}
    </div>
  );
}
