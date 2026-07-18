'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Minus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { DiffText } from '@/components/resume/DiffText';
import { contentDiff, type SectionDiff } from '@/lib/contentDiff';
import type { ResumeDocument } from '@/lib/resumeSchema';

// Version compare: a structured, content-level diff between another saved
// version and the one open in the workspace. Reads both `content` objects —
// deliberately NOT a .tex diff, so a date tweak reads as "Start: Jan → Feb",
// not as noise in a LaTeX preamble.

export function VersionDiffModal({
  targetId,
  currentDoc,
  onClose,
}: {
  /** The version to compare against; null = closed. */
  targetId: string | null;
  currentDoc: ResumeDocument | null;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<ResumeDocument | null>(null);
  const [error, setError] = useState('');
  const open = targetId !== null;

  useEffect(() => {
    if (!targetId) {
      setTarget(null);
      setError('');
      return;
    }
    let cancelled = false;
    // Fetch fresh — the rail's list copy can be stale, and the single-doc GET
    // normalizes legacy rows.
    apiFetch(`/api/resumes/${targetId}`)
      .then((full: ResumeDocument) => { if (!cancelled) setTarget(full); })
      .catch((e: any) => { if (!cancelled) setError(e.message || 'Failed to load that version'); });
    return () => { cancelled = true; };
  }, [targetId]);

  let body: React.ReactNode;
  if (error) {
    body = <p className="text-sm text-[#d93025]">{error}</p>;
  } else if (!target || !currentDoc) {
    body = (
      <div className="flex items-center gap-2 text-sm text-[#5f6368] py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading version…
      </div>
    );
  } else if (!target.content || !currentDoc.content) {
    body = (
      <p className="text-sm text-[#5f6368]">
        {!currentDoc.content
          ? 'The open version has no structured content to compare (ejected to LaTeX).'
          : 'That version has no structured content to compare (ejected to LaTeX).'}
      </p>
    );
  } else {
    const sections = contentDiff(target.content, currentDoc.content);
    body = sections.length === 0 ? (
      <p className="text-sm text-[#5f6368]">
        No content differences. The two versions may still differ in design or template.
      </p>
    ) : (
      <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
        <p className="text-xs text-[#5f6368]">
          Showing what changed from <span className="font-semibold">{target.versionName}</span> to{' '}
          <span className="font-semibold">{currentDoc.versionName}</span> (the open version).
        </p>
        {sections.map((section) => (
          <SectionBlock key={section.key} section={section} />
        ))}
      </div>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Compare versions" panelClassName="max-w-2xl">
      {body}
    </Modal>
  );
}

function SectionBlock({ section }: { section: SectionDiff }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#5f6368] mb-2">{section.title}</h3>
      <div className="space-y-2">
        {section.items.map((item, i) => {
          if (item.kind === 'added') {
            return (
              <div key={i} className="flex items-center gap-2 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-[#188038]">
                <Plus className="h-3.5 w-3.5 shrink-0" /> <span className="font-medium">{item.label}</span>
                <span className="text-xs opacity-70 ml-auto">added</span>
              </div>
            );
          }
          if (item.kind === 'removed') {
            return (
              <div key={i} className="flex items-center gap-2 text-sm bg-[#fce8e6] border border-[#d93025]/30 rounded-lg px-3 py-2 text-[#d93025]">
                <Minus className="h-3.5 w-3.5 shrink-0" /> <del className="font-medium">{item.label}</del>
                <span className="text-xs opacity-70 ml-auto">removed</span>
              </div>
            );
          }
          return (
            <div key={i} className="border border-[#dadce0] rounded-lg px-3 py-2 space-y-1.5">
              <div className="text-sm font-medium text-[#202124]">{item.label}</div>
              {item.fields.map((f, fi) => (
                <div key={fi} className="text-sm text-[#202124]">
                  <span className="text-xs text-[#5f6368]">{f.label}: </span>
                  <DiffText before={f.before} after={f.after} />
                </div>
              ))}
              {item.bullets.map((b, bi) => (
                <div key={bi} className="text-sm text-[#202124] pl-3 border-l-2 border-[#e8eaed]">
                  <DiffText before={b.before} after={b.after} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
