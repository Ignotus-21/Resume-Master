'use client';
import { useMemo } from 'react';
import { BarChart3, Briefcase, Send, Users, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

// Analytics view for Job Tracker (#35). Moved out of the standalone
// /analytics route so it's a derived view of the jobs the dashboard already
// fetched, not a second GET /api/jobs call.

const STATUSES = ['Wishlist', 'Applied', 'Interviewing', 'Offer', 'Rejected'];
// Solid hex per status, matching the app's badge palette, for accessible bars.
const STATUS_HEX: Record<string, string> = {
  Wishlist: '#64748b',      // slate-500
  Applied: '#3b82f6',       // blue-500
  Interviewing: '#eab308',  // yellow-500
  Offer: '#22c55e',         // emerald-500
  Rejected: '#ef4444',      // red-500
};

function StatTile({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-[#5f6368] mb-2 min-w-0">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-sm whitespace-nowrap truncate">{label}</span>
      </div>
      <div className="text-3xl font-bold text-[#202124]">{value}</div>
      {hint && <div className="text-xs text-[#5f6368] mt-1">{hint}</div>}
    </Card>
  );
}

export function AnalyticsView({ jobs }: { jobs: any[] }) {
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of STATUSES) counts[s] = jobs.filter((j) => j.status === s).length;
    const total = jobs.length;
    const applied = total - counts.Wishlist; // anything past wishlist counts as applied
    const responded = counts.Interviewing + counts.Offer + counts.Rejected;
    const interviewing = counts.Interviewing + counts.Offer;
    const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
    return {
      counts, total, applied,
      responseRate: rate(responded, applied),
      interviewRate: rate(interviewing, applied),
      offerRate: rate(counts.Offer, applied),
      maxCount: Math.max(1, ...STATUSES.map((s) => counts[s])),
    };
  }, [jobs]);

  const byMonth = useMemo(() => {
    // Bucket by month, tracking a sort key so the timeline reads oldest→newest
    // regardless of the order jobs arrive in.
    const map: Record<string, { count: number; sortKey: number }> = {};
    for (const j of jobs) {
      const d = new Date(j.dateApplied || j.createdAt);
      const key = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      const sortKey = d.getFullYear() * 12 + d.getMonth();
      if (!map[key]) map[key] = { count: 0, sortKey };
      map[key].count += 1;
    }
    const entries = Object.entries(map)
      .sort((a, b) => a[1].sortKey - b[1].sortKey)
      .map(([month, { count }]) => [month, count] as [string, number]);
    const max = Math.max(1, ...entries.map(([, v]) => v));
    return { entries, max };
  }, [jobs]);

  if (jobs.length === 0) {
    return <EmptyState icon={BarChart3} title="No data yet" description="Add jobs in the Job Tracker to see your application analytics here." />;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={Briefcase} label="Total tracked" value={stats.total} />
        <StatTile icon={Send} label="Applied" value={stats.applied} hint={`${stats.responseRate}% response rate`} />
        <StatTile icon={Users} label="Interview rate" value={`${stats.interviewRate}%`} hint="of applications" />
        <StatTile icon={Trophy} label="Offer rate" value={`${stats.offerRate}%`} hint="of applications" />
      </div>

      <Card className="p-6">
        <h2 className="font-bold text-[#202124] mb-5">Status breakdown</h2>
        <div className="space-y-3">
          {STATUSES.map((s) => (
            <div key={s} className="flex items-center gap-3">
              <span className="w-24 text-sm text-[#5f6368] shrink-0">{s}</span>
              <div className="flex-1 h-7 bg-[#f8f9fa]/60 rounded-lg overflow-hidden">
                <div
                  className="h-full rounded-lg transition-all flex items-center justify-end px-2"
                  style={{ width: `${(stats.counts[s] / stats.maxCount) * 100}%`, backgroundColor: STATUS_HEX[s], minWidth: stats.counts[s] > 0 ? '1.75rem' : 0 }}
                >
                  {stats.counts[s] > 0 && <span className="text-xs font-bold text-white">{stats.counts[s]}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-bold text-[#202124] mb-5">Applications over time</h2>
        {byMonth.entries.length === 0 ? (
          <p className="text-[#5f6368] text-sm">No dated applications yet.</p>
        ) : (
          <div className="flex items-end gap-3 h-40">
            {byMonth.entries.map(([month, count]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-blue-500/80 rounded-t-md transition-all" style={{ height: `${(count / byMonth.max) * 100}%`, minHeight: '4px' }} title={`${count}`} />
                <span className="text-xs text-[#5f6368]">{month}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
