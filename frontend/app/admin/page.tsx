'use client';
import { useState, useEffect } from 'react';
import { apiFetch, apiJson } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Users, Server, Activity, UserX, Settings, LayoutDashboard, BarChart3, Bot, FileText, CheckCircle, Briefcase, ShieldAlert, Zap, CalendarDays } from 'lucide-react';
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

// barWidthPercent shrinks only the bar (not the legend) — the timeline uses
// it to make bar lengths comparable across days.
const ServiceBreakdownBars = ({ services, totalTokens, barWidthPercent = 100 }: { services: Record<string, number>, totalTokens: number, barWidthPercent?: number }) => {
  if (!services || Object.keys(services).length === 0 || totalTokens === 0) {
    return <div className="text-xs text-[#5f6368] italic">No service data</div>;
  }

  return (
    <div className="w-full mt-2">
      <div className="flex h-2 rounded-full overflow-hidden bg-[#dadce0]" style={{ width: `${barWidthPercent}%` }}>
        {Object.entries(services).map(([service, amount]) => {
          const width = Math.max(1, (amount / totalTokens) * 100);
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
            <span className="font-medium">{SERVICE_LABELS[service]?.label || service}:</span> {amount.toLocaleString()}
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
  const [compileStats, setCompileStats] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [timeline, setTimeline] = useState<any>(null);
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
      const [statsData, breakdownData, compileData, timelineData] = await Promise.all([
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/token-breakdown'),
        // Optional signals — an older backend without these endpoints
        // shouldn't take down the whole dashboard.
        apiFetch('/api/admin/compile-stats').catch(() => null),
        apiFetch('/api/admin/usage-timeline').catch(() => null),
      ]);
      setStats(statsData);
      setCompileStats(compileData);
      setBreakdown(breakdownData);
      setTimeline(timelineData);
      setDefaultTokens((breakdownData.config?.defaultTokenLimit || 15000).toString());
      setGuestTokens((breakdownData.config?.guestTokenLimit || 5000).toString());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async () => {
    const defaultTokenLimit = parseInt(defaultTokens, 10);
    const guestTokenLimit = parseInt(guestTokens, 10);
    if (!Number.isFinite(defaultTokenLimit) || defaultTokenLimit < 0 ||
        !Number.isFinite(guestTokenLimit) || guestTokenLimit < 0) {
      showToast('Token limits must be non-negative numbers', 'error');
      return;
    }
    try {
      await apiJson('/api/admin/config', 'POST', { defaultTokenLimit, guestTokenLimit });
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
            <p className="text-xs text-[#5f6368] mt-2">Guest IPs that used AI, all time</p>
          </Card>
        </div>

        {compileStats && (
          <Card className="p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#202124] mb-1 flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#f9ab00]" /> Compile Cache
            </h2>
            <p className="text-xs text-[#5f6368] mb-4">Hit rate of the LaTeX compile cache, since the last backend restart.</p>
            {compileStats.sampleCount === 0 ? (
              <div className="text-sm text-[#5f6368] italic">No compiles since restart.</div>
            ) : (
              <>
                <div className="flex items-end gap-8">
                  <div>
                    <p className="text-3xl font-extrabold text-[#202124]">{(compileStats.hitRate * 100).toFixed(1)}%</p>
                    <p className="text-xs text-[#5f6368] mt-1 uppercase tracking-wider">Hit rate</p>
                  </div>
                  <div>
                    <p className="text-3xl font-extrabold text-[#1e8e3e]">{compileStats.hits.toLocaleString()}</p>
                    <p className="text-xs text-[#5f6368] mt-1 uppercase tracking-wider">Hits</p>
                  </div>
                  <div>
                    <p className="text-3xl font-extrabold text-[#d93025]">{compileStats.misses.toLocaleString()}</p>
                    <p className="text-xs text-[#5f6368] mt-1 uppercase tracking-wider">Misses (real compiles)</p>
                  </div>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-[#dadce0] mt-4" title={`${compileStats.hits} hits / ${compileStats.misses} misses`}>
                  <div className="h-full bg-[#1e8e3e]" style={{ width: `${compileStats.hitRate * 100}%` }} />
                  <div className="h-full bg-[#d93025]" style={{ width: `${(1 - compileStats.hitRate) * 100}%` }} />
                </div>
              </>
            )}
          </Card>
        )}

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

  const renderTimeline = () => {
    if (!timeline) {
      return <div className="p-8 text-center text-[#5f6368]">Timeline data is unavailable (backend endpoint missing).</div>;
    }
    const days: any[] = timeline.days || [];
    // Fixed, stable legend order: services in their SERVICE_LABELS order
    // first, then anything unknown — a day dropping in or out of view must
    // never repaint or reorder the survivors.
    const seen = new Set<string>();
    days.forEach((d) => Object.keys(d.services || {}).forEach((s) => seen.add(s)));
    const allServices = [
      ...Object.keys(SERVICE_LABELS).filter((s) => seen.has(s)),
      ...[...seen].filter((s) => !(s in SERVICE_LABELS)),
    ];
    const maxDayTokens = Math.max(1, ...days.map((d) => d.totalTokens || 0));

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="shadow-sm">
          <div className="p-6 border-b border-[#dadce0]">
            <h2 className="text-lg font-bold text-[#202124] flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#1a73e8]" /> Usage Timeline
            </h2>
            <p className="text-sm text-[#5f6368] mt-1">
              Tokens consumed per day, split by service. Covers the last {timeline.windowDays || 90} days
              (per-request records expire after 90 days).
            </p>
            {allServices.length > 0 && (
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-[#5f6368]">
                {allServices.map((service) => (
                  <div key={service} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${SERVICE_COLORS[service] || 'bg-[#5f6368]'}`}></span>
                    {SERVICE_LABELS[service]?.label || service}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="divide-y divide-[#dadce0]">
            {days.map((day) => {
              const serviceTotals: Record<string, number> = {};
              allServices.forEach((s) => {
                if (day.services?.[s]) serviceTotals[s] = day.services[s].total;
              });
              return (
                <div key={day.date} className="p-6 hover:bg-[#f8f9fa] transition-colors">
                  <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-1 mb-1">
                    <span className="font-semibold text-[#202124]">
                      {new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, {
                        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
                      })}
                    </span>
                    <span className="text-sm text-[#5f6368]">
                      <span className="font-bold text-[#202124]">{day.totalTokens.toLocaleString()}</span> tokens
                      · {day.totalRequests.toLocaleString()} request{day.totalRequests === 1 ? '' : 's'}
                    </span>
                  </div>
                  {/* Bar length is comparable across days: scaled to the busiest day. */}
                  <ServiceBreakdownBars
                    services={serviceTotals}
                    totalTokens={day.totalTokens}
                    barWidthPercent={Math.max(2, (day.totalTokens / maxDayTokens) * 100)}
                  />
                </div>
              );
            })}
            {days.length === 0 && (
              <div className="p-8 text-center text-[#5f6368]">No AI usage recorded in this window yet.</div>
            )}
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
                      <div className="font-medium text-[#202124] flex items-center gap-2 flex-wrap">
                        {u.email}
                        {u.isAdmin && <span className="bg-[#1a73e8] text-white text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide uppercase">Admin</span>}
                        {u.isByok && <span className="bg-[#f9ab00] text-[#202124] text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide uppercase">BYOK</span>}
                      </div>
                      <div className="text-sm text-[#5f6368]">{u.name}</div>
                    </td>
                    <td className="p-4 w-2/4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-[#202124]">{u.totalUsage.toLocaleString()} tokens used</span>
                        <span className="text-xs font-medium text-[#1e8e3e] border border-[#1e8e3e] px-2 py-0.5 rounded-full">
                          ~${((u.totalUsage / 1000000) * 0.15).toFixed(4)}
                        </span>
                      </div>
                      <ServiceBreakdownBars services={u.services} totalTokens={u.totalUsage} />
                    </td>
                    <td className="p-4 align-top">
                      {u.isByok ? (
                        <div className="font-bold text-[#f9ab00]">BYOK (Unlimited)</div>
                      ) : u.isAdmin ? (
                        <div className="font-bold text-[#1a73e8]">Unlimited</div>
                      ) : (
                        <>
                          <div className="font-medium text-[#202124]">{u.totalLimit.toLocaleString()}</div>
                          {u.extraTokens > 0 && <div className="text-xs text-[#1a73e8]">+{u.extraTokens} extra</div>}
                        </>
                      )}
                    </td>
                    <td className="p-4 align-top">
                      <button onClick={() => handleGrantTokens(u.id, 5000)} className="py-1 px-3 rounded-full text-xs font-semibold transition-colors bg-[#e8f0fe] text-[#1a73e8] hover:bg-[#d2e3fc]">
                        +5k Tokens
                      </button>
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
                    <span className="font-medium text-[#202124]">{g.usedTokens.toLocaleString()} tokens used this window</span>
                    <span className="text-[#5f6368]">Limit: {(breakdown.config?.guestTokenLimit ?? guestTokens).toLocaleString()}</span>
                  </div>
                  {/* Bar proportions come from the per-service records, so the
                      total must be their sum — g.usedTokens is the current
                      quota window only and would skew the widths. */}
                  <ServiceBreakdownBars
                    services={g.services}
                    totalTokens={Object.values(g.services || {}).reduce((sum: number, v: any) => sum + v, 0)}
                  />
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
            Inactive Anonymous Drain (last 90 days)
          </h2>
          <p className="text-[#5f6368] mb-6 max-w-lg">
            Tokens actually consumed by guests who are not currently active. Computed from
            per-request usage records, which are retained for 90 days.
          </p>
          <div className="bg-white px-8 py-6 rounded-2xl border border-[#dadce0] shadow-sm">
            <p className="text-5xl font-extrabold text-[#d93025] mb-2">
              {breakdown.cumulativeInactiveGuests?.totalUsed?.toLocaleString() || 0}
            </p>
            <p className="text-sm font-bold text-[#5f6368] uppercase tracking-wider">Tokens Consumed</p>
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
            <button 
              onClick={() => setActiveTab('overview')}
              className={`inline-flex items-center justify-center gap-2 px-6 py-2 rounded-full text-sm transition-all font-semibold ${activeTab === 'overview' ? 'bg-[#1a73e8] text-white shadow-md' : 'text-[#202124] border-2 border-[#dadce0] bg-white hover:bg-[#f1f3f4]'}`}
            >
              <LayoutDashboard className="w-4 h-4" /> Overview & Config
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`inline-flex items-center justify-center gap-2 px-6 py-2 rounded-full text-sm transition-all font-semibold ${activeTab === 'timeline' ? 'bg-[#1a73e8] text-white shadow-md' : 'text-[#202124] border-2 border-[#dadce0] bg-white hover:bg-[#f1f3f4]'}`}
            >
              <CalendarDays className="w-4 h-4" /> Usage Timeline
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`inline-flex items-center justify-center gap-2 px-6 py-2 rounded-full text-sm transition-all font-semibold ${activeTab === 'users' ? 'bg-[#1a73e8] text-white shadow-md' : 'text-[#202124] border-2 border-[#dadce0] bg-white hover:bg-[#f1f3f4]'}`}
            >
              <Users className="w-4 h-4" /> Registered Users
            </button>
            <button 
              onClick={() => setActiveTab('guests')}
              className={`inline-flex items-center justify-center gap-2 px-6 py-2 rounded-full text-sm transition-all font-semibold ${activeTab === 'guests' ? 'bg-[#1a73e8] text-white shadow-md' : 'text-[#202124] border-2 border-[#dadce0] bg-white hover:bg-[#f1f3f4]'}`}
            >
              <Server className="w-4 h-4" /> Anonymous Guests
            </button>
          </div>

          {/* Tab Content */}
          <div className="min-h-[500px]">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'timeline' && renderTimeline()}
            {activeTab === 'users' && renderRegisteredUsers()}
            {activeTab === 'guests' && renderGuests()}
          </div>
        </div>
      )}
    </div>
  );
}
