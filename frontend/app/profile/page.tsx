'use client';
import { useState } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import { useMasterProfile } from './useMasterProfile';
import { ImportReviewModal } from './ImportReviewModal';
import {
  PersonalTab,
  ExperienceTab,
  EducationTab,
  ProjectsTab,
  SkillsTab,
  AdditionalTab,
  ImportTab,
} from './tabs';

const TABS = ['personal', 'experience', 'education', 'projects', 'skills', 'additional', 'import'];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState('personal');
  const {
    profile, setProfile,
    loading,
    rawText, setRawText,
    ingesting,
    saveStatus,
    importPreview, setImportPreview,
    handleIngest, handleFileUpload, handleConfirmMerge,
  } = useMasterProfile();

  if (loading) return <PageSpinner label="Loading Master Profile..." />;
  if (!profile) return <div className="p-8 text-center text-[#d93025]">Error loading profile. Ensure backend is running.</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto min-h-screen relative">
      {/* Import Review Modal */}
      {importPreview && (
        <ImportReviewModal
          currentProfile={profile}
          importData={importPreview}
          onCancel={() => setImportPreview(null)}
          onConfirm={handleConfirmMerge}
        />
      )}

      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-8">
        <div>
           <h1 className="text-3xl font-bold text-[#202124]">Master Profile</h1>
           <p className="text-[#5f6368]">Manage your central repository of career data.</p>
        </div>
        <div className="flex items-center gap-4">
            <span className={`text-sm font-medium whitespace-nowrap transition-colors duration-300 ${
                saveStatus === 'saving' ? 'text-[#1a73e8]' :
                saveStatus === 'saved' ? 'text-[#1e8e3e]' : 'text-[#d93025]'
            }`}>
                {saveStatus === 'saving' ? 'Saving...' :
                 saveStatus === 'saved' ? 'All changes saved' : 'Error saving'}
            </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-[#dadce0] mb-8 overflow-x-auto pb-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg transition capitalize font-medium ${
              activeTab === tab
                ? 'bg-[#f8f9fa] text-[#1a73e8] border-b-2 border-blue-500'
                : 'text-[#5f6368] hover:text-[#202124] hover:bg-[#f8f9fa]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-[#f8f9fa] p-6 rounded-xl shadow-xl border border-[#dadce0] min-h-[500px]">
        {activeTab === 'personal' && <PersonalTab profile={profile} setProfile={setProfile} />}
        {activeTab === 'experience' && <ExperienceTab profile={profile} setProfile={setProfile} />}
        {activeTab === 'education' && <EducationTab profile={profile} setProfile={setProfile} />}
        {activeTab === 'projects' && <ProjectsTab profile={profile} setProfile={setProfile} />}
        {activeTab === 'skills' && <SkillsTab profile={profile} setProfile={setProfile} />}
        {activeTab === 'additional' && <AdditionalTab profile={profile} setProfile={setProfile} />}
        {activeTab === 'import' && (
          <ImportTab
            rawText={rawText}
            setRawText={setRawText}
            ingesting={ingesting}
            onIngest={handleIngest}
            onFileUpload={handleFileUpload}
          />
        )}
      </div>
    </div>
  );
}
