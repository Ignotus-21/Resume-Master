'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ResumesPage() {
  const searchParams = useSearchParams();
  const preSelectedJobId = searchParams.get('jobId');

  const [resumes, setResumes] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState(preSelectedJobId || '');
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [viewResume, setViewResume] = useState<any>(null);
  const [activeView, setActiveView] = useState('preview'); // 'preview', 'code', 'feedback'
  const [recommendations, setRecommendations] = useState<any>(null);
  
  // Edit States
  const [editTitle, setEditTitle] = useState('');
  const [editCode, setEditCode] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchResumes(selectedJobId);
    fetchJobs();
  }, [selectedJobId]);

  useEffect(() => {
    if (preSelectedJobId) setSelectedJobId(preSelectedJobId);
  }, [preSelectedJobId]);

  useEffect(() => {
    if (viewResume) {
      setEditTitle(viewResume.versionName);
      setEditCode(viewResume.latexCode);
      setRecommendations(null); // Clear old recommendations when switching resumes
    }
  }, [viewResume]);

  const fetchResumes = async (filterJobId = '') => {
    const url = filterJobId 
      ? `http://localhost:5000/api/resumes?jobId=${filterJobId}` 
      : 'http://localhost:5000/api/resumes';
    const res = await fetch(url);
    const data = await res.json();
    setResumes(data);
  };

  const fetchJobs = async () => {
    const res = await fetch('http://localhost:5000/api/jobs');
    const data = await res.json();
    setJobs(data);
  };

  const handleGenerate = async () => {
    if (!selectedJobId) return alert('Select a job first');
    setGenerating(true);
    try {
      const res = await fetch('http://localhost:5000/api/resumes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: selectedJobId }),
      });
      const data = await res.json();
      setResumes([data, ...resumes]);
      setViewResume(data);
      setActiveView('preview');
    } catch (error) {
      console.error('Error generating resume:', error);
      alert('Failed to generate. Ensure Gemini Key is set.');
    }
    setGenerating(false);
  };

  const handleGetFeedback = async () => {
    if (!viewResume || !viewResume.job) return alert('This resume is not linked to a specific job to analyze.');
    setAnalyzing(true);
    setActiveView('feedback');
    try {
      const res = await fetch('http://localhost:5000/api/resumes/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: viewResume.job._id }), // Analyze Master Profile vs Job
      });
      const data = await res.json();
      setRecommendations(data);
    } catch (error) {
      console.error('Error getting feedback:', error);
      alert('Failed to get feedback.');
    }
    setAnalyzing(false);
  };

  const handleUpdate = async () => {
    if (!viewResume) return;
    setSaving(true);
    try {
      const res = await fetch(`http://localhost:5000/api/resumes/${viewResume._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          versionName: editTitle,
          latexCode: editCode
        }),
      });
      const updated = await res.json();
      
      setResumes(resumes.map(r => r._id === updated._id ? updated : r));
      setViewResume(updated);
      setIsEditingTitle(false);
      alert('Resume updated!');
    } catch (error) {
      console.error('Error updating resume:', error);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resume?')) return;
    try {
      await fetch(`http://localhost:5000/api/resumes/${id}`, {
        method: 'DELETE',
      });
      setResumes(resumes.filter(r => r._id !== id));
      if (viewResume?._id === id) setViewResume(null);
    } catch (error) {
      console.error('Error deleting resume:', error);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-100">Resume Creator</h1>
        {selectedJobId && (
            <button 
                onClick={() => setSelectedJobId('')}
                className="text-sm text-slate-400 hover:text-white"
            >
                Clear Filter (Show All)
            </button>
        )}
      </div>

      {/* Generator Section */}
      <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 mb-8">
        <h2 className="text-xl font-bold mb-6 text-slate-100">Create New Resume</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2 text-slate-400">Select Job Application</label>
            <select 
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full border border-slate-600 bg-slate-900 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-purple-500 h-11 text-white"
            >
              <option value="">-- Choose a Job (Filter List) --</option>
              {jobs.map(job => (
                <option key={job._id} value={job._id}>{job.role} at {job.company}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={handleGenerate}
            disabled={generating || !selectedJobId}
            className="bg-purple-600 text-white px-8 py-2 rounded-xl hover:bg-purple-500 disabled:opacity-50 h-11 font-semibold transition shadow-lg shadow-purple-900/50"
          >
            {generating ? 'AI Generating...' : 'Generate Resume'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* List */}
        <div className="col-span-1 border-r border-slate-700 pr-6">
          <h2 className="font-bold mb-4 text-slate-300">
            {selectedJobId ? 'Resumes for Job' : 'All Resumes'} ({resumes.length})
          </h2>
          <div className="space-y-4 max-h-[800px] overflow-y-auto">
            {resumes.map(resume => (
              <div 
                key={resume._id} 
                onClick={() => setViewResume(resume)}
                className={`p-4 border rounded-xl cursor-pointer transition relative group ${viewResume?._id === resume._id ? 'border-purple-500 bg-purple-900/20 ring-1 ring-purple-500/50' : 'hover:bg-slate-800 border-slate-700 bg-slate-800/50'}`}
              >
                <div className="font-bold text-slate-200 mb-1 pr-6 truncate">{resume.versionName}</div>
                {resume.job && (
                    <div className="text-xs text-blue-300 mb-2 truncate">
                        Linked: {resume.job.role} @ {resume.job.company}
                    </div>
                )}
                <div className="text-sm text-slate-500 flex justify-between">
                    <span>{new Date(resume.createdAt).toLocaleDateString()}</span>
                    {resume.atsScore && <span className="text-green-400 font-medium">ATS: {resume.atsScore}</span>}
                </div>
                
                <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(resume._id); }}
                    className="absolute top-2 right-2 text-slate-600 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition"
                    title="Delete Resume"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
              </div>
            ))}
            {resumes.length === 0 && <div className="text-slate-500 italic">No resumes found. Generate one above.</div>}
          </div>
        </div>

        {/* Viewer */}
        <div className="col-span-2">
          {viewResume ? (
            <div>
              <div className="flex justify-between items-center mb-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
                 <div className="flex items-center gap-4 flex-1">
                    {isEditingTitle ? (
                        <input 
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded w-full max-w-sm"
                            autoFocus
                            onBlur={() => { handleUpdate(); setIsEditingTitle(false); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { handleUpdate(); setIsEditingTitle(false); } }}
                        />
                    ) : (
                        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                            {viewResume.versionName}
                            <button onClick={() => setIsEditingTitle(true)} className="text-slate-500 hover:text-blue-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                            </button>
                        </h2>
                    )}
                 </div>

                 <div className="flex gap-2">
                    <div className="flex bg-slate-900 rounded-lg p-1">
                        <button 
                        onClick={() => setActiveView('preview')}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition ${activeView === 'preview' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                        Preview
                        </button>
                        <button 
                        onClick={() => setActiveView('code')}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition ${activeView === 'code' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                        Code
                        </button>
                        <button 
                        onClick={handleGetFeedback}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition ${activeView === 'feedback' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                        Feedback
                        </button>
                    </div>
                    {activeView === 'preview' && (
                        <button 
                            onClick={() => window.print()}
                            className="bg-blue-600 text-white px-4 py-1 rounded-lg text-sm font-medium hover:bg-blue-500 flex items-center gap-1"
                        >
                            <span className="text-lg">⬇</span> PDF
                        </button>
                    )}
                    {activeView === 'code' && (
                        <button 
                            onClick={handleUpdate}
                            disabled={saving}
                            className="bg-green-600 text-white px-4 py-1 rounded-lg text-sm font-medium hover:bg-green-500 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    )}
                 </div>
              </div>

              {activeView === 'preview' && (
                  <div className="w-full h-[800px] border border-slate-700 bg-white text-black p-8 rounded-xl overflow-y-auto shadow-inner printable-area">
                      <ResumePreview data={viewResume.tailoredData || {}} />
                  </div>
              )}

              {activeView === 'code' && (
                  <div>
                    <p className="text-sm text-slate-500 mb-3">Edit the LaTeX code directly.</p>
                    <textarea 
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                        className="w-full h-[700px] font-mono text-sm border border-slate-700 p-4 rounded-xl bg-slate-900 text-slate-300 outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
              )}

              {activeView === 'feedback' && (
                  <div className="w-full min-h-[600px] border border-slate-700 p-6 rounded-xl bg-slate-800 text-slate-200">
                      {analyzing ? (
                          <div className="text-center py-20 animate-pulse text-purple-400">AI Analysis in progress...</div>
                      ) : recommendations ? (
                          <div className="space-y-6">
                              <div className="flex items-center gap-4 border-b border-slate-700 pb-4">
                                  <div className="text-4xl font-bold text-green-400">{recommendations.matchScore}%</div>
                                  <div>
                                      <div className="text-lg font-bold text-white">Match Score</div>
                                      <div className="text-sm text-slate-400">Based on Job Description</div>
                                  </div>
                              </div>
                              
                              <div>
                                  <h3 className="text-lg font-bold text-red-400 mb-2">Missing Skills</h3>
                                  <div className="flex flex-wrap gap-2">
                                      {recommendations.missingSkills?.map((s: string, i: number) => (
                                          <span key={i} className="bg-red-900/30 text-red-200 px-3 py-1 rounded-full text-sm border border-red-800">{s}</span>
                                      ))}
                                  </div>
                              </div>

                              <div>
                                  <h3 className="text-lg font-bold text-yellow-400 mb-2">Missing Keywords</h3>
                                  <div className="flex flex-wrap gap-2">
                                      {recommendations.missingKeywords?.map((k: string, i: number) => (
                                          <span key={i} className="bg-yellow-900/30 text-yellow-200 px-3 py-1 rounded-full text-sm border border-yellow-800">{k}</span>
                                      ))}
                                  </div>
                              </div>

                              <div>
                                  <h3 className="text-lg font-bold text-blue-400 mb-2">Gap Analysis</h3>
                                  <p className="text-slate-300 leading-relaxed bg-slate-900 p-4 rounded-lg border border-slate-700">
                                      {recommendations.gapAnalysis}
                                  </p>
                              </div>

                              <div>
                                  <h3 className="text-lg font-bold text-green-400 mb-2">Recommended Improvements</h3>
                                  <ul className="list-disc list-outside ml-5 text-slate-300 space-y-2">
                                      {recommendations.improvements?.map((imp: string, i: number) => (
                                          <li key={i}>{imp}</li>
                                      ))}
                                  </ul>
                              </div>
                          </div>
                      ) : (
                          <div className="text-center py-20 text-slate-500">
                              Click "Feedback" to analyze your resume against the job description.
                          </div>
                      )}
                  </div>
              )}
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center h-64 text-slate-600 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
               <span className="mb-2 text-4xl">📄</span>
               <p>Select a resume from history to view or edit</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple HTML Resume Renderer (Unchanged)
const ResumePreview = ({ data }: { data: any }) => {
    if (!data || !data.user) return <div className="text-center text-gray-400 mt-20">No preview data available</div>;

    return (
        <div className="max-w-3xl mx-auto font-sans leading-relaxed">
            {/* Header */}
            <div className="text-center border-b pb-4 mb-4">
                <h1 className="text-3xl font-bold uppercase tracking-wider mb-2">{data.user.name}</h1>
                <div className="text-sm text-gray-600 flex justify-center gap-4 flex-wrap">
                    {data.user.email && <span>{data.user.email}</span>}
                    {data.user.phone && <span>{data.user.phone}</span>}
                    {data.user.location && <span>{data.user.location}</span>}
                    {data.user.linkedin && <a href={data.user.linkedin} className="text-blue-600 hover:underline">LinkedIn</a>}
                    {data.user.github && <a href={data.user.github} className="text-blue-600 hover:underline">GitHub</a>}
                </div>
            </div>

            {/* Experience */}
            {data.experience && data.experience.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-sm font-bold uppercase tracking-widest border-b border-black mb-3 pb-1">Experience</h2>
                    {data.experience.map((exp: any, i: number) => (
                        <div key={i} className="mb-4">
                            <div className="flex justify-between items-baseline mb-1">
                                <h3 className="font-bold text-lg">{exp.role}</h3>
                                <span className="text-sm text-gray-600">{exp.startDate} – {exp.endDate || 'Present'}</span>
                            </div>
                            <div className="flex justify-between items-baseline mb-2">
                                <span className="text-md font-semibold text-gray-700 italic">{exp.company}</span>
                                <span className="text-sm text-gray-500">{exp.location}</span>
                            </div>
                            <ul className="list-disc list-outside ml-5 text-sm space-y-1 text-gray-700">
                                {exp.bulletPoints?.map((bp: string, j: number) => (
                                    <li key={j}>{bp}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}

            {/* Projects */}
            {data.projects && data.projects.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-sm font-bold uppercase tracking-widest border-b border-black mb-3 pb-1">Projects</h2>
                    {data.projects.map((proj: any, i: number) => (
                        <div key={i} className="mb-3">
                            <div className="flex justify-between items-baseline">
                                <h3 className="font-bold">{proj.title}</h3>
                                {proj.techStack && <span className="text-xs text-gray-500 italic">[{proj.techStack.join(', ')}]</span>}
                            </div>
                            <p className="text-sm text-gray-700 mt-1">{proj.description}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Skills */}
            {data.skills && (
                <div className="mb-6">
                    <h2 className="text-sm font-bold uppercase tracking-widest border-b border-black mb-3 pb-1">Technical Skills</h2>
                    <div className="text-sm text-gray-700 space-y-1">
                        {data.skills.languages && <div><span className="font-bold">Languages:</span> {data.skills.languages.join(', ')}</div>}
                        {data.skills.frameworks && <div><span className="font-bold">Frameworks:</span> {data.skills.frameworks.join(', ')}</div>}
                        {data.skills.tools && <div><span className="font-bold">Tools:</span> {data.skills.tools.join(', ')}</div>}
                    </div>
                </div>
            )}

            {/* Education */}
            {data.education && data.education.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-sm font-bold uppercase tracking-widest border-b border-black mb-3 pb-1">Education</h2>
                    {data.education.map((edu: any, i: number) => (
                        <div key={i} className="mb-2">
                            <div className="flex justify-between font-bold text-sm">
                                <span>{edu.institution}</span>
                                <span>{edu.startDate} – {edu.endDate}</span>
                            </div>
                            <div className="text-sm text-gray-700">
                                {edu.degree} in {edu.fieldOfStudy} {edu.gpa && <span>(GPA: {edu.gpa})</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
