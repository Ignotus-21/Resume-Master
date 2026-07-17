'use client';
import { useRef, useState } from 'react';
import { UploadCloud, Loader2, Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { API_URL, apiJson } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

// M9 onboarding: upload an existing resume (PDF/DOCX) -> Gemini extracts it
// into MasterProfile shape (M6 structured output, server-side) -> the user
// reviews/corrects here -> profile is saved -> onComplete() (the caller then
// generates the instant base resume and lands in the workspace).
//
// Distinct from profile/ImportReviewModal, which merges into an EXISTING
// profile item-by-item. Here the profile is empty, so everything extracted is
// included by default and the review is opt-OUT plus quick corrections.

const PERSONAL_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'name', label: 'Full name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'location', label: 'Location' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'github', label: 'GitHub' },
  { key: 'website', label: 'Website' },
];

// Sections shown as include/exclude item lists, in review order.
const LIST_SECTIONS = [
  'experience', 'education', 'projects', 'certificates',
  'achievements', 'publications', 'volunteering', 'patents', 'customSections',
] as const;

const itemLabels = (key: string, item: any): [string, string] => {
  if (typeof item === 'string') return [item, ''];
  const main = item.company || item.institution || item.title || item.name || item.organization || 'Untitled';
  const sub = item.role || item.degree || item.issuer || item.subtitle || item.description || '';
  return [main, sub];
};

export function ImportFlow({ onComplete }: { onComplete: () => Promise<void> | void }) {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState<any>(null);
  // Corrections made in the review modal:
  const [user, setUser] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<Record<string, Set<number>>>({});
  const [includeSkills, setIncludeSkills] = useState(true);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setParsing(true);
    const formData = new FormData();
    formData.append('resume', file);
    try {
      const res = await fetch(`${API_URL}/api/master/upload-resume`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to read that file.');
      setParsed(data);
      setUser({ ...(data.user || {}) });
      setExcluded({});
      setIncludeSkills(true);
    } catch (error: any) {
      showToast(error.message || 'Failed to read that file.', 'error');
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggleItem = (key: string, index: number) => {
    setExcluded((prev) => {
      const next = new Set(prev[key] || []);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { ...prev, [key]: next };
    });
  };

  const confirm = async (overrides?: { excluded?: Record<string, Set<number>>; includeSkills?: boolean }) => {
    setSaving(true);
    try {
      const activeExcluded = overrides?.excluded ?? excluded;
      const activeIncludeSkills = overrides?.includeSkills ?? includeSkills;
      const profile: any = { user };
      for (const key of LIST_SECTIONS) {
        const items: any[] = parsed[key] || [];
        profile[key] = items.filter((_, i) => !activeExcluded[key]?.has(i));
      }
      profile.hobbies = parsed.hobbies || [];
      if (activeIncludeSkills && parsed.skills) profile.skills = parsed.skills;
      await apiJson('/api/master', 'POST', profile);
      setParsed(null);
      await onComplete();
    } catch (error: any) {
      showToast(error.message || 'Failed to save your profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Fast-path for users who don't want to review field-by-field: accept
  // everything exactly as extracted, bypassing any per-item exclusions.
  const acceptAll = () => confirm({ excluded: {}, includeSkills: true });

  const skillCount = parsed?.skills
    ? Object.values(parsed.skills).reduce((n: number, list: any) => n + (Array.isArray(list) ? list.length : 0), 0)
    : 0;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        onClick={() => !parsing && fileRef.current?.click()}
        disabled={parsing}
        className="w-full border-2 border-dashed border-[#dadce0] rounded-2xl p-8 bg-white hover:border-[#1a73e8] hover:bg-blue-50/40 transition text-center group disabled:cursor-wait"
      >
        {parsing ? (
          <div className="flex flex-col items-center gap-2 text-[#1a73e8]">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="font-semibold">Reading your resume…</span>
            <span className="text-xs text-[#5f6368]">Extracting your experience, education and skills — about 10 seconds.</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <UploadCloud className="h-8 w-8 text-[#5f6368] group-hover:text-[#1a73e8] transition" />
            <span className="font-semibold text-[#202124]">Upload your existing resume</span>
            <span className="text-xs text-[#5f6368]">PDF or DOCX · we&apos;ll extract everything, you review before it&apos;s saved</span>
          </div>
        )}
      </button>

      {parsed && (
        <Modal
          open
          onClose={() => setParsed(null)}
          title="Review what we found"
          panelClassName="max-w-3xl max-h-[90vh] overflow-y-auto"
        >
          <p className="text-sm text-[#5f6368] mb-6">
            Everything below will be saved to your profile. Fix anything that looks off and untick anything you don&apos;t want.
          </p>

          {/* Personal info — editable */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-[#1a73e8] uppercase tracking-wide mb-2">Personal info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PERSONAL_FIELDS.map(({ key, label }) => (
                <label key={key} className="block">
                  <span className="text-xs font-medium text-[#5f6368]">{label}</span>
                  <input
                    className="w-full border border-[#dadce0] bg-[#f8f9fa] rounded-lg px-3 py-1.5 text-sm text-[#202124] outline-none focus:ring-2 focus:ring-[#1a73e8]"
                    value={user[key] || ''}
                    onChange={(e) => setUser({ ...user, [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Sections — include/exclude */}
          {LIST_SECTIONS.map((key) => {
            const items: any[] = parsed[key] || [];
            if (items.length === 0) return null;
            return (
              <div key={key} className="mb-5">
                <h3 className="text-sm font-bold text-[#1a73e8] uppercase tracking-wide mb-2 capitalize">
                  {key === 'customSections' ? 'Other sections' : key}
                  <span className="ml-2 text-[#5f6368] font-normal normal-case">({items.length} found)</span>
                </h3>
                <div className="space-y-1.5">
                  {items.map((item, i) => {
                    const [main, sub] = itemLabels(key, item);
                    const off = excluded[key]?.has(i);
                    return (
                      <label
                        key={i}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                          off ? 'border-[#dadce0] bg-[#f8f9fa] opacity-50' : 'border-[#1a73e8]/30 bg-blue-50/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!off}
                          onChange={() => toggleItem(key, i)}
                          className="mt-0.5"
                        />
                        <span className="text-sm text-[#202124] min-w-0">
                          <span className="font-semibold block truncate">{main}</span>
                          {sub && <span className="text-[#5f6368] block truncate">{sub}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Skills */}
          {skillCount > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-bold text-[#1a73e8] uppercase tracking-wide mb-2">Skills</h3>
              <label className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition ${includeSkills ? 'border-[#1a73e8]/30 bg-blue-50/40' : 'border-[#dadce0] bg-[#f8f9fa] opacity-50'}`}>
                <input type="checkbox" checked={includeSkills} onChange={() => setIncludeSkills(!includeSkills)} className="mt-0.5" />
                <span className="flex flex-wrap gap-1.5 min-w-0">
                  {Object.values(parsed.skills).flat().filter(Boolean).slice(0, 30).map((s: any, i: number) => (
                    <span key={i} className="text-xs bg-white border border-[#dadce0] rounded-full px-2 py-0.5 text-[#202124]">{String(s)}</span>
                  ))}
                  {skillCount > 30 && <span className="text-xs text-[#5f6368]">+{skillCount - 30} more</span>}
                </span>
              </label>
            </div>
          )}

          <div className="pt-4 mt-2 border-t border-[#dadce0] flex justify-between items-center gap-4">
            <button onClick={acceptAll} disabled={saving} className="text-sm text-[#1a73e8] font-medium hover:underline disabled:opacity-60">
              Add &amp; accept all
            </button>
            <div className="flex items-center gap-4">
              <button onClick={() => setParsed(null)} className="px-4 py-2 text-sm text-[#5f6368] hover:text-[#202124]">
                Cancel
              </button>
              <button
                onClick={() => confirm()}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-[#1e8e3e] text-white rounded-lg font-semibold hover:bg-[#188038] disabled:opacity-60 shadow-lg transition"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saving ? 'Saving…' : 'Looks good — continue'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
