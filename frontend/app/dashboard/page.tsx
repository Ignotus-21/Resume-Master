'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Briefcase, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { apiFetch, apiJson } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadgeClass } from '@/components/ui/Badge';

export default function DashboardPage() {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newJob, setNewJob] = useState({ company: '', role: '', jdText: '', jobUrl: '' });

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

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiJson('/api/jobs', 'POST', newJob);
      await fetchJobs();
      setShowAdd(false);
      setNewJob({ company: '', role: '', jdText: '', jobUrl: '' });
      showToast('Job added', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to add job', 'error');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiJson(`/api/jobs/${id}`, 'PUT', { status });
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

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Job Tracker</h1>
          <p className="text-slate-400">Track your applications and generate tailored resumes.</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4" />
          {showAdd ? 'Cancel' : 'Add Job Application'}
        </Button>
      </div>

      {showAdd && (
        <Card className="p-6 mb-8">
          <form onSubmit={handleAddJob}>
            <h2 className="text-xl font-bold mb-6 text-slate-100">Add New Job</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Company Name</label>
                <input
                  className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  value={newJob.company}
                  onChange={(e) => setNewJob({ ...newJob, company: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Role / Title</label>
                <input
                  className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  value={newJob.role}
                  onChange={(e) => setNewJob({ ...newJob, role: e.target.value })}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-400 mb-2">Job URL</label>
                <input
                  className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  value={newJob.jobUrl}
                  onChange={(e) => setNewJob({ ...newJob, jobUrl: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-400 mb-2">Job Description</label>
                <textarea
                  placeholder="Paste the full job description here..."
                  className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2 h-32 outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  value={newJob.jdText}
                  onChange={(e) => setNewJob({ ...newJob, jdText: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" variant="secondary" className="bg-emerald-600 hover:bg-emerald-500 border-0 text-white">
              Save Job
            </Button>
          </form>
        </Card>
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
          action={<Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add Job Application</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <Card key={job._id} hoverable className="p-6 flex flex-col justify-between animate-fade-in-up">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-100 leading-tight mb-1">{job.role}</h3>
                    <p className="text-slate-400 font-medium">{job.company}</p>
                  </div>
                  <select
                    value={job.status}
                    onChange={(e) => updateStatus(job._id, e.target.value)}
                    className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${StatusBadgeClass(job.status)}`}
                  >
                    <option>Wishlist</option>
                    <option>Applied</option>
                    <option>Interviewing</option>
                    <option>Offer</option>
                    <option>Rejected</option>
                  </select>
                </div>

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
                <button onClick={() => deleteJob(job._id)} className="text-slate-500 hover:text-red-400 transition" aria-label="Delete job">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
