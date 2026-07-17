'use client';
import { Input, TextArea, updateArrayItem, removeItem } from './fields';

// One component per profile tab. Each edits `profile` immutably via
// setProfile so the page-level autosave effect picks the change up.

type TabProps = { profile: any; setProfile: (p: any) => void };

export function PersonalTab({ profile, setProfile }: TabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Input label="Full Name" value={profile.user?.name} onChange={(v: string) => setProfile({...profile, user: {...profile.user, name: v}})} />
      <Input label="Email" value={profile.user?.email} onChange={(v: string) => setProfile({...profile, user: {...profile.user, email: v}})} />
      <Input label="Phone" value={profile.user?.phone} onChange={(v: string) => setProfile({...profile, user: {...profile.user, phone: v}})} />
      <Input label="Location" value={profile.user?.location} onChange={(v: string) => setProfile({...profile, user: {...profile.user, location: v}})} />
      <Input label="LinkedIn" value={profile.user?.linkedin} onChange={(v: string) => setProfile({...profile, user: {...profile.user, linkedin: v}})} />
      <Input label="GitHub" value={profile.user?.github} onChange={(v: string) => setProfile({...profile, user: {...profile.user, github: v}})} />
      <Input label="Website" value={profile.user?.website} onChange={(v: string) => setProfile({...profile, user: {...profile.user, website: v}})} />
    </div>
  );
}

export function ExperienceTab({ profile, setProfile }: TabProps) {
  return (
    <div className="space-y-8">
      {profile.experience?.map((exp: any, index: number) => (
        <div key={index} className="border border-[#dadce0] p-6 rounded-xl bg-[#f8f9fa]/50 relative group">
          <button
            onClick={() => removeItem(profile, setProfile, 'experience', index)}
            className="absolute top-4 right-4 text-[#d93025] hover:text-red-300 text-sm"
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
        className="w-full py-3 border-2 border-dashed border-[#dadce0] rounded-xl text-[#5f6368] hover:border-blue-500 hover:text-[#1a73e8] transition"
      >
        + Add Experience
      </button>
    </div>
  );
}

export function EducationTab({ profile, setProfile }: TabProps) {
  return (
    <div className="space-y-8">
      {profile.education?.map((edu: any, index: number) => (
        <div key={index} className="border border-[#dadce0] p-6 rounded-xl bg-[#f8f9fa]/50 relative">
          <button
            onClick={() => removeItem(profile, setProfile, 'education', index)}
            className="absolute top-4 right-4 text-[#d93025] hover:text-red-300 text-sm"
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
          <TextArea label="Relevant Coursework (One per line)" value={edu.coursework?.join('\n')} onChange={(v: string) => updateArrayItem(profile, setProfile, 'education', index, 'coursework', v.split('\n'))} />
        </div>
      ))}
      <button
        onClick={() => setProfile({...profile, education: [...(profile.education || []), {}]})}
        className="w-full py-3 border-2 border-dashed border-[#dadce0] rounded-xl text-[#5f6368] hover:border-blue-500 hover:text-[#1a73e8] transition"
      >
        + Add Education
      </button>
    </div>
  );
}

export function ProjectsTab({ profile, setProfile }: TabProps) {
  return (
    <div className="space-y-8">
      {profile.projects?.map((proj: any, index: number) => (
        <div key={index} className="border border-[#dadce0] p-6 rounded-xl bg-[#f8f9fa]/50 relative">
          <button
            onClick={() => removeItem(profile, setProfile, 'projects', index)}
            className="absolute top-4 right-4 text-[#d93025] hover:text-red-300 text-sm"
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
        className="w-full py-3 border-2 border-dashed border-[#dadce0] rounded-xl text-[#5f6368] hover:border-blue-500 hover:text-[#1a73e8] transition"
      >
        + Add Project
      </button>
    </div>
  );
}

export function SkillsTab({ profile, setProfile }: TabProps) {
  return (
    <div className="space-y-6">
      <div className="border border-[#dadce0] p-6 rounded-xl bg-[#f8f9fa]/50">
        <h3 className="font-semibold mb-4 text-lg text-[#202124]">Technical Skills</h3>
        <div className="space-y-4">
          <Input
            label="Languages (comma separated)"
            value={profile.skills?.languages?.join(', ')}
            onChange={(v: string) => setProfile({...profile, skills: {...profile.skills, languages: v.split(',').map((s: string) => s.trim())}})}
          />
          <Input
            label="Frameworks (comma separated)"
            value={profile.skills?.frameworks?.join(', ')}
            onChange={(v: string) => setProfile({...profile, skills: {...profile.skills, frameworks: v.split(',').map((s: string) => s.trim())}})}
          />
          <Input
            label="Tools / Developer Tools (comma separated)"
            value={profile.skills?.tools?.join(', ')}
            onChange={(v: string) => setProfile({...profile, skills: {...profile.skills, tools: v.split(',').map((s: string) => s.trim())}})}
          />
          <Input
            label="Other / Libraries (comma separated)"
            value={profile.skills?.other?.join(', ')}
            onChange={(v: string) => setProfile({...profile, skills: {...profile.skills, other: v.split(',').map((s: string) => s.trim())}})}
          />
        </div>
      </div>
    </div>
  );
}

export function AdditionalTab({ profile, setProfile }: TabProps) {
  return (
    <div className="space-y-8">
      {/* Certificates */}
      <div className="border border-[#dadce0] p-6 rounded-xl bg-[#f8f9fa]/50 relative">
          <h3 className="font-semibold mb-4 text-lg text-[#202124]">Certificates</h3>
          {profile.certificates?.map((cert: any, i: number) => (
              <div key={i} className="mb-4 pb-4 border-b border-[#dadce0] last:border-0 relative">
                  <button onClick={() => removeItem(profile, setProfile, 'certificates', i)} className="absolute right-0 top-0 text-[#d93025] text-xs">Remove</button>
                  <Input label="Name" value={cert.name} onChange={(v: string) => updateArrayItem(profile, setProfile, 'certificates', i, 'name', v)} />
                  <Input label="Issuer" value={cert.issuer} onChange={(v: string) => updateArrayItem(profile, setProfile, 'certificates', i, 'issuer', v)} />
                  <div className="grid grid-cols-2 gap-4">
                      <Input label="Date" value={cert.date} onChange={(v: string) => updateArrayItem(profile, setProfile, 'certificates', i, 'date', v)} />
                      <Input label="Link" value={cert.link} onChange={(v: string) => updateArrayItem(profile, setProfile, 'certificates', i, 'link', v)} />
                  </div>
              </div>
          ))}
          <button onClick={() => setProfile({...profile, certificates: [...(profile.certificates || []), {}]})} className="text-[#1a73e8] text-sm hover:underline">+ Add Certificate</button>
      </div>

      {/* Achievements */}
      <div className="border border-[#dadce0] p-6 rounded-xl bg-[#f8f9fa]/50 relative">
          <h3 className="font-semibold mb-4 text-lg text-[#202124]">Achievements</h3>
          {profile.achievements?.map((ach: any, i: number) => (
              <div key={i} className="mb-4 pb-4 border-b border-[#dadce0] last:border-0 relative">
                  <button onClick={() => removeItem(profile, setProfile, 'achievements', i)} className="absolute right-0 top-0 text-[#d93025] text-xs">Remove</button>
                  <Input label="Title" value={ach.title} onChange={(v: string) => updateArrayItem(profile, setProfile, 'achievements', i, 'title', v)} />
                  <Input label="Date" value={ach.date} onChange={(v: string) => updateArrayItem(profile, setProfile, 'achievements', i, 'date', v)} />
                  <TextArea label="Description" value={ach.description} onChange={(v: string) => updateArrayItem(profile, setProfile, 'achievements', i, 'description', v)} />
              </div>
          ))}
          <button onClick={() => setProfile({...profile, achievements: [...(profile.achievements || []), {}]})} className="text-[#1a73e8] text-sm hover:underline">+ Add Achievement</button>
      </div>

      {/* Hobbies */}
      <div className="border border-[#dadce0] p-6 rounded-xl bg-[#f8f9fa]/50 relative">
          <h3 className="font-semibold mb-4 text-lg text-[#202124]">Hobbies & Interests</h3>
          <TextArea
              label="List your hobbies (comma or newline separated)"
              value={typeof profile.hobbies === 'string' ? profile.hobbies : profile.hobbies?.join('\n')}
              onChange={(v: string) => setProfile({...profile, hobbies: v.split(/[\n,]/).map((s: string) => s.trim()).filter(Boolean)})}
          />
      </div>

      {/* Patents */}
      <div className="border border-[#dadce0] p-6 rounded-xl bg-[#f8f9fa]/50 relative">
          <h3 className="font-semibold mb-4 text-lg text-[#202124]">Patents</h3>
          {profile.patents?.map((pat: any, i: number) => (
              <div key={i} className="mb-4 pb-4 border-b border-[#dadce0] last:border-0 relative">
                  <button onClick={() => removeItem(profile, setProfile, 'patents', i)} className="absolute right-0 top-0 text-[#d93025] text-xs">Remove</button>
                  <Input label="Title" value={pat.title} onChange={(v: string) => updateArrayItem(profile, setProfile, 'patents', i, 'title', v)} />
                  <Input label="Patent Number" value={pat.number} onChange={(v: string) => updateArrayItem(profile, setProfile, 'patents', i, 'number', v)} />
                  <Input label="Date" value={pat.date} onChange={(v: string) => updateArrayItem(profile, setProfile, 'patents', i, 'date', v)} />
                  <TextArea label="Description" value={pat.description} onChange={(v: string) => updateArrayItem(profile, setProfile, 'patents', i, 'description', v)} />
              </div>
          ))}
          <button onClick={() => setProfile({...profile, patents: [...(profile.patents || []), {}]})} className="text-[#1a73e8] text-sm hover:underline">+ Add Patent</button>
      </div>

      {/* Volunteering */}
      <div className="border border-[#dadce0] p-6 rounded-xl bg-[#f8f9fa]/50 relative">
          <h3 className="font-semibold mb-4 text-lg text-[#202124]">Volunteering</h3>
          {profile.volunteering?.map((vol: any, i: number) => (
              <div key={i} className="mb-4 pb-4 border-b border-[#dadce0] last:border-0 relative">
                  <button onClick={() => removeItem(profile, setProfile, 'volunteering', i)} className="absolute right-0 top-0 text-[#d93025] text-xs">Remove</button>
                  <Input label="Organization" value={vol.organization} onChange={(v: string) => updateArrayItem(profile, setProfile, 'volunteering', i, 'organization', v)} />
                  <Input label="Role" value={vol.role} onChange={(v: string) => updateArrayItem(profile, setProfile, 'volunteering', i, 'role', v)} />
                  <div className="grid grid-cols-2 gap-4">
                      <Input label="Start Date" value={vol.startDate} onChange={(v: string) => updateArrayItem(profile, setProfile, 'volunteering', i, 'startDate', v)} />
                      <Input label="End Date" value={vol.endDate} onChange={(v: string) => updateArrayItem(profile, setProfile, 'volunteering', i, 'endDate', v)} />
                  </div>
                  <TextArea label="Description" value={vol.description} onChange={(v: string) => updateArrayItem(profile, setProfile, 'volunteering', i, 'description', v)} />
              </div>
          ))}
          <button onClick={() => setProfile({...profile, volunteering: [...(profile.volunteering || []), {}]})} className="text-[#1a73e8] text-sm hover:underline">+ Add Volunteering</button>
      </div>

      {/* Custom Sections */}
      <div>
          <h3 className="font-semibold mb-4 text-xl text-[#1a73e8]">Custom Sections</h3>
          {profile.customSections?.map((section: any, i: number) => (
              <div key={i} className="border border-[#dadce0] p-6 rounded-xl bg-[#f8f9fa]/50 relative mb-6">
                  <button onClick={() => removeItem(profile, setProfile, 'customSections', i)} className="absolute right-4 top-4 text-[#d93025] text-sm">Remove Section</button>
                  <div className="mb-4">
                      <label className="block text-sm font-medium text-[#5f6368] mb-1">Section Title (e.g. Speaking, Awards)</label>
                      <input
                          value={section.title}
                          onChange={(e) => updateArrayItem(profile, setProfile, 'customSections', i, 'title', e.target.value)}
                          className="w-full border border-[#dadce0] rounded-lg px-4 py-2 bg-[#f8f9fa] text-[#202124] font-bold"
                      />
                  </div>

                  <div className="space-y-4 pl-4 border-l-2 border-[#dadce0]">
                      {section.items?.map((item: any, j: number) => (
                          <div key={j} className="bg-[#f8f9fa]/50 p-4 rounded border border-[#dadce0] relative">
                              <button
                                onClick={() => {
                                    const newItems = [...section.items];
                                    newItems.splice(j, 1);
                                    updateArrayItem(profile, setProfile, 'customSections', i, 'items', newItems);
                                }}
                                className="absolute right-2 top-2 text-[#d93025] text-xs"
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
                          className="text-[#1e8e3e] text-sm font-medium hover:underline"
                      >
                          + Add Item to {section.title || 'Section'}
                      </button>
                  </div>
              </div>
          ))}
          <button
              onClick={() => setProfile({...profile, customSections: [...(profile.customSections || []), { items: [] }]})}
              className="w-full py-3 border-2 border-dashed border-[#dadce0] rounded-xl text-[#5f6368] hover:border-[#1a73e8] hover:text-[#1a73e8] hover:bg-[#f8f9fa] transition font-bold"
          >
              + Add New Custom Section
          </button>
      </div>
    </div>
  );
}

export function ImportTab({
  rawText,
  setRawText,
  ingesting,
  onIngest,
  onFileUpload,
}: {
  rawText: string;
  setRawText: (v: string) => void;
  ingesting: boolean;
  onIngest: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="bg-[#f8f9fa]/50 border border-[#dadce0] p-6 rounded-xl">
         <h3 className="text-lg font-semibold text-[#202124] mb-2">Option 1: Upload Resume (PDF or DOCX)</h3>
         <p className="text-[#5f6368] text-sm mb-4">
           Upload your resume (PDF or DOCX), or export your LinkedIn profile as a PDF and upload that instead.
           Either way we&apos;ll extract your experience, education, and skills automatically, and you&apos;ll be
           able to review and merge the results.
         </p>
         <ol className="text-[#5f6368] text-sm list-decimal list-inside space-y-1 mb-4">
           <li>From LinkedIn: open your profile, click <span className="text-[#202124] font-medium">More</span> → <span className="text-[#202124] font-medium">Save to PDF</span></li>
           <li>Upload the PDF (or your own DOCX/PDF resume) below</li>
         </ol>
         <input
           type="file"
           accept=".pdf,.docx"
           onChange={onFileUpload}
           disabled={ingesting}
           className="block w-full text-sm text-[#5f6368]
             file:mr-4 file:py-2.5 file:px-6
             file:rounded-lg file:border-0
             file:text-sm file:font-semibold
             file:bg-blue-600 file:text-white
             hover:file:bg-blue-500
             file:cursor-pointer cursor-pointer
           "
         />
         {ingesting && <p className="text-[#1a73e8] text-sm mt-2 animate-pulse">Processing file... Please wait...</p>}
      </div>

      <div className="border-t border-[#dadce0] my-4"></div>

      <div>
        <h3 className="text-lg font-semibold text-[#202124] mb-2">Option 2: Paste Text</h3>
        <textarea
          className="w-full h-64 border border-[#dadce0] rounded-xl p-4 bg-[#f8f9fa] text-[#202124] focus:ring-2 focus:ring-blue-500 outline-none"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste resume content here..."
        />
        <div className="flex justify-end mt-4">
          <button
            onClick={onIngest}
            disabled={ingesting}
            className="bg-green-600 text-white px-8 py-3 rounded-xl hover:bg-green-500"
          >
            {ingesting ? 'Analyzing...' : 'Parse & Merge'}
          </button>
        </div>
      </div>
    </div>
  );
}
