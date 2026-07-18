'use client';

import { useEffect, useRef, useState } from 'react';
import { apiJson } from '@/lib/api';
import type { ResumeContent, DesignTokens, TemplateId } from '@/lib/resumeSchema';
import { TEMPLATE_IDS, TEMPLATE_LABELS } from '@/lib/resumeSchema';

// Template gallery with live thumbnails rendered from THE USER'S OWN
// CONTENT, not stock previews: each template is compiled through the normal
// compile endpoint (deterministic render -> sha256 cache, so repeat opens
// are instant) and the first PDF page is drawn small with pdf.js.

const thumbCache = new Map<string, string>(); // contentHash+template -> dataURL

export function TemplateGallery({ content, design, activeTemplate, onPick }: {
  content: ResumeContent;
  design: DesignTokens;
  activeTemplate: TemplateId;
  onPick: (t: TemplateId) => void;
}) {
  const [thumbs, setThumbs] = useState<Partial<Record<TemplateId, string>>>({});
  const [failed, setFailed] = useState<Partial<Record<TemplateId, boolean>>>({});
  const contentKey = useRef('');

  useEffect(() => {
    let cancelled = false;
    const key = JSON.stringify({ c: content, d: design });
    contentKey.current = key;

    (async () => {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();

      for (const templateId of TEMPLATE_IDS) {
        const cacheKey = `${key}:${templateId}`;
        if (thumbCache.has(cacheKey)) {
          if (!cancelled) setThumbs((t) => ({ ...t, [templateId]: thumbCache.get(cacheKey)! }));
          continue;
        }
        try {
          const data = await apiJson('/api/resumes/compile', 'POST', { content, design, templateId });
          if (cancelled || contentKey.current !== key) return;
          if (!data.success) throw new Error('compile failed');
          const bytes = Uint8Array.from(atob(data.pdf), (c) => c.charCodeAt(0));
          const doc = await pdfjs.getDocument({ data: bytes }).promise;
          const page = await doc.getPage(1);
          const viewport = page.getViewport({ scale: 0.35 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvas, viewport }).promise;
          const url = canvas.toDataURL();
          thumbCache.set(cacheKey, url);
          if (!cancelled) setThumbs((t) => ({ ...t, [templateId]: url }));
        } catch {
          if (!cancelled) setFailed((f) => ({ ...f, [templateId]: true }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // thumbnails are generated for the state at open time — reopen to refresh

  return (
    <div className="p-4">
      <h3 className="text-sm font-bold text-[#202124] mb-3">Templates: previewing your content</h3>
      <div className="grid grid-cols-2 gap-3">
        {TEMPLATE_IDS.map((templateId) => (
          <button
            key={templateId}
            onClick={() => onPick(templateId)}
            className={`text-left border-2 rounded-xl overflow-hidden transition ${
              activeTemplate === templateId ? 'border-[#1a73e8] shadow-md' : 'border-[#dadce0] hover:border-[#5f6368]'
            }`}
          >
            <div className="aspect-[8.5/11] bg-white flex items-center justify-center overflow-hidden">
              {thumbs[templateId] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbs[templateId]} alt={`${templateId} preview`} className="w-full h-full object-contain" />
              ) : failed[templateId] ? (
                <span className="text-xs text-[#d93025] p-2 text-center">Preview failed</span>
              ) : (
                <span className="text-xs text-[#5f6368] animate-pulse">Rendering…</span>
              )}
            </div>
            <div className="px-2 py-1.5 text-xs text-[#202124] bg-[#f8f9fa] border-t border-[#dadce0]">
              {TEMPLATE_LABELS[templateId]}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
