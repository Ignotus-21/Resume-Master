'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Briefcase, ExternalLink, Plus, Trash2, Search, Pencil, X } from 'lucide-react';
import { apiFetch, apiJson } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadgeClass } from '@/components/ui/Badge';

const STATUSES = ['Wishlist', 'Applied', 'Interviewing', 'Offer', 'Rejected'];
const EMPTY_FORM = { company: '', role: '', jdText: '', jobUrl: '' };

const SORTS: Record<string, (a: any, b: any) => number> = {
  newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  oldest: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  company: (a, b) => (a.company || '').localeCompare(b.company || ''),
};

export default function DashboardPage() {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'company'>('newest');

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const data = await apiFetch('/api/jobs');
      setJobs(data);
    } catch (error: any) {
      showToast(error.message || 'Failed to load jobs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (job: any) => {
    setEditingId(job._id);
    setForm({ company: job.company || '', role: job.role || '', jdText: job.jdText || '', jobUrl: job.jobUrl || '' });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiJson(`/api/jobs/${editingId}`, 'PUT', form);
        showToast('Job updated', 'success');
      } else {
        await apiJson('/api/jobs', 'POST', form);
        showToast('Job added', 'success');
      }
      await fetchJobs();
      closeForm();
    } catch (error: any) {
      showToast(error.message || 'Failed to save job', 'error');
    }
  };

  const updateStatus = async (job: any, status: string) => {
    try {
      const payload: Record<string, unknown> = { status };
      // Auto-stamp the applied date the first time a job moves to "Applied".
      if (status === 'Applied' && !job.dateApplied) {
        payload.dateApplied = new Date().toISOString();
      }
      await apiJson(`/api/jobs/${job._id}`, 'PUT', payload);
      fetchJobs();
    } catch (error: any) {
      showToast(error.message || 'Failed to update status', 'error');
    }
  };

  const deleteJob = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await apiFetch(`/api/jobs/${id}`, { method: 'DELETE' });
      fetchJobs();
      showToast('Job deleted', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete job', 'error');
    }
  };

  const stats = useMemo(() => {
    const counts: Record<string, number> = { All: jobs.length };
    for (const status of STATUSES) counts[status] = jobs.filter((j) => j.status === status).length;
    return counts;
  }, [jobs]);

  const visibleJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return jobs
      .filter((j) => statusFilter === 'All' || j.status === statusFilter)
      .filter((j) => !term || j.company?.toLowerCase().includes(term) || j.role?.toLowerCase().includes(term))
      .sort(SORTS[sortBy]);
  }, [jobs, search, statusFilter, sortBy]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Job Tracker</h1>
          <p className="text-slate-400">Track your applications and generate tailored resumes.</p>
        </div>
        <Button onClick={() => (showForm ? closeForm() : openAddForm())}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add Job Application'}
        </Button>
      </div>

      {!loading && jobs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {['All', ...STATUSES].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition ${
                statusFilter === status
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
            >
              {status} <span className="opacity-70">({stats[status] ?? 0})</span>
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <Card className="p-6 mb-8">
          <form onSubmit={handleSubmit}>
            <h2 className="text-xl font-bold mb-6 text-slate-100">{editingId ? 'Edit Job' : 'Add New Job'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Company Name</label>
                <input
                  className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Role / Title</label>
                <input
                  className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-400 mb-2">Job URL</label>
                <input
                  className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  value={form.jobUrl}
                  onChange={(e) => setForm({ ...form, jobUrl: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-400 mb-2">Job Description</label>
                <textarea
                  placeholder="Paste the full job description here..."
                  className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2 h-32 outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  value={form.jdText}
                  onChange={(e) => setForm({ ...form, jdText: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" variant="secondary" className="bg-emerald-600 hover:bg-emerald-500 border-0 text-white">
              {editingId ? 'Save Changes' : 'Save Job'}
            </Button>
          </form>
        </Card>
      )}

      {!loading && jobs.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              placeholder="Search by company or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-slate-700 bg-slate-900 rounded-lg pl-9 pr-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="border border-slate-700 bg-slate-900 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="company">Company A–Z</option>
          </select>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-slate-800/40 border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No job applications yet"
          description="Add your first job application to start tracking it and generating tailored resumes."
          action={<Button onClick={openAddForm}><Plus className="h-4 w-4" /> Add Job Application</Button>}
        />
      ) : visibleJobs.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching jobs"
          description="Try a different search term or clear the status filter."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleJobs.map((job) => (
            <Card key={job._id} hoverable className="p-6 flex flex-col justify-between animate-fade-in-up">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-100 leading-tight mb-1">{job.role}</h3>
                    <p className="text-slate-400 font-medium">{job.company}</p>
                  </div>
                  <select
                    value={job.status}
                    onChange={(e) => updateStatus(job, e.target.value)}
                    className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${StatusBadgeClass(job.status)}`}
                  >
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>

                {job.dateApplied && (
                  <p className="text-xs text-slate-500 mb-2">Applied {new Date(job.dateApplied).toLocaleDateString()}</p>
                )}

                <p className="text-sm text-slate-500 mb-6 truncate">
                  {job.jobUrl ? (
                    <a href={job.jobUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                      View Posting <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    'No URL provided'
                  )}
                </p>
              </div>

              <div className="flex justify-between items-center text-sm pt-4 border-t border-slate-700 mt-auto">
                <Link href={`/resumes?jobId=${job._id}`} className="text-blue-400 hover:text-blue-300 font-medium">
                  Generate Resume
                </Link>
                <div className="flex items-center gap-3">
                  <button onClick={() => openEditForm(job)} className="text-slate-500 hover:text-blue-400 transition" aria-label="Edit job">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteJob(job._id)} className="text-slate-500 hover:text-red-400 transition" aria-label="Delete job">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
