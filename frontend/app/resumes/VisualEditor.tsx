'use client';

import { useState } from 'react';
import { Sparkles, Plus, Trash2, GripVertical, Eye, EyeOff, Loader2, MessageCircleQuestion } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { DiffText } from '@/components/resume/DiffText';
import type { ResumeContent, DesignTokens, SectionKey } from '@/lib/resumeSchema';
import { sectionTitle, sectionHasContent, SECTION_KEYS } from '@/lib/resumeSchema';

// The SheetsResume-style guided editor: one form per section, live PDF on
// the right, AI as a coach (per-bullet rewrites, the bullet coach, honest
// title suggestions). The user never sees LaTeX here.

interface VisualEditorProps {
  content: ResumeContent;
  design: DesignTokens;
  setContent: (updater: (c: ResumeContent) => ResumeContent) => void;
  setDesign: (patch: Partial<DesignTokens>) => void;
  jd?: string; // target job description, when the resume is linked to a job
  onSectionRef?: (key: SectionKey, el: HTMLDivElement | null) => void;
}

const inputCls =
  'w-full border border-[#dadce0] bg-white rounded-lg px-3 py-1.5 text-sm text-[#202124] outline-none focus:ring-2 focus:ring-[#1a73e8]/40';
const labelCls = 'block text-xs font-medium text-[#5f6368] mb-1';

// --- Drag-to-reorder (native HTML5 DnD, no dependency) ------------------------
// Rows become draggable only while the grip handle is pressed, so text
// selection inside the row's inputs/textareas keeps working normally.

function useDragReorder(onMove: (from: number, to: number) => void) {
  const [armed, setArmed] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const reset = () => {
    setArmed(null);
    setDragIdx(null);
    setOverIdx(null);
  };

  const rowProps = (i: number) => ({
    draggable: armed === i,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'move';
      setDragIdx(i);
    },
    onDragOver: (e: React.DragEvent) => {
      if (dragIdx === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (overIdx !== i) setOverIdx(i);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragIdx !== null && dragIdx !== i) onMove(dragIdx, i);
      reset();
    },
    onDragEnd: reset,
  });

  const handleProps = (i: number) => ({
    onMouseDown: () => setArmed(i),
    onMouseUp: () => setArmed(null),
  });

  /** Extra classes for row i: fade the dragged row, mark the drop target. */
  const rowCls = (i: number) => {
    if (dragIdx === null) return '';
    if (i === dragIdx) return 'opacity-40';
    if (i === overIdx) return 'ring-2 ring-[#1a73e8]/50 rounded-lg';
    return '';
  };

  return { rowProps, handleProps, rowCls, dragging: dragIdx !== null };
}

/** Move one element of an array from index `from` to index `to`. */
const arrayMove = <T,>(arr: T[], from: number, to: number): T[] => {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

// --- Per-bullet AI suggestions ----------------------------------------------

function BulletAI({ bullet, roleContext, jd, onAccept }: {
  bullet: string;
  roleContext: string;
  jd?: string;
  onAccept: (text: string) => void;
}) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rewrites, setRewrites] = useState<string[]>([]);

  const fetchRewrites = async () => {
    setLoading(true);
    try {
      const data = await apiJson('/api/ai/rewrite-bullet', 'POST', { bullet, roleContext, jd });
      setRewrites(data.rewrites || []);
      setOpen(true);
    } catch (error: any) {
      showToast(error.message || 'Failed to get suggestions', 'error');
    }
    setLoading(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => (open ? setOpen(false) : fetchRewrites())}
        disabled={loading || !bullet.trim()}
        className="p-1 text-[#5f6368] hover:text-[#1a73e8] disabled:opacity-40"
        title="AI suggestions for this bullet"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      </button>
      {open && rewrites.length > 0 && (
        <div className="absolute right-0 z-20 mt-1 w-80 bg-white border border-[#dadce0] rounded-xl shadow-xl p-2 space-y-1">
          <div className="text-xs font-semibold text-[#5f6368] px-2 pt-1">Pick a rewrite — changes highlighted</div>
          {rewrites.map((r, i) => (
            <button
              key={i}
              onClick={() => { onAccept(r); setOpen(false); }}
              className="block w-full text-left text-sm p-2 rounded-lg hover:bg-blue-50 text-[#202124]"
            >
              <DiffText before={bullet} after={r} />
            </button>
          ))}
          <div className="flex justify-between px-2 pb-1">
            <button onClick={fetchRewrites} className="text-xs text-[#1a73e8] hover:underline" disabled={loading}>
              {loading ? 'Thinking…' : 'Regenerate'}
            </button>
            <button onClick={() => setOpen(false)} className="text-xs text-[#5f6368] hover:underline">Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Bullet coach (the "Work Experience Assistant") ---------------------------

function BulletCoach({ bullet, roleContext, onAccept }: {
  bullet: string;
  roleContext: string;
  onAccept: (text: string) => void;
}) {
  const { showToast } = useToast();
  const [state, setState] = useState<'idle' | 'loading' | 'asking' | 'drafted'>('idle');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [draft, setDraft] = useState('');

  const ask = async () => {
    setState('loading');
    try {
      const data = await apiJson('/api/ai/bullet-coach', 'POST', { bullet, roleContext });
      setQuestion(data.question || 'What was the scale, outcome, or tooling involved?');
      setState('asking');
    } catch (error: any) {
      showToast(error.message || 'Coach unavailable', 'error');
      setState('idle');
    }
  };

  const submitAnswer = async () => {
    setState('loading');
    try {
      const data = await apiJson('/api/ai/bullet-coach', 'POST', { bullet, roleContext, answer });
      setDraft(data.bullet || '');
      setState('drafted');
    } catch (error: any) {
      showToast(error.message || 'Coach unavailable', 'error');
      setState('asking');
    }
  };

  if (state === 'idle') {
    return (
      <button
        onClick={ask}
        className="p-1 text-[#5f6368] hover:text-[#1e8e3e]"
        title="Coach: strengthen this bullet with a follow-up question"
      >
        <MessageCircleQuestion className="h-4 w-4" />
      </button>
    );
  }
  return (
    <div className="absolute right-0 z-20 mt-1 w-80 bg-white border border-[#dadce0] rounded-xl shadow-xl p-3 space-y-2">
      {state === 'loading' && <div className="text-sm text-[#5f6368] animate-pulse">Thinking…</div>}
      {state === 'asking' && (
        <>
          <div className="text-sm text-[#202124]">{question}</div>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            className={inputCls}
            placeholder="e.g. ~2M requests/day, cut latency 40%, used Redis + Go"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setState('idle')} className="text-xs text-[#5f6368] hover:underline">Cancel</button>
            <button onClick={submitAnswer} disabled={!answer.trim()} className="text-xs font-semibold text-white bg-[#1e8e3e] px-3 py-1 rounded-lg disabled:opacity-50">
              Draft bullet
            </button>
          </div>
        </>
      )}
      {state === 'drafted' && (
        <>
          <div className="text-xs font-semibold text-[#5f6368]">Suggested bullet — changes highlighted</div>
          <div className="text-sm text-[#202124] bg-green-50 border border-green-200 rounded-lg p-2">
            <DiffText before={bullet} after={draft} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setState('asking')} className="text-xs text-[#5f6368] hover:underline">Back</button>
            <button onClick={() => { onAccept(draft); setState('idle'); }} className="text-xs font-semibold text-white bg-[#1e8e3e] px-3 py-1 rounded-lg">
              Use it
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- Job title suggestions ----------------------------------------------------

function TitleChips({ role, jd, onPick }: { role: string; jd: string; onPick: (t: string) => void }) {
  const { showToast } = useToast();
  const [titles, setTitles] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchTitles = async () => {
    setLoading(true);
    try {
      const data = await apiJson('/api/ai/suggest-titles', 'POST', { role, jd });
      setTitles(data.titles || []);
    } catch (error: any) {
      showToast(error.message || 'Failed to suggest titles', 'error');
    }
    setLoading(false);
  };

  if (titles === null) {
    return (
      <button onClick={fetchTitles} disabled={loading || !role.trim()} className="text-xs text-[#1a73e8] hover:underline disabled:opacity-40 whitespace-nowrap">
        {loading ? 'Thinking…' : '✨ title ideas'}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {titles.map((t, i) => (
        <button key={i} onClick={() => onPick(t)} className="text-xs bg-blue-50 text-[#1a73e8] border border-blue-200 rounded-full px-2 py-0.5 hover:bg-blue-100">
          {t}
        </button>
      ))}
      <button onClick={() => setTitles(null)} className="text-xs text-[#5f6368] hover:underline">×</button>
    </div>
  );
}

// --- Bullet list editor ---------------------------------------------------------

function BulletList({ bullets, roleContext, jd, onChange }: {
  bullets: string[];
  roleContext: string;
  jd?: string;
  onChange: (next: string[]) => void;
}) {
  const dnd = useDragReorder((from, to) => onChange(arrayMove(bullets, from, to)));

  return (
    <div className="space-y-1.5">
      {bullets.map((b, i) => (
        <div key={i} className={`flex items-start gap-1 group ${dnd.rowCls(i)}`} {...dnd.rowProps(i)}>
          <div
            className={`pt-1.5 cursor-grab active:cursor-grabbing text-[#5f6368] hover:text-[#202124] transition-opacity ${dnd.dragging ? '' : 'opacity-0 group-hover:opacity-100'}`}
            title="Drag to reorder"
            {...dnd.handleProps(i)}
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <textarea
            value={b}
            rows={Math.max(1, Math.ceil(b.length / 70))}
            onChange={(e) => onChange(bullets.map((x, j) => (j === i ? e.target.value : x)))}
            className={`${inputCls} resize-none`}
          />
          <div className="relative flex items-center pt-1">
            <BulletAI bullet={b} roleContext={roleContext} jd={jd} onAccept={(t) => onChange(bullets.map((x, j) => (j === i ? t : x)))} />
            <div className="relative">
              <BulletCoach bullet={b} roleContext={roleContext} onAccept={(t) => onChange(bullets.map((x, j) => (j === i ? t : x)))} />
            </div>
            <button onClick={() => onChange(bullets.filter((_, j) => j !== i))} className="p-1 text-[#5f6368] hover:text-[#d93025]" title="Remove bullet">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
      <button onClick={() => onChange([...bullets, ''])} className="flex items-center gap-1 text-xs text-[#1a73e8] hover:underline">
        <Plus className="h-3 w-3" /> Add bullet
      </button>
    </div>
  );
}

// --- Generic list-of-strings editor (skills, coursework, hobbies) ---------------

function StringList({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <input
      className={inputCls}
      value={value.join(', ')}
      placeholder={placeholder || 'Comma-separated'}
      onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trimStart()))}
      onBlur={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
    />
  );
}

// --- The editor -----------------------------------------------------------------

export function VisualEditor({ content, design, setContent, setDesign, jd, onSectionRef }: VisualEditorProps) {
  // Immutable content edits without spread pyramids.
  const upd = (fn: (c: ResumeContent) => void) =>
    setContent((c) => {
      const copy = structuredClone(c) as ResumeContent;
      fn(copy);
      return copy;
    });

  const sectionDnd = useDragReorder((from, to) =>
    setDesign({ sectionOrder: arrayMove(design.sectionOrder, from, to) })
  );

  const toggleHidden = (key: SectionKey) => {
    const hidden = design.hiddenSections.includes(key)
      ? design.hiddenSections.filter((k) => k !== key)
      : [...design.hiddenSections, key];
    setDesign({ hiddenSections: hidden });
  };

  const renameSection = (key: SectionKey, title: string) =>
    setDesign({ sectionTitles: { ...design.sectionTitles, [key]: title } });

  const sectionBody = (key: SectionKey) => {
    switch (key) {
      case 'experience':
        return (
          <div className="space-y-4">
            {(content.experience || []).map((exp, i) => (
              <div key={i} className="border border-[#dadce0] rounded-lg p-3 space-y-2 bg-[#fafafa]">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Role</label>
                    <input className={inputCls} value={exp.role || ''} onChange={(e) => upd((c) => { c.experience![i].role = e.target.value; })} />
                    {jd && <TitleChips role={exp.role || ''} jd={jd} onPick={(t) => upd((c) => { c.experience![i].role = t; })} />}
                  </div>
                  <div>
                    <label className={labelCls}>Company</label>
                    <input className={inputCls} value={exp.company || ''} onChange={(e) => upd((c) => { c.experience![i].company = e.target.value; })} />
                  </div>
                  <div>
                    <label className={labelCls}>Start</label>
                    <input className={inputCls} value={exp.startDate || ''} placeholder="Jan 2022" onChange={(e) => upd((c) => { c.experience![i].startDate = e.target.value; })} />
                  </div>
                  <div>
                    <label className={labelCls}>End</label>
                    <div className="flex items-center gap-2">
                      <input className={inputCls} value={exp.isCurrent ? '' : (exp.endDate || '')} disabled={exp.isCurrent} placeholder={exp.isCurrent ? 'Present' : 'Dec 2023'} onChange={(e) => upd((c) => { c.experience![i].endDate = e.target.value; })} />
                      <label className="flex items-center gap-1 text-xs text-[#5f6368] whitespace-nowrap">
                        <input type="checkbox" checked={!!exp.isCurrent} onChange={(e) => upd((c) => { c.experience![i].isCurrent = e.target.checked; })} />
                        Current
                      </label>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Location</label>
                    <input className={inputCls} value={exp.location || ''} onChange={(e) => upd((c) => { c.experience![i].location = e.target.value; })} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Bullet points</label>
                  <BulletList
                    bullets={exp.bulletPoints || []}
                    roleContext={`${exp.role || ''} at ${exp.company || ''}`}
                    jd={jd}
                    onChange={(next) => upd((c) => { c.experience![i].bulletPoints = next; })}
                  />
                </div>
                <button onClick={() => upd((c) => { c.experience!.splice(i, 1); })} className="text-xs text-[#d93025] hover:underline">Remove entry</button>
              </div>
            ))}
            <button onClick={() => upd((c) => { c.experience = [...(c.experience || []), { bulletPoints: [''] }]; })} className="flex items-center gap-1 text-sm text-[#1a73e8] hover:underline">
              <Plus className="h-4 w-4" /> Add experience
            </button>
          </div>
        );

      case 'education':
        return (
          <div className="space-y-4">
            {(content.education || []).map((edu, i) => (
              <div key={i} className="border border-[#dadce0] rounded-lg p-3 grid grid-cols-2 gap-2 bg-[#fafafa]">
                <div className="col-span-2">
                  <label className={labelCls}>Institution</label>
                  <input className={inputCls} value={edu.institution || ''} onChange={(e) => upd((c) => { c.education![i].institution = e.target.value; })} />
                </div>
                <div>
                  <label className={labelCls}>Degree</label>
                  <input className={inputCls} value={edu.degree || ''} onChange={(e) => upd((c) => { c.education![i].degree = e.target.value; })} />
                </div>
                <div>
                  <label className={labelCls}>Field of study</label>
                  <input className={inputCls} value={edu.fieldOfStudy || ''} onChange={(e) => upd((c) => { c.education![i].fieldOfStudy = e.target.value; })} />
                </div>
                <div>
                  <label className={labelCls}>Start</label>
                  <input className={inputCls} value={edu.startDate || ''} onChange={(e) => upd((c) => { c.education![i].startDate = e.target.value; })} />
                </div>
                <div>
                  <label className={labelCls}>End</label>
                  <input className={inputCls} value={edu.endDate || ''} onChange={(e) => upd((c) => { c.education![i].endDate = e.target.value; })} />
                </div>
                <div>
                  <label className={labelCls}>GPA</label>
                  <input className={inputCls} value={edu.gpa || ''} onChange={(e) => upd((c) => { c.education![i].gpa = e.target.value; })} />
                </div>
                <div>
                  <label className={labelCls}>Coursework</label>
                  <StringList value={edu.coursework || []} onChange={(v) => upd((c) => { c.education![i].coursework = v; })} />
                </div>
                <button onClick={() => upd((c) => { c.education!.splice(i, 1); })} className="text-xs text-[#d93025] hover:underline text-left">Remove entry</button>
              </div>
            ))}
            <button onClick={() => upd((c) => { c.education = [...(c.education || []), {}]; })} className="flex items-center gap-1 text-sm text-[#1a73e8] hover:underline">
              <Plus className="h-4 w-4" /> Add education
            </button>
          </div>
        );

      case 'projects':
        return (
          <div className="space-y-4">
            {(content.projects || []).map((p, i) => (
              <div key={i} className="border border-[#dadce0] rounded-lg p-3 space-y-2 bg-[#fafafa]">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Title</label>
                    <input className={inputCls} value={p.title || ''} onChange={(e) => upd((c) => { c.projects![i].title = e.target.value; })} />
                  </div>
                  <div>
                    <label className={labelCls}>Link</label>
                    <input className={inputCls} value={p.link || ''} onChange={(e) => upd((c) => { c.projects![i].link = e.target.value; })} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Tech stack</label>
                    <StringList value={p.techStack || []} onChange={(v) => upd((c) => { c.projects![i].techStack = v; })} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Description</label>
                    <textarea rows={2} className={`${inputCls} resize-none`} value={p.description || ''} onChange={(e) => upd((c) => { c.projects![i].description = e.target.value; })} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Bullet points</label>
                  <BulletList
                    bullets={p.bulletPoints || []}
                    roleContext={`Project: ${p.title || ''}`}
                    jd={jd}
                    onChange={(next) => upd((c) => { c.projects![i].bulletPoints = next; })}
                  />
                </div>
                <button onClick={() => upd((c) => { c.projects!.splice(i, 1); })} className="text-xs text-[#d93025] hover:underline">Remove entry</button>
              </div>
            ))}
            <button onClick={() => upd((c) => { c.projects = [...(c.projects || []), {}]; })} className="flex items-center gap-1 text-sm text-[#1a73e8] hover:underline">
              <Plus className="h-4 w-4" /> Add project
            </button>
          </div>
        );

      case 'skills': {
        const s = content.skills || {};
        return (
          <div className="grid grid-cols-1 gap-2">
            {([['languages', 'Languages'], ['frameworks', 'Frameworks'], ['tools', 'Tools'], ['other', 'Other']] as const).map(([k, label]) => (
              <div key={k}>
                <label className={labelCls}>{label}</label>
                <StringList value={(s as any)[k] || []} onChange={(v) => upd((c) => { c.skills = { ...(c.skills || {}), [k]: v }; })} />
              </div>
            ))}
          </div>
        );
      }

      case 'certificates':
        return (
          <div className="space-y-2">
            {(content.certificates || []).map((cert, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <div>
                  <label className={labelCls}>Name</label>
                  <input className={inputCls} value={cert.name || ''} onChange={(e) => upd((c) => { c.certificates![i].name = e.target.value; })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Issuer</label>
                    <input className={inputCls} value={cert.issuer || ''} onChange={(e) => upd((c) => { c.certificates![i].issuer = e.target.value; })} />
                  </div>
                  <div>
                    <label className={labelCls}>Date</label>
                    <input className={inputCls} value={cert.date || ''} onChange={(e) => upd((c) => { c.certificates![i].date = e.target.value; })} />
                  </div>
                </div>
                <button onClick={() => upd((c) => { c.certificates!.splice(i, 1); })} className="p-1.5 text-[#5f6368] hover:text-[#d93025]"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button onClick={() => upd((c) => { c.certificates = [...(c.certificates || []), {}]; })} className="flex items-center gap-1 text-sm text-[#1a73e8] hover:underline">
              <Plus className="h-4 w-4" /> Add certificate
            </button>
          </div>
        );

      case 'achievements':
      case 'publications':
      case 'patents':
        return (
          <div className="space-y-2">
            {((content[key] as any[]) || []).map((item, i) => (
              <div key={i} className="border border-[#dadce0] rounded-lg p-3 grid grid-cols-2 gap-2 bg-[#fafafa]">
                <div>
                  <label className={labelCls}>Title</label>
                  <input className={inputCls} value={item.title || ''} onChange={(e) => upd((c) => { (c[key] as any[])[i].title = e.target.value; })} />
                </div>
                <div>
                  <label className={labelCls}>Date</label>
                  <input className={inputCls} value={item.date || ''} onChange={(e) => upd((c) => { (c[key] as any[])[i].date = e.target.value; })} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Description</label>
                  <textarea rows={2} className={`${inputCls} resize-none`} value={item.description || ''} onChange={(e) => upd((c) => { (c[key] as any[])[i].description = e.target.value; })} />
                </div>
                <button onClick={() => upd((c) => { (c[key] as any[]).splice(i, 1); })} className="text-xs text-[#d93025] hover:underline text-left">Remove entry</button>
              </div>
            ))}
            <button onClick={() => upd((c) => { (c as any)[key] = [...((c[key] as any[]) || []), {}]; })} className="flex items-center gap-1 text-sm text-[#1a73e8] hover:underline">
              <Plus className="h-4 w-4" /> Add entry
            </button>
          </div>
        );

      case 'volunteering':
        return (
          <div className="space-y-2">
            {(content.volunteering || []).map((v, i) => (
              <div key={i} className="border border-[#dadce0] rounded-lg p-3 grid grid-cols-2 gap-2 bg-[#fafafa]">
                <div>
                  <label className={labelCls}>Organization</label>
                  <input className={inputCls} value={v.organization || ''} onChange={(e) => upd((c) => { c.volunteering![i].organization = e.target.value; })} />
                </div>
                <div>
                  <label className={labelCls}>Role</label>
                  <input className={inputCls} value={v.role || ''} onChange={(e) => upd((c) => { c.volunteering![i].role = e.target.value; })} />
                </div>
                <div>
                  <label className={labelCls}>Start</label>
                  <input className={inputCls} value={v.startDate || ''} onChange={(e) => upd((c) => { c.volunteering![i].startDate = e.target.value; })} />
                </div>
                <div>
                  <label className={labelCls}>End</label>
                  <input className={inputCls} value={v.endDate || ''} onChange={(e) => upd((c) => { c.volunteering![i].endDate = e.target.value; })} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Description</label>
                  <textarea rows={2} className={`${inputCls} resize-none`} value={v.description || ''} onChange={(e) => upd((c) => { c.volunteering![i].description = e.target.value; })} />
                </div>
                <button onClick={() => upd((c) => { c.volunteering!.splice(i, 1); })} className="text-xs text-[#d93025] hover:underline text-left">Remove entry</button>
              </div>
            ))}
            <button onClick={() => upd((c) => { c.volunteering = [...(c.volunteering || []), {}]; })} className="flex items-center gap-1 text-sm text-[#1a73e8] hover:underline">
              <Plus className="h-4 w-4" /> Add entry
            </button>
          </div>
        );

      case 'hobbies':
        return <StringList value={content.hobbies || []} onChange={(v) => upd((c) => { c.hobbies = v; })} placeholder="Chess, Hiking, …" />;

      case 'customSections':
        return (
          <div className="space-y-4">
            {(content.customSections || []).map((section, si) => (
              <div key={si} className="border border-[#dadce0] rounded-lg p-3 space-y-2 bg-[#fafafa]">
                <div>
                  <label className={labelCls}>Section title</label>
                  <input className={inputCls} value={section.title || ''} onChange={(e) => upd((c) => { c.customSections![si].title = e.target.value; })} />
                </div>
                {(section.items || []).map((item, ii) => (
                  <div key={ii} className="border border-[#e8eaed] rounded-lg p-2 grid grid-cols-2 gap-2 bg-white">
                    <input className={inputCls} placeholder="Title" value={item.title || ''} onChange={(e) => upd((c) => { c.customSections![si].items![ii].title = e.target.value; })} />
                    <input className={inputCls} placeholder="Subtitle" value={item.subtitle || ''} onChange={(e) => upd((c) => { c.customSections![si].items![ii].subtitle = e.target.value; })} />
                    <input className={inputCls} placeholder="Date" value={item.date || ''} onChange={(e) => upd((c) => { c.customSections![si].items![ii].date = e.target.value; })} />
                    <input className={inputCls} placeholder="Link" value={item.link || ''} onChange={(e) => upd((c) => { c.customSections![si].items![ii].link = e.target.value; })} />
                    <textarea rows={2} className={`${inputCls} resize-none col-span-2`} placeholder="Description" value={item.description || ''} onChange={(e) => upd((c) => { c.customSections![si].items![ii].description = e.target.value; })} />
                    <button onClick={() => upd((c) => { c.customSections![si].items!.splice(ii, 1); })} className="text-xs text-[#d93025] hover:underline text-left">Remove item</button>
                  </div>
                ))}
                <div className="flex gap-3">
                  <button onClick={() => upd((c) => { c.customSections![si].items = [...(c.customSections![si].items || []), {}]; })} className="text-xs text-[#1a73e8] hover:underline">+ Add item</button>
                  <button onClick={() => upd((c) => { c.customSections!.splice(si, 1); })} className="text-xs text-[#d93025] hover:underline">Remove section</button>
                </div>
              </div>
            ))}
            <button onClick={() => upd((c) => { c.customSections = [...(c.customSections || []), { title: 'New Section', items: [{}] }]; })} className="flex items-center gap-1 text-sm text-[#1a73e8] hover:underline">
              <Plus className="h-4 w-4" /> Add custom section
            </button>
          </div>
        );
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3 bg-white">
      {/* Contact / header info */}
      <div className="border border-[#dadce0] rounded-xl p-4">
        <h3 className="text-sm font-bold text-[#202124] mb-3">Contact</h3>
        <div className="grid grid-cols-2 gap-2">
          {([['name', 'Full name'], ['email', 'Email'], ['phone', 'Phone'], ['location', 'Location'], ['linkedin', 'LinkedIn'], ['github', 'GitHub'], ['website', 'Website']] as const).map(([k, label]) => (
            <div key={k} className={k === 'name' ? 'col-span-2' : ''}>
              <label className={labelCls}>{label}</label>
              <input className={inputCls} value={(content.user as any)?.[k] || ''} onChange={(e) => upd((c) => { c.user = { ...(c.user || {}), [k]: e.target.value }; })} />
            </div>
          ))}
        </div>
      </div>

      {/* Sections, in render order */}
      {design.sectionOrder.map((key, idx) => {
        const hidden = design.hiddenSections.includes(key);
        const empty = !sectionHasContent(key, content);
        return (
          <div
            key={key}
            ref={(el) => onSectionRef?.(key, el)}
            className={`border rounded-xl p-4 ${hidden ? 'border-dashed border-[#dadce0] opacity-60' : 'border-[#dadce0]'} ${sectionDnd.rowCls(idx)}`}
            {...sectionDnd.rowProps(idx)}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="cursor-grab active:cursor-grabbing text-[#5f6368] hover:text-[#202124] -ml-1"
                title="Drag to reorder sections"
                {...sectionDnd.handleProps(idx)}
              >
                <GripVertical className="h-4 w-4" />
              </div>
              <input
                className="text-sm font-bold text-[#202124] bg-transparent outline-none border-b border-transparent focus:border-[#1a73e8] flex-1 min-w-0"
                value={sectionTitle(key, design)}
                onChange={(e) => renameSection(key, e.target.value)}
                title="Rename this section heading"
                disabled={key === 'customSections'}
              />
              {empty && !hidden && <span className="text-[10px] uppercase tracking-wide text-[#5f6368] bg-[#f1f3f4] rounded px-1.5 py-0.5">empty — not rendered</span>}
              <button onClick={() => toggleHidden(key)} className="p-1 text-[#5f6368] hover:text-[#202124]" title={hidden ? 'Show section' : 'Hide section'}>
                {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {!hidden && sectionBody(key)}
          </div>
        );
      })}
      {/* Ensure every key is present even if a stale order is stored */}
      {SECTION_KEYS.length !== design.sectionOrder.length && null}
    </div>
  );
}
