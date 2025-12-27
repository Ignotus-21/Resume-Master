'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newJob, setNewJob] = useState({ company: '', role: '', jdText: '', jobUrl: '' });

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/jobs');
      const data = await res.json();
      setJobs(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setLoading(false);
    }
  };

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newJob),
      });
      if (res.ok) {
        fetchJobs();
        setShowAdd(false);
        setNewJob({ company: '', role: '', jdText: '', jobUrl: '' });
      }
    } catch (error) {
      console.error('Error adding job:', error);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`http://localhost:5000/api/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchJobs();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const deleteJob = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await fetch(`http://localhost:5000/api/jobs/${id}`, {
        method: 'DELETE',
      });
      fetchJobs();
    } catch (error) {
      console.error('Error deleting job:', error);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
           <h1 className="text-3xl font-bold text-slate-100">Job Tracker</h1>
           <p className="text-slate-400">Track your applications and generate tailored resumes.</p>
        </div>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-500 transition font-medium shadow-lg shadow-blue-900/50"
        >
          {showAdd ? 'Cancel' : '+ Add Job Application'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAddJob} className="bg-slate-800 p-6 rounded-xl shadow-lg mb-8 border border-slate-700">
          <h2 className="text-xl font-bold mb-6 text-slate-100">Add New Job</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Company Name</label>
                <input 
                  className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  value={newJob.company}
                  onChange={(e) => setNewJob({...newJob, company: e.target.value})}
                  required
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Role / Title</label>
                <input 
                  className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  value={newJob.role}
                  onChange={(e) => setNewJob({...newJob, role: e.target.value})}
                  required
                />
            </div>
            <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-400 mb-2">Job URL</label>
                <input 
                  className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  value={newJob.jobUrl}
                  onChange={(e) => setNewJob({...newJob, jobUrl: e.target.value})}
                />
            </div>
            <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-400 mb-2">Job Description</label>
                <textarea 
                  placeholder="Paste the full job description here..."
                  className="w-full border border-slate-700 bg-slate-900 rounded-lg px-4 py-2 h-32 outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  value={newJob.jdText}
                  onChange={(e) => setNewJob({...newJob, jdText: e.target.value})}
                />
            </div>
          </div>
          <button type="submit" className="bg-green-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-green-500 transition shadow-lg shadow-green-900/50">Save Job</button>
        </form>
      )}

      {loading ? <div className="text-center text-slate-500 py-10">Loading jobs...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <div key={job._id} className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg p-6 flex flex-col justify-between hover:border-slate-600 transition">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-100 leading-tight mb-1">{job.role}</h3>
                    <p className="text-slate-400 font-medium">{job.company}</p>
                  </div>
                  <select 
                    value={job.status}
                    onChange={(e) => updateStatus(job._id, e.target.value)}
                    className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${getStatusColor(job.status)}`}
                  >
                    <option>Wishlist</option>
                    <option>Applied</option>
                    <option>Interviewing</option>
                    <option>Offer</option>
                    <option>Rejected</option>
                  </select>
                </div>
                
                <p className="text-sm text-slate-500 mb-6 truncate">
                  {job.jobUrl ? <a href={job.jobUrl} target="_blank" className="text-blue-400 hover:underline flex items-center gap-1">View Posting ↗</a> : 'No URL provided'}
                </p>
              </div>
              
              <div className="flex justify-between items-center text-sm pt-4 border-t border-slate-700 mt-auto">
                 <Link 
                    href={`/resumes?jobId=${job._id}`} 
                    className="text-blue-400 hover:text-blue-300 font-medium"
                 >
                    Generate Resume
                 </Link>
                 <button onClick={() => deleteJob(job._id)} className="text-slate-500 hover:text-red-400 transition">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getStatusColor(status: string) {
  switch(status) {
    case 'Applied': return 'bg-blue-900/50 text-blue-200';
    case 'Interviewing': return 'bg-yellow-900/50 text-yellow-200';
    case 'Offer': return 'bg-green-900/50 text-green-200';
    case 'Rejected': return 'bg-red-900/50 text-red-200';
    default: return 'bg-slate-700 text-slate-300';
  }
}
