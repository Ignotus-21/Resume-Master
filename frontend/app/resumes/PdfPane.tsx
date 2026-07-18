'use client';

import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import type { CompileError } from '@/lib/resumeSchema';

// pdf.js-based preview: page nav, zoom, fit-width, and — critically —
// PRESERVED SCROLL POSITION across recompiles. Pages render into canvases
// inside one scroll container; on a new PDF we re-render in place and
// restore scrollTop, so live preview doesn't jump while you type.
//
// pdfjs-dist touches DOM globals at import time, so it's loaded lazily
// inside the effect (client-only), never at module scope.

export interface PdfPaneHandle {
  /** Best-effort scroll to the page/offset where `text` first appears. */
  scrollToText: (text: string) => void;
}

interface PdfPaneProps {
  pdfData: string | null; // base64
  isCompiling: boolean;
  compileError: string | null;
  errors?: CompileError[];
  pages?: number;
}

type PdfjsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfjsModule> | null = null;
const loadPdfjs = () => {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
};

const ZOOM_LEVELS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

export const PdfPane = forwardRef<PdfPaneHandle, PdfPaneProps>(function PdfPane(
  { pdfData, isCompiling, compileError, errors = [], pages },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<any>(null);
  const renderIdRef = useRef(0);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [renderedOnce, setRenderedOnce] = useState(false);

  const effectiveScale = useCallback(
    (pageWidth: number) => {
      const container = containerRef.current;
      if (zoom === 'fit') {
        const available = (container?.clientWidth || 800) - 32; // padding
        return Math.max(0.3, available / pageWidth);
      }
      return zoom;
    },
    [zoom]
  );

  // Render (or re-render) the current document into the pages container.
  const renderDoc = useCallback(async () => {
    const doc = docRef.current;
    const host = pagesRef.current;
    const container = containerRef.current;
    if (!doc || !host || !container) return;

    const myId = ++renderIdRef.current;
    const previousScroll = container.scrollTop;

    const canvases: HTMLCanvasElement[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      if (myId !== renderIdRef.current) return; // superseded
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = effectiveScale(baseViewport.width);
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: scale * dpr });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;
      canvas.className = 'bg-white shadow-md mx-auto block mb-4';
      canvas.dataset.page = String(i);

      await page.render({ canvas, viewport }).promise;
      if (myId !== renderIdRef.current) return;
      canvases.push(canvas);
    }

    if (myId !== renderIdRef.current) return;
    host.replaceChildren(...canvases);
    container.scrollTop = previousScroll; // the whole point
    setPageCount(doc.numPages);
    setRenderedOnce(true);
  }, [effectiveScale]);

  // Load a new PDF whenever pdfData changes. A null pdfData (e.g. switching
  // documents) clears the previous document's pages instead of leaving them
  // on screen.
  useEffect(() => {
    if (!pdfData) {
      renderIdRef.current++;
      docRef.current = null;
      pagesRef.current?.replaceChildren();
      setRenderedOnce(false);
      setPageCount(0);
      setCurrentPage(1);
      return;
    }
    let cancelled = false;
    (async () => {
      const pdfjs = await loadPdfjs();
      const bytes = Uint8Array.from(atob(pdfData), (c) => c.charCodeAt(0));
      const doc = await pdfjs.getDocument({ data: bytes }).promise;
      if (cancelled) return;
      docRef.current = doc;
      await renderDoc();
    })().catch((err) => console.error('PDF render error:', err));
    return () => {
      cancelled = true;
    };
  }, [pdfData, renderDoc]);

  // Re-render on zoom changes.
  useEffect(() => {
    if (docRef.current) renderDoc().catch(() => {});
  }, [zoom, renderDoc]);

  // Track the visible page from scroll position.
  const handleScroll = () => {
    const container = containerRef.current;
    const host = pagesRef.current;
    if (!container || !host) return;
    const mid = container.scrollTop + container.clientHeight / 3;
    let page = 1;
    for (const child of Array.from(host.children) as HTMLElement[]) {
      if (child.offsetTop <= mid) page = Number(child.dataset.page || 1);
    }
    setCurrentPage(page);
  };

  const goToPage = (n: number) => {
    const host = pagesRef.current;
    const container = containerRef.current;
    if (!host || !container) return;
    const target = Array.from(host.children).find(
      (c) => (c as HTMLElement).dataset.page === String(n)
    ) as HTMLElement | undefined;
    if (target) container.scrollTo({ top: target.offsetTop - 8, behavior: 'smooth' });
  };

  // Outline navigation: find `text` in the PDF's text layer and scroll there.
  useImperativeHandle(ref, () => ({
    scrollToText: async (text: string) => {
      const doc = docRef.current;
      const host = pagesRef.current;
      const container = containerRef.current;
      if (!doc || !host || !container) return;
      const needle = text.trim().toLowerCase();
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const item = (textContent.items as any[]).find((it) =>
          typeof it.str === 'string' && it.str.trim().toLowerCase().includes(needle)
        );
        if (item) {
          const canvas = Array.from(host.children).find(
            (c) => (c as HTMLElement).dataset.page === String(i)
          ) as HTMLCanvasElement | undefined;
          if (!canvas) return;
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = canvas.clientWidth / baseViewport.width;
          // transform[5] is the baseline y in PDF space (origin bottom-left).
          const yFromTop = (baseViewport.height - item.transform[5]) * scale;
          container.scrollTo({ top: canvas.offsetTop + yFromTop - 60, behavior: 'smooth' });
          return;
        }
      }
    },
  }));

  const errorCount = errors.filter((e) => e.severity === 'error').length;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#f8f9fa] border-b border-[#dadce0] text-sm text-[#5f6368] select-none">
        <div className="flex items-center gap-2">
          <button onClick={() => goToPage(Math.max(1, currentPage - 1))} className="px-1.5 hover:text-[#202124]" title="Previous page">‹</button>
          <span className="tabular-nums">{currentPage} / {pageCount || pages || '–'}</span>
          <button onClick={() => goToPage(Math.min(pageCount, currentPage + 1))} className="px-1.5 hover:text-[#202124]" title="Next page">›</button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => (z === 'fit' ? 0.8 : ZOOM_LEVELS[Math.max(0, ZOOM_LEVELS.indexOf(z as number) - 1)]))}
            className="px-1.5 hover:text-[#202124]" title="Zoom out"
          >−</button>
          <button onClick={() => setZoom('fit')} className={`px-1.5 ${zoom === 'fit' ? 'text-[#1a73e8] font-semibold' : 'hover:text-[#202124]'}`} title="Fit width">
            Fit
          </button>
          <span className="tabular-nums w-12 text-center">{zoom === 'fit' ? 'auto' : `${Math.round((zoom as number) * 100)}%`}</span>
          <button
            onClick={() => setZoom((z) => (z === 'fit' ? 1.25 : ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, ZOOM_LEVELS.indexOf(z as number) + 1)]))}
            className="px-1.5 hover:text-[#202124]" title="Zoom in"
          >+</button>
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 min-h-0">
        {isCompiling && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500 animate-pulse z-10"></div>
        )}
        {compileError && !pdfData ? (
          <div className="p-4 bg-[#fce8e6] text-[#d93025] h-full overflow-auto font-mono text-xs whitespace-pre-wrap">
            <div className="font-bold mb-2">Compilation Error{errorCount > 1 ? `s (${errorCount})` : ''}:</div>
            {compileError}
          </div>
        ) : (
          <div ref={containerRef} onScroll={handleScroll} className="h-full overflow-auto bg-[#e8eaed] p-4">
            {!renderedOnce && (
              isCompiling ? (
                // First compile of this document: a page-shaped skeleton, so
                // the wait reads as "your document is coming" rather than a
                // blank pane.
                <div className="flex flex-col items-center pt-6">
                  <div className="w-full max-w-md aspect-[8.5/11] bg-white shadow-md p-8 space-y-3">
                    <div className="h-5 w-1/2 mx-auto rounded bg-[#f1f3f4] animate-pulse" />
                    <div className="h-3 w-2/3 mx-auto rounded bg-[#f1f3f4] animate-pulse" />
                    <div className="pt-4 space-y-2.5">
                      {['w-full', 'w-11/12', 'w-full', 'w-4/5', 'w-full', 'w-5/6', 'w-3/4', 'w-full', 'w-2/3'].map((w, i) => (
                        <div key={i} className={`h-2.5 rounded bg-[#f1f3f4] animate-pulse ${w}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-[#5f6368] mt-3">Compiling preview…</p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-[#5f6368]">
                  Preview will appear here
                </div>
              )
            )}
            <div ref={pagesRef} />
            {compileError && pdfData && (
              <div className="mx-auto max-w-xl mt-2 p-3 bg-[#fce8e6] text-[#d93025] rounded-lg font-mono text-xs whitespace-pre-wrap">
                Latest compile failed, showing last good preview.{'\n'}{compileError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
