'use client';
import { useState, useEffect, useRef } from 'react';
import { apiFetch, apiJson, API_URL } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { PageSpinner } from '@/components/ui/Spinner';

export default function ProfilePage() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');
  const [rawText, setRawText] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [importPreview, setImportPreview] = useState<any>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  // Auto-Save Effect
  useEffect(() => {
    if (!profile || isFirstLoad.current) {
      if (profile) isFirstLoad.current = false;
      return;
    }

    setSaveStatus('saving');
    const timer = setTimeout(() => {
      saveProfileData(profile);
    }, 1000); 

    return () => clearTimeout(timer);
  }, [profile]);

  const fetchProfile = async () => {
    try {
      let data = await apiFetch('/api/master');
      data = normalizeData(data);
      setProfile(data);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      showToast(error.message || 'Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveProfileData = async (data: any) => {
    try {
      // Deep strip _id to prevent conflicts
      const stripIds = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(stripIds);
        } else if (obj !== null && typeof obj === 'object') {
          const newObj: any = {};
          for (const key in obj) {
            if (key !== '_id' && key !== 'createdAt' && key !== 'updatedAt' && key !== '__v') {
              newObj[key] = stripIds(obj[key]);
            }
          }
          return newObj;
        }
        return obj;
      };

      const cleanData = stripIds(data);

      await apiJson('/api/master', 'POST', cleanData);
      setSaveStatus('saved');
    } catch (error) {
      console.error('Error saving profile:', error);
      setSaveStatus('error');
    }
  };

  const handleIngest = async () => {
    setIngesting(true);
    try {
      const data = await apiJson('/api/master/ingest', 'POST', { text: rawText });
      setProfile(data);
      showToast('Resume parsed and merged!', 'success');
      setRawText('');
    } catch (error: any) {
      console.error('Error ingesting text:', error);
      showToast(error.message || 'Failed to parse text.', 'error');
    }
    setIngesting(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIngesting(true);

    const formData = new FormData();
    formData.append('resume', e.target.files[0]);

    try {
      const res = await fetch(`${API_URL}/api/master/upload-resume`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const parsedData = await res.json();
      if (!res.ok) throw new Error(parsedData.message || 'Failed to upload/parse resume.');
      // Set preview for review modal instead of auto-merging
      setImportPreview(parsedData);
    } catch (error: any) {
      console.error('Error uploading resume:', error);
      showToast(error.message || 'Failed to upload/parse resume.', 'error');
    }
    setIngesting(false);
  };

  const handleConfirmMerge = async (mergedData: any) => {
    // Determine what to merge based on user selection in modal (implemented below)
    // For simplicity, I'll pass the *final* merged state from the modal logic.
    const normalized = normalizeData(mergedData);
    setProfile(normalized);
    setImportPreview(null);
    // Force immediate save to ensure data persists before navigation
    await saveProfileData(normalized);
    showToast('Import merged and saved successfully!', 'success');
  };

  if (loading) return <PageSpinner label="Loading Master Profile..." />;
  if (!profile) return <div className="p-8 text-center text-red-400">Error loading profile. Ensure backend is running.</div>;

  const tabs = ['personal', 'experience', 'education', 'projects', 'skills', 'additional', 'import'];

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen relative">
      {/* Import Review Modal */}
      {importPreview && (
        <ImportReviewModal 
          currentProfile={profile} 
          importData={importPreview} 
          onCancel={() => setImportPreview(null)}
          onConfirm={handleConfirmMerge}
        />
      )}

      <div className="flex justify-between items-center mb-8">
        <div>
           <h1 className="text-3xl font-bold text-slate-100">Master Profile</h1>
           <p className="text-slate-400">Manage your central repository of career data.</p>
        </div>
        <div className="flex items-center gap-4">
            <span className={`text-sm font-medium transition-colors duration-300 ${
                saveStatus === 'saving' ? 'text-blue-400' : 
                saveStatus === 'saved' ? 'text-green-400' : 'text-red-400'
            }`}>
                {saveStatus === 'saving' ? 'Saving...' : 
                 saveStatus === 'saved' ? 'All changes saved' : 'Error saving'}
            </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-700 mb-8 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg transition capitalize font-medium ${
              activeTab === tab 
                ? 'bg-slate-800 text-blue-400 border-b-2 border-blue-500' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700 min-h-[500px]">
        {/* ... (Existing Tab Content Logic Same as Before) ... */}
        {activeTab === 'personal' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Full Name" value={profile.user?.name} onChange={(v: string) => setProfile({...profile, user: {...profile.user, name: v}})} />
            <Input label="Email" value={profile.user?.email} onChange={(v: string) => setProfile({...profile, user: {...profile.user, email: v}})} />
            <Input label="Phone" value={profile.user?.phone} onChange={(v: string) => setProfile({...profile, user: {...profile.user, phone: v}})} />
            <Input label="Location" value={profile.user?.location} onChange={(v: string) => setProfile({...profile, user: {...profile.user, location: v}})} />
            <Input label="LinkedIn" value={profile.user?.linkedin} onChange={(v: string) => setProfile({...profile, user: {...profile.user, linkedin: v}})} />
            <Input label="GitHub" value={profile.user?.github} onChange={(v: string) => setProfile({...profile, user: {...profile.user, github: v}})} />
            <Input label="Website" value={profile.user?.website} onChange={(v: string) => setProfile({...profile, user: {...profile.user, website: v}})} />
          </div>
        )}

        {/* Experience */}
        {activeTab === 'experience' && (
          <div className="space-y-8">
            {profile.experience?.map((exp: any, index: number) => (
              <div key={index} className="border border-slate-700 p-6 rounded-xl bg-slate-900/50 relative group">
                <button 
                  onClick={() => removeItem(profile, setProfile, 'experience', index)}
                  className="absolute top-4 right-4 text-red-400 hover:text-red-300 text-sm"
                >
                  Remove
                </button>
                <div className="grid grid-cols-2 gap-6 mb-4">
                  <Input label="Company" value={exp.company} onChange={(v: string) => updateArrayItem(profile, setProfile, 'experience', index, 'company', v)} />
                  <Input label="Role" value={exp.role} onChange={(v: string) => updateArrayItem(profile, setProfile, 'experience', index, 'role', v)} />
                  <Input label="Start Date" value={exp.startDate} onChange={(v: string) => updateArrayItem(profile, setProfile, 'experience', index, 'startDate', v)} />
                  <Input label="End Date" value={exp.endDate} onChange={(v: string) => updateArrayItem(profile, setProfile, 'experience', index, 'endDate', v)} />
                </div>
                <TextArea label="Bullet Points (One per line)" value={exp.bulletPoints?.join('\n')} onChange={(v: string) => updateArrayItem(profile, setProfile, 'experience', index, 'bulletPoints', v.split('\n'))} />
              </div>
            ))}
            <button 
              onClick={() => setProfile({...profile, experience: [...(profile.experience || []), {}]})}
              className="w-full py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 hover:border-blue-500 hover:text-blue-400 transition"
            >
              + Add Experience
            </button>
          </div>
        )}

        {/* Education */}
        {activeTab === 'education' && (
          <div className="space-y-8">
            {profile.education?.map((edu: any, index: number) => (
              <div key={index} className="border border-slate-700 p-6 rounded-xl bg-slate-900/50 relative">
                <button 
                  onClick={() => removeItem(profile, setProfile, 'education', index)}
                  className="absolute top-4 right-4 text-red-400 hover:text-red-300 text-sm"
                >
                  Remove
                </button>
                <div className="grid grid-cols-2 gap-6 mb-4">
                  <Input label="Institution" value={edu.institution} onChange={(v: string) => updateArrayItem(profile, setProfile, 'education', index, 'institution', v)} />
                  <Input label="Degree" value={edu.degree} onChange={(v: string) => updateArrayItem(profile, setProfile, 'education', index, 'degree', v)} />
                  <Input label="Field of Study" value={edu.fieldOfStudy} onChange={(v: string) => updateArrayItem(profile, setProfile, 'education', index, 'fieldOfStudy', v)} />
                  <Input label="GPA" value={edu.gpa} onChange={(v: string) => updateArrayItem(profile, setProfile, 'education', index, 'gpa', v)} />
                  <Input label="Start Date" value={edu.startDate} onChange={(v: string) => updateArrayItem(profile, setProfile, 'education', index, 'startDate', v)} />
                  <Input label="End Date" value={edu.endDate} onChange={(v: string) => updateArrayItem(profile, setProfile, 'education', index, 'endDate', v)} />
                </div>
                <TextArea label="Relevant Coursework" value={edu.coursework} onChange={(v: string) => updateArrayItem(profile, setProfile, 'education', index, 'coursework', v)} />
              </div>
            ))}
            <button 
              onClick={() => setProfile({...profile, education: [...(profile.education || []), {}]})}
              className="w-full py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 hover:border-blue-500 hover:text-blue-400 transition"
            >
              + Add Education
            </button>
          </div>
        )}

        {/* Projects */}
        {activeTab === 'projects' && (
          <div className="space-y-8">
            {profile.projects?.map((proj: any, index: number) => (
              <div key={index} className="border border-slate-700 p-6 rounded-xl bg-slate-900/50 relative">
                <button 
                  onClick={() => removeItem(profile, setProfile, 'projects', index)}
                  className="absolute top-4 right-4 text-red-400 hover:text-red-300 text-sm"
                >
                  Remove
                </button>
                <div className="grid grid-cols-2 gap-6 mb-4">
                  <Input label="Title" value={proj.title} onChange={(v: string) => updateArrayItem(profile, setProfile, 'projects', index, 'title', v)} />
                  <Input label="Link" value={proj.link} onChange={(v: string) => updateArrayItem(profile, setProfile, 'projects', index, 'link', v)} />
                  <div className="col-span-2">
                    <Input label="Tech Stack (comma separated)" value={proj.techStack?.join(', ')} onChange={(v: string) => updateArrayItem(profile, setProfile, 'projects', index, 'techStack', v.split(',').map((s: string) => s.trim()))} />
                  </div>
                </div>
                <TextArea label="Description" value={proj.description} onChange={(v: string) => updateArrayItem(profile, setProfile, 'projects', index, 'description', v)} />
              </div>
            ))}
            <button 
              onClick={() => setProfile({...profile, projects: [...(profile.projects || []), {}]})}
              className="w-full py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 hover:border-blue-500 hover:text-blue-400 transition"
            >
              + Add Project
            </button>
          </div>
        )}

        {/* Skills */}
        {activeTab === 'skills' && (
          <div className="space-y-6">
            <div className="border border-slate-700 p-6 rounded-xl bg-slate-900/50">
              <h3 className="font-semibold mb-4 text-lg text-slate-200">Technical Skills</h3>
              <div className="space-y-4">
                <Input 
                  label="Languages (comma separated)" 
                  value={profile.skills?.languages?.join(', ')} 
                  onChange={(v: string) => setProfile({...profile, skills: {...profile.skills, languages: v.split(',').map(s => s.trim())}})} 
                />
                <Input 
                  label="Frameworks (comma separated)" 
                  value={profile.skills?.frameworks?.join(', ')} 
                  onChange={(v: string) => setProfile({...profile, skills: {...profile.skills, frameworks: v.split(',').map(s => s.trim())}})} 
                />
                <Input 
                  label="Tools / Developer Tools (comma separated)" 
                  value={profile.skills?.tools?.join(', ')} 
                  onChange={(v: string) => setProfile({...profile, skills: {...profile.skills, tools: v.split(',').map(s => s.trim())}})} 
                />
                <Input 
                  label="Other / Libraries (comma separated)" 
                  value={profile.skills?.other?.join(', ')} 
                  onChange={(v: string) => setProfile({...profile, skills: {...profile.skills, other: v.split(',').map(s => s.trim())}})} 
                />
              </div>
            </div>
          </div>
        )}

        {/* Additional */}
        {activeTab === 'additional' && (
          <div className="space-y-8">
            {/* Certificates */}
            <div className="border border-slate-700 p-6 rounded-xl bg-slate-900/50 relative">
                <h3 className="font-semibold mb-4 text-lg text-slate-200">Certificates</h3>
                {profile.certificates?.map((cert: any, i: number) => (
                    <div key={i} className="mb-4 pb-4 border-b border-slate-800 last:border-0 relative">
                        <button onClick={() => removeItem(profile, setProfile, 'certificates', i)} className="absolute right-0 top-0 text-red-400 text-xs">Remove</button>
                        <Input label="Name" value={cert.name} onChange={(v: string) => updateArrayItem(profile, setProfile, 'certificates', i, 'name', v)} />
                        <Input label="Issuer" value={cert.issuer} onChange={(v: string) => updateArrayItem(profile, setProfile, 'certificates', i, 'issuer', v)} />
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Date" value={cert.date} onChange={(v: string) => updateArrayItem(profile, setProfile, 'certificates', i, 'date', v)} />
                            <Input label="Link" value={cert.link} onChange={(v: string) => updateArrayItem(profile, setProfile, 'certificates', i, 'link', v)} />
                        </div>
                    </div>
                ))}
                <button onClick={() => setProfile({...profile, certificates: [...(profile.certificates || []), {}]})} className="text-blue-400 text-sm hover:underline">+ Add Certificate</button>
            </div>

            {/* Achievements */}
            <div className="border border-slate-700 p-6 rounded-xl bg-slate-900/50 relative">
                <h3 className="font-semibold mb-4 text-lg text-slate-200">Achievements</h3>
                {profile.achievements?.map((ach: any, i: number) => (
                    <div key={i} className="mb-4 pb-4 border-b border-slate-800 last:border-0 relative">
                        <button onClick={() => removeItem(profile, setProfile, 'achievements', i)} className="absolute right-0 top-0 text-red-400 text-xs">Remove</button>
                        <Input label="Title" value={ach.title} onChange={(v: string) => updateArrayItem(profile, setProfile, 'achievements', i, 'title', v)} />
                        <Input label="Date" value={ach.date} onChange={(v: string) => updateArrayItem(profile, setProfile, 'achievements', i, 'date', v)} />
                        <TextArea label="Description" value={ach.description} onChange={(v: string) => updateArrayItem(profile, setProfile, 'achievements', i, 'description', v)} />
                    </div>
                ))}
                <button onClick={() => setProfile({...profile, achievements: [...(profile.achievements || []), {}]})} className="text-blue-400 text-sm hover:underline">+ Add Achievement</button>
            </div>

            {/* Hobbies */}
            <div className="border border-slate-700 p-6 rounded-xl bg-slate-900/50 relative">
                <h3 className="font-semibold mb-4 text-lg text-slate-200">Hobbies & Interests</h3>
                <TextArea 
                    label="List your hobbies (comma or newline separated)" 
                    value={typeof profile.hobbies === 'string' ? profile.hobbies : profile.hobbies?.join('\n')} 
                    onChange={(v: string) => setProfile({...profile, hobbies: v.split('\n')})} 
                />
            </div>

            {/* Patents */}
            <div className="border border-slate-700 p-6 rounded-xl bg-slate-900/50 relative">
                <h3 className="font-semibold mb-4 text-lg text-slate-200">Patents</h3>
                {profile.patents?.map((pat: any, i: number) => (
                    <div key={i} className="mb-4 pb-4 border-b border-slate-800 last:border-0 relative">
                        <button onClick={() => removeItem(profile, setProfile, 'patents', i)} className="absolute right-0 top-0 text-red-400 text-xs">Remove</button>
                        <Input label="Title" value={pat.title} onChange={(v: string) => updateArrayItem(profile, setProfile, 'patents', i, 'title', v)} />
                        <Input label="Patent Number" value={pat.number} onChange={(v: string) => updateArrayItem(profile, setProfile, 'patents', i, 'number', v)} />
                        <Input label="Date" value={pat.date} onChange={(v: string) => updateArrayItem(profile, setProfile, 'patents', i, 'date', v)} />
                        <TextArea label="Description" value={pat.description} onChange={(v: string) => updateArrayItem(profile, setProfile, 'patents', i, 'description', v)} />
                    </div>
                ))}
                <button onClick={() => setProfile({...profile, patents: [...(profile.patents || []), {}]})} className="text-blue-400 text-sm hover:underline">+ Add Patent</button>
            </div>

            {/* Volunteering */}
            <div className="border border-slate-700 p-6 rounded-xl bg-slate-900/50 relative">
                <h3 className="font-semibold mb-4 text-lg text-slate-200">Volunteering</h3>
                {profile.volunteering?.map((vol: any, i: number) => (
                    <div key={i} className="mb-4 pb-4 border-b border-slate-800 last:border-0 relative">
                        <button onClick={() => removeItem(profile, setProfile, 'volunteering', i)} className="absolute right-0 top-0 text-red-400 text-xs">Remove</button>
                        <Input label="Organization" value={vol.organization} onChange={(v: string) => updateArrayItem(profile, setProfile, 'volunteering', i, 'organization', v)} />
                        <Input label="Role" value={vol.role} onChange={(v: string) => updateArrayItem(profile, setProfile, 'volunteering', i, 'role', v)} />
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Start Date" value={vol.startDate} onChange={(v: string) => updateArrayItem(profile, setProfile, 'volunteering', i, 'startDate', v)} />
                            <Input label="End Date" value={vol.endDate} onChange={(v: string) => updateArrayItem(profile, setProfile, 'volunteering', i, 'endDate', v)} />
                        </div>
                        <TextArea label="Description" value={vol.description} onChange={(v: string) => updateArrayItem(profile, setProfile, 'volunteering', i, 'description', v)} />
                    </div>
                ))}
                <button onClick={() => setProfile({...profile, volunteering: [...(profile.volunteering || []), {}]})} className="text-blue-400 text-sm hover:underline">+ Add Volunteering</button>
            </div>

            {/* Custom Sections */}
            <div>
                <h3 className="font-semibold mb-4 text-xl text-purple-400">Custom Sections</h3>
                {profile.customSections?.map((section: any, i: number) => (
                    <div key={i} className="border border-slate-700 p-6 rounded-xl bg-slate-900/50 relative mb-6">
                        <button onClick={() => removeItem(profile, setProfile, 'customSections', i)} className="absolute right-4 top-4 text-red-400 text-sm">Remove Section</button>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-400 mb-1">Section Title (e.g. Speaking, Awards)</label>
                            <input 
                                value={section.title} 
                                onChange={(e) => updateArrayItem(profile, setProfile, 'customSections', i, 'title', e.target.value)}
                                className="w-full border border-slate-700 rounded-lg px-4 py-2 bg-slate-800 text-white font-bold"
                            />
                        </div>
                        
                        <div className="space-y-4 pl-4 border-l-2 border-slate-800">
                            {section.items?.map((item: any, j: number) => (
                                <div key={j} className="bg-slate-800/50 p-4 rounded border border-slate-700 relative">
                                    <button 
                                      onClick={() => {
                                          const newItems = [...section.items];
                                          newItems.splice(j, 1);
                                          updateArrayItem(profile, setProfile, 'customSections', i, 'items', newItems);
                                      }}
                                      className="absolute right-2 top-2 text-red-400 text-xs"
                                    >
                                      Delete Item
                                    </button>
                                    <div className="grid grid-cols-2 gap-4 mb-2">
                                        <Input label="Heading (e.g. Talk Title)" value={item.title} onChange={(v: string) => {
                                            const newItems = [...section.items];
                                            newItems[j] = { ...newItems[j], title: v };
                                            updateArrayItem(profile, setProfile, 'customSections', i, 'items', newItems);
                                        }} />
                                        <Input label="Sub-heading / Role" value={item.subtitle} onChange={(v: string) => {
                                            const newItems = [...section.items];
                                            newItems[j] = { ...newItems[j], subtitle: v };
                                            updateArrayItem(profile, setProfile, 'customSections', i, 'items', newItems);
                                        }} />
                                        <Input label="Date" value={item.date} onChange={(v: string) => {
                                            const newItems = [...section.items];
                                            newItems[j] = { ...newItems[j], date: v };
                                            updateArrayItem(profile, setProfile, 'customSections', i, 'items', newItems);
                                        }} />
                                        <Input label="Link" value={item.link} onChange={(v: string) => {
                                            const newItems = [...section.items];
                                            newItems[j] = { ...newItems[j], link: v };
                                            updateArrayItem(profile, setProfile, 'customSections', i, 'items', newItems);
                                        }} />
                                    </div>
                                    <TextArea label="Description / Bullet Points" value={item.description} onChange={(v: string) => {
                                        const newItems = [...section.items];
                                        newItems[j] = { ...newItems[j], description: v };
                                        updateArrayItem(profile, setProfile, 'customSections', i, 'items', newItems);
                                    }} />
                                </div>
                            ))}
                            <button 
                                onClick={() => {
                                    const newItems = [...(section.items || []), {}];
                                    updateArrayItem(profile, setProfile, 'customSections', i, 'items', newItems);
                                }}
                                className="text-green-400 text-sm font-medium hover:underline"
                            >
                                + Add Item to {section.title || 'Section'}
                            </button>
                        </div>
                    </div>
                ))}
                <button 
                    onClick={() => setProfile({...profile, customSections: [...(profile.customSections || []), { items: [] }]})}
                    className="w-full py-3 border-2 border-dashed border-purple-500/50 rounded-xl text-purple-300 hover:bg-purple-900/20 transition font-bold"
                >
                    + Add New Custom Section
                </button>
            </div>
          </div>
        )}

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className="space-y-8">
            <div className="bg-slate-900/50 border border-slate-700 p-6 rounded-xl">
               <h3 className="text-lg font-semibold text-slate-200 mb-2">Option 1: Upload PDF Resume</h3>
               <p className="text-slate-400 text-sm mb-4">Upload your resume to extract data. You will be able to review and merge the extracted info.</p>
               <input 
                 type="file" 
                 accept=".pdf"
                 onChange={handleFileUpload}
                 disabled={ingesting}
                 className="block w-full text-sm text-slate-400
                   file:mr-4 file:py-2.5 file:px-6
                   file:rounded-lg file:border-0
                   file:text-sm file:font-semibold
                   file:bg-blue-600 file:text-white
                   hover:file:bg-blue-500
                   file:cursor-pointer cursor-pointer
                 "
               />
               {ingesting && <p className="text-blue-400 text-sm mt-2 animate-pulse">Processing file... Please wait...</p>}
            </div>

            <div className="bg-slate-900/50 border border-slate-700 p-6 rounded-xl">
               <h3 className="text-lg font-semibold text-slate-200 mb-2">Option 2: Import from LinkedIn</h3>
               <p className="text-slate-400 text-sm mb-3">Export your LinkedIn profile as a PDF, then upload it here — we&apos;ll extract your experience, education, and skills automatically.</p>
               <ol className="text-slate-400 text-sm list-decimal list-inside space-y-1 mb-4">
                 <li>Open your LinkedIn profile</li>
                 <li>Click <span className="text-slate-300 font-medium">More</span> → <span className="text-slate-300 font-medium">Save to PDF</span></li>
                 <li>Upload the downloaded PDF below</li>
               </ol>
               <input
                 type="file"
                 accept=".pdf"
                 onChange={handleFileUpload}
                 disabled={ingesting}
                 className="block w-full text-sm text-slate-400
                   file:mr-4 file:py-2.5 file:px-6
                   file:rounded-lg file:border-0
                   file:text-sm file:font-semibold
                   file:bg-[#0a66c2] file:text-white
                   hover:file:bg-[#0958a8]
                   file:cursor-pointer cursor-pointer
                 "
               />
            </div>

            <div className="border-t border-slate-700 my-4"></div>

            <div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">Option 3: Paste Text</h3>
              <textarea 
                className="w-full h-64 border border-slate-700 rounded-xl p-4 bg-slate-900 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste resume content here..."
              />
              <div className="flex justify-end mt-4">
                <button 
                  onClick={handleIngest}
                  disabled={ingesting}
                  className="bg-green-600 text-white px-8 py-3 rounded-xl hover:bg-green-500"
                >
                  {ingesting ? 'Analyzing...' : 'Parse & Merge'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// === IMPORT REVIEW MODAL ===
const ImportReviewModal = ({ currentProfile, importData, onCancel, onConfirm }: any) => {
  const [merged, setMerged] = useState({ ...currentProfile });
  const [addedItems, setAddedItems] = useState<Record<string, number[]>>({});

  const addItem = (key: string, item: any, index: number) => {
    const newList = [...(merged[key] || []), item];
    setMerged({ ...merged, [key]: newList });
    setAddedItems({
      ...addedItems,
      [key]: [...(addedItems[key] || []), index]
    });
  };

  const [infoUpdated, setInfoUpdated] = useState(false);
  const overwriteInfo = () => {
    setMerged({ ...merged, user: { ...merged.user, ...importData.user } });
    setInfoUpdated(true);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8">
      <div className="bg-slate-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl border border-slate-600">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Review Import</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-white">✕</button>
        </div>
        
        <div className="p-6 space-y-8">
          {/* User Info */}
          <div>
            <h3 className="text-lg font-bold text-blue-400 mb-2">Personal Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 p-4 rounded border border-slate-700">
                <div className="font-bold text-xs text-slate-500 uppercase mb-2">Current</div>
                <div className="text-sm text-slate-300 space-y-1">
                    {Object.entries(currentProfile.user || {}).map(([k, v]: any) => (
                        v && <div key={k}><span className="text-slate-500">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : v}</div>
                    ))}
                </div>
              </div>
              <div className="bg-slate-900 p-4 rounded border border-blue-900">
                <div className="font-bold text-xs text-blue-500 uppercase mb-2">New (from PDF)</div>
                <div className="text-sm text-blue-200 space-y-1 mb-3">
                    {Object.entries(importData.user || {}).map(([k, v]: any) => (
                        v && <div key={k}><span className="text-blue-500">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : v}</div>
                    ))}
                </div>
                <button
                  onClick={overwriteInfo}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-500 transition"
                >
                  {infoUpdated ? 'Info Updated ✓' : 'Use New Info'}
                </button>
              </div>
            </div>
          </div>

          {/* Arrays (Dynamic Sections) */}
          {Object.keys(importData).filter(key => Array.isArray(importData[key])).map((key) => (
            <div key={key}>
              <h3 className="text-lg font-bold text-blue-400 mb-2 capitalize">{key}</h3>
              <div className="bg-slate-900 p-4 rounded border border-slate-700">
                 <p className="text-sm text-slate-400 mb-3">
                   Found <strong>{importData[key]?.length || 0}</strong> items. 
                 </p>
                 {importData[key]?.length > 0 && (
                   <div className="space-y-3">
                     {importData[key].map((item: any, i: number) => {
                       const isAdded = addedItems[key]?.includes(i);
                       // Determine display labels dynamically
                       const mainLabel = item.company || item.institution || item.title || item.name || item.organization || 'Unknown Item';
                       const subLabel = item.role || item.degree || item.issuer || item.subtitle || item.number || '';
                       
                       return (
                         <div key={i} className="flex justify-between items-center p-3 bg-slate-800 rounded border border-slate-600">
                           <div className="text-sm text-slate-200">
                             <div className="font-bold">{mainLabel}</div>
                             {subLabel && <div className="text-slate-400">{subLabel}</div>}
                           </div>
                           <button 
                             onClick={() => addItem(key, item, i)}
                             disabled={isAdded}
                             className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                               isAdded 
                                 ? 'bg-green-900/50 text-green-400 border border-green-800 cursor-default' 
                                 : 'bg-blue-600 text-white hover:bg-blue-500'
                             }`}
                           >
                             {isAdded ? 'Added' : 'Add'}
                           </button>
                         </div>
                       );
                     })}
                   </div>
                 )}
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-slate-700 flex justify-end gap-4">
          <button onClick={onCancel} className="px-6 py-2 text-slate-300 hover:text-white">Cancel</button>
          <button 
            onClick={() => onConfirm(merged)} 
            className="px-8 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-500 shadow-lg transition"
          >
            Confirm & Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// Helpers (Unchanged)
const Input = ({ label, value, onChange }: any) => (
  <div>
    <label className="block text-sm font-medium text-slate-400 mb-2">{label}</label>
    <input 
      type="text" 
      value={value || ''} 
      onChange={(e) => onChange(e.target.value)} 
      className="w-full border border-slate-700 rounded-lg px-4 py-2 bg-slate-900 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder-slate-600"
    />
  </div>
);

const TextArea = ({ label, value, onChange }: any) => (
  <div>
    <label className="block text-sm font-medium text-slate-400 mb-2">{label}</label>
    <textarea 
      value={value || ''} 
      onChange={(e) => onChange(e.target.value)} 
      className="w-full border border-slate-700 rounded-lg px-4 py-2 h-32 bg-slate-900 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder-slate-600"
    />
  </div>
);

const updateArrayItem = (profile: any, setProfile: any, arrayName: string, index: number, field: string, value: any) => {
  const newArray = [...(profile[arrayName] || [])];
  if (!newArray[index]) newArray[index] = {};
  newArray[index] = { ...newArray[index], [field]: value };
  setProfile({ ...profile, [arrayName]: newArray });
};

const removeItem = (profile: any, setProfile: any, arrayName: string, index: number) => {
  const newArray = [...(profile[arrayName] || [])];
  newArray.splice(index, 1);
  setProfile({ ...profile, [arrayName]: newArray });
};

const normalizeData = (data: any) => {
  const normalizeList = (list: any[], fieldName: string) => {
    return list?.map(item => {
      if (typeof item === 'string') return { [fieldName]: item };
      return item;
    }) || [];
  };

  if (data.certificates) data.certificates = normalizeList(data.certificates, 'name');
  if (data.achievements) data.achievements = normalizeList(data.achievements, 'title');
  if (data.patents) data.patents = normalizeList(data.patents, 'title');
  if (data.volunteering) data.volunteering = normalizeList(data.volunteering, 'organization');
  if (data.publications) data.publications = normalizeList(data.publications, 'title');
  
  return data;
};
