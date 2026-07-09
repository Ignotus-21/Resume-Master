'use client';
import { useState, useEffect } from 'react';
import { apiFetch, apiJson } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Users, Server, Activity, UserX, Settings, LayoutDashboard, BarChart3, Bot, FileText, CheckCircle, Briefcase, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';

const SERVICE_COLORS: Record<string, string> = {
  chatbot: 'bg-[#1a73e8]',
  'resume-parser': 'bg-[#1e8e3e]',
  'resume-tailor': 'bg-[#1e8e3e]',
  'latex-generator': 'bg-[#f9ab00]',
  'cover-letter': 'bg-[#9333ea]',
  'interview-prep': 'bg-[#e77c40]',
  'linkedin-optimizer': 'bg-[#0f9d58]',
  other: 'bg-[#5f6368]',
};

const SERVICE_LABELS: Record<string, { label: string, icon: any }> = {
  chatbot: { label: 'AI Chat', icon: Bot },
  'resume-parser': { label: 'Resume Parser', icon: FileText },
  'resume-tailor': { label: 'Resume Tailor', icon: FileText },
  'latex-generator': { label: 'LaTeX Generator', icon: CheckCircle },
  'cover-letter': { label: 'Cover Letter', icon: Briefcase },
  'interview-prep': { label: 'Interview Prep', icon: Briefcase },
  'linkedin-optimizer': { label: 'LinkedIn Optimizer', icon: Briefcase },
  other: { label: 'Other', icon: Server },
};

const ServiceBreakdownBars = ({ services, totalTokens }: { services: any, totalTokens: number }) => {
  if (!services || Object.keys(services).length === 0 || totalTokens === 0) {
    return <div className="text-xs text-[#5f6368] italic">No service data</div>;
  }
  
  return (
    <div className="w-full mt-2">
      <div className="flex h-2 rounded-full overflow-hidden bg-[#dadce0]">
        {Object.entries(services).map(([service, amount]) => {
          const width = Math.max(1, ((amount as number) / totalTokens) * 100);
          return (
            <div 
              key={service}
              title={`${SERVICE_LABELS[service]?.label || service}: ${amount}`}
              className={`h-full ${SERVICE_COLORS[service] || 'bg-[#5f6368]'}`}
              style={{ width: `${width}%` }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 mt-2 text-xs text-[#5f6368]">
        {Object.entries(services).map(([service, amount]) => (
          <div key={service} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${SERVICE_COLORS[service] || 'bg-[#5f6368]'}`}></span>
            <span className="font-medium">{SERVICE_LABELS[service]?.label || service}:</span> {(amount as number).toLocaleString()}
          </div>
        ))}
      </div>
    </div>
  );
};

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
  const [activeTab, setActiveTab] = useState('overview');

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
      setDefaultTokens((breakdownData.config?.defaultTokenLimit || 15000).toString());
      setGuestTokens((breakdownData.config?.guestTokenLimit || 5000).toString());
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

  const renderOverview = () => {
    if (!stats) return null;
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 border-t-4 border-t-[#1a73e8] shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#5f6368] font-semibold text-sm uppercase tracking-wider">Total Users</h3>
              <Users className="text-[#1a73e8] h-5 w-5" />
            </div>
            <p className="text-3xl font-extrabold text-[#202124]">{stats.users.total}</p>
            <p className="text-xs text-[#5f6368] mt-2">{stats.users.verified} verified</p>
          </Card>
          <Card className="p-6 border-t-4 border-t-[#1e8e3e] shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#5f6368] font-semibold text-sm uppercase tracking-wider">Live Registered</h3>
              <Activity className="text-[#1e8e3e] h-5 w-5" />
            </div>
            <p className="text-3xl font-extrabold text-[#202124]">{stats.users.liveRegistered}</p>
            <p className="text-xs text-[#5f6368] mt-2">Active in last 5m</p>
          </Card>
          <Card className="p-6 border-t-4 border-t-[#e77c40] shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#5f6368] font-semibold text-sm uppercase tracking-wider">Live Guests</h3>
              <Users className="text-[#e77c40] h-5 w-5" />
            </div>
            <p className="text-3xl font-extrabold text-[#202124]">{stats.users.liveAnonymous}</p>
            <p className="text-xs text-[#5f6368] mt-2">Active in last 5m</p>
          </Card>
          <Card className="p-6 border-t-4 border-t-[#9333ea] shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#5f6368] font-semibold text-sm uppercase tracking-wider">Total Guests</h3>
              <Server className="text-[#9333ea] h-5 w-5" />
            </div>
            <p className="text-3xl font-extrabold text-[#202124]">{stats.users.totalAnonymous}</p>
            <p className="text-xs text-[#5f6368] mt-2">Lifetime unique IPs</p>
          </Card>
        </div>

        <Card className="p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#202124] mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#1a73e8]" /> Global Token Usage by Service
          </h2>
          <div className="space-y-6">
            {Object.entries(stats.tokens).map(([service, usage]: [string, any]) => {
              const Icon = SERVICE_LABELS[service]?.icon || Server;
              return (
                <div key={service}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-[#5f6368]" />
                      <span className="font-semibold text-[#202124]">{SERVICE_LABELS[service]?.label || service}</span>
                    </div>
                    <span className="text-sm font-medium text-[#202124]">
                      {(usage.input + usage.output).toLocaleString()} tokens
                    </span>
                  </div>
                  <div className="w-full bg-[#f8f9fa] rounded-full h-3 border border-[#dadce0] overflow-hidden flex">
                    {usage.input + usage.output > 0 && (
                      <>
                        <div
                          className="bg-[#1a73e8] h-full"
                          style={{ width: `${(usage.input / (usage.input + usage.output)) * 100}%` }}
                          title={`Input: ${usage.input}`}
                        />
                        <div
                          className="bg-[#e77c40] h-full"
                          style={{ width: `${(usage.output / (usage.input + usage.output)) * 100}%` }}
                          title={`Output: ${usage.output}`}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-[#5f6368]">
                    <span>{usage.input.toLocaleString()} Input</span>
                    <span>{usage.output.toLocaleString()} Output</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6 bg-[#f8f9fa] shadow-sm">
          <h2 className="text-lg font-bold text-[#202124] mb-6 flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#1a73e8]" /> Global Token Limits Configuration
          </h2>
          <div className="flex flex-col md:flex-row items-end gap-6">
            <div className="flex-1 w-full">
              <label className="block text-sm font-bold text-[#5f6368] mb-2">Registered User Default Tokens</label>
              <input 
                type="number" 
                value={defaultTokens}
                onChange={e => setDefaultTokens(e.target.value)}
                className="w-full px-4 py-2 border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
              />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-sm font-bold text-[#5f6368] mb-2">Anonymous Guest Tokens</label>
              <input 
                type="number" 
                value={guestTokens}
                onChange={e => setGuestTokens(e.target.value)}
                className="w-full px-4 py-2 border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
              />
            </div>
            <Button onClick={handleUpdateConfig} className="bg-[#1e8e3e] hover:bg-[#188038] text-white whitespace-nowrap w-full md:w-auto">
              Save Limits
            </Button>
          </div>
        </Card>
      </div>
    );
  };

  const renderRegisteredUsers = () => {
    if (!breakdown) return null;
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#f8f9fa] border-b border-[#dadce0]">
                  <th className="p-4 font-bold text-[#5f6368]">User Identity</th>
                  <th className="p-4 font-bold text-[#5f6368]">Total Usage & Service Breakdown</th>
                  <th className="p-4 font-bold text-[#5f6368]">Quota Limit</th>
                  <th className="p-4 font-bold text-[#5f6368]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.registeredUsers.map((u: any) => (
                  <tr key={u.id} className="border-b border-[#dadce0] hover:bg-[#f8f9fa] transition-colors">
                    <td className="p-4 align-top w-1/4">
                      <div className="font-medium text-[#202124]">{u.email}</div>
                      <div className="text-sm text-[#5f6368]">{u.name}</div>
                    </td>
                    <td className="p-4 w-2/4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-[#202124]">{u.usedTokens.toLocaleString()} tokens used</span>
                        <span className="text-xs font-medium text-[#1e8e3e] border border-[#1e8e3e] px-2 py-0.5 rounded-full">
                          ~${((u.usedTokens / 1000000) * 0.15).toFixed(4)}
                        </span>
                      </div>
                      <ServiceBreakdownBars services={u.services} totalTokens={u.usedTokens} />
                    </td>
                    <td className="p-4 align-top">
                      <div className="font-medium text-[#202124]">{u.totalLimit.toLocaleString()}</div>
                      {u.extraTokens > 0 && <div className="text-xs text-[#1a73e8]">+{u.extraTokens} extra</div>}
                    </td>
                    <td className="p-4 align-top">
                      <Button onClick={() => handleGrantTokens(u.id, 5000)} className="py-1 px-3 text-xs bg-blue-50 text-[#1a73e8] hover:bg-blue-100">
                        +5k Tokens
                      </Button>
                    </td>
                  </tr>
                ))}
                {breakdown.registeredUsers.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-[#5f6368]">No registered users yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const renderGuests = () => {
    if (!breakdown) return null;
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="shadow-sm">
          <div className="p-6 border-b border-[#dadce0]">
            <h2 className="text-lg font-bold text-[#202124] flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#1e8e3e]" /> Live Anonymous Users
            </h2>
            <p className="text-sm text-[#5f6368] mt-1">Guests active in the last 5 minutes</p>
          </div>
          <div className="divide-y divide-[#dadce0]">
            {breakdown.liveGuests.map((g: any, i: number) => (
              <div key={i} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#f8f9fa] transition-colors">
                <div className="w-1/3">
                  <span className="font-mono text-sm text-[#202124] font-medium">{g.identity.slice(0, 20)}...</span>
                </div>
                <div className="w-2/3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-[#202124]">{g.usedTokens.toLocaleString()} tokens used</span>
                    <span className="text-[#5f6368]">Limit: {(breakdown.config?.guestTokenLimit ?? guestTokens).toLocaleString()}</span>
                  </div>
                  <ServiceBreakdownBars services={g.services} totalTokens={g.usedTokens} />
                </div>
              </div>
            ))}
            {breakdown.liveGuests.length === 0 && (
              <div className="p-8 text-center text-[#5f6368]">No live guests right now.</div>
            )}
          </div>
        </Card>

        <Card className="p-8 flex flex-col items-center justify-center text-center bg-[#f8f9fa] shadow-sm">
          <UserX className="w-12 h-12 text-[#5f6368] mb-4" />
          <h2 className="text-xl font-bold text-[#202124] mb-2">
            Cumulative Inactive Anonymous Drain
          </h2>
          <p className="text-[#5f6368] mb-6 max-w-lg">
            This represents the total token consumption of all guest users who are no longer active on the platform.
          </p>
          <div className="bg-white px-8 py-6 rounded-2xl border border-[#dadce0] shadow-sm">
            <p className="text-5xl font-extrabold text-[#d93025] mb-2">
              {breakdown.cumulativeInactiveGuests?.totalUsed?.toLocaleString() || 0}
            </p>
            <p className="text-sm font-bold text-[#5f6368] uppercase tracking-wider">Total Tokens Consumed</p>
            <p className="text-xs text-[#5f6368] mt-4 pt-4 border-t border-[#dadce0]">
              Across {breakdown.cumulativeInactiveGuests?.count || 0} unique IP identities
            </p>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <h1 className="text-3xl font-bold text-[#202124]">Admin Dashboard</h1>
      </div>

      {error && (
        <div className="bg-[#fce8e6] border border-[#d93025] text-[#d93025] p-4 rounded-xl mb-8 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {loading && !stats ? (
        <div className="animate-pulse space-y-8">
          <div className="flex gap-4 mb-8">
            <div className="h-10 w-32 bg-[#f8f9fa] border border-[#dadce0] rounded-full"></div>
            <div className="h-10 w-32 bg-[#f8f9fa] border border-[#dadce0] rounded-full"></div>
          </div>
          <div className="grid grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-[#f8f9fa] border border-[#dadce0] rounded-xl"></div>)}
          </div>
          <div className="h-64 bg-[#f8f9fa] border border-[#dadce0] rounded-xl"></div>
        </div>
      ) : (
        <div>
          {/* Navigation Tabs */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2 custom-scrollbar">
            <Button 
              variant="outline" 
              onClick={() => setActiveTab('overview')}
              className={`rounded-full px-6 transition-colors ${activeTab === 'overview' ? 'bg-[#1a73e8] text-white border-transparent hover:bg-[#1557b0]' : 'text-[#5f6368] hover:bg-[#f8f9fa]'}`}
            >
              <LayoutDashboard className="w-4 h-4 mr-2" /> Overview & Config
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setActiveTab('users')}
              className={`rounded-full px-6 transition-colors ${activeTab === 'users' ? 'bg-[#1a73e8] text-white border-transparent hover:bg-[#1557b0]' : 'text-[#5f6368] hover:bg-[#f8f9fa]'}`}
            >
              <Users className="w-4 h-4 mr-2" /> Registered Users
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setActiveTab('guests')}
              className={`rounded-full px-6 transition-colors ${activeTab === 'guests' ? 'bg-[#1a73e8] text-white border-transparent hover:bg-[#1557b0]' : 'text-[#5f6368] hover:bg-[#f8f9fa]'}`}
            >
              <Server className="w-4 h-4 mr-2" /> Anonymous Guests
            </Button>
          </div>

          {/* Tab Content */}
          <div className="min-h-[500px]">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'users' && renderRegisteredUsers()}
            {activeTab === 'guests' && renderGuests()}
          </div>
        </div>
      )}
    </div>
  );
}
