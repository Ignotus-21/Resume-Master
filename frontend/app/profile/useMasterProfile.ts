'use client';
import { useState, useEffect, useRef } from 'react';
import { apiFetch, apiJson, API_URL } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

// Some sections may come back from the parser as plain strings; normalize
// them to the object shape the editors expect.
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

// Deep strip _id (and other Mongo bookkeeping) to prevent conflicts on save.
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

// Master-profile data state: initial fetch, debounced autosave, text/PDF
// ingestion, and the import-review merge flow.
export function useMasterProfile() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rawText, setRawText] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [importPreview, setImportPreview] = useState<any>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await apiJson('/api/master', 'POST', stripIds(data));
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
    const normalized = normalizeData(mergedData);
    setProfile(normalized);
    setImportPreview(null);
    // Force immediate save to ensure data persists before navigation
    await saveProfileData(normalized);
    showToast('Import merged and saved successfully!', 'success');
  };

  return {
    profile, setProfile,
    loading,
    rawText, setRawText,
    ingesting,
    saveStatus,
    importPreview, setImportPreview,
    handleIngest, handleFileUpload, handleConfirmMerge,
  };
}
