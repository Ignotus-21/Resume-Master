'use client';

import type { DesignTokens } from '@/lib/resumeSchema';
import {
  FONTS, FONT_SIZES, SECTION_SPACINGS, HEADER_STYLES, BULLET_CHARS,
  DATE_FORMATS, LINK_STYLES, atsLint,
} from '@/lib/resumeSchema';

// Every DesignTokens field, live: each change re-renders + recompiles
// (debounced in useWorkspace; the backend compile cache makes repeat states
// instant). The ATS linter informs — it never blocks.

const rowCls = 'flex items-center justify-between gap-3';
const labelCls = 'text-xs font-medium text-[#5f6368]';
const selectCls = 'border border-[#dadce0] bg-white rounded-lg px-2 py-1 text-sm text-[#202124] outline-none max-w-[11rem]';

export function DesignPanel({ design, setDesign }: {
  design: DesignTokens;
  setDesign: (patch: Partial<DesignTokens>) => void;
}) {
  const warnings = atsLint(design);

  return (
    <div className="p-4 space-y-3 text-sm">
      <h3 className="text-sm font-bold text-[#202124]">Design</h3>

      <div className={rowCls}>
        <span className={labelCls}>Font</span>
        <select className={selectCls} value={design.font} onChange={(e) => setDesign({ font: e.target.value as DesignTokens['font'] })}>
          {FONTS.map((f) => <option key={f} value={f}>{f.replace(/([A-Z])/g, ' $1').trim()}</option>)}
        </select>
      </div>

      <div className={rowCls}>
        <span className={labelCls}>Font size</span>
        <select className={selectCls} value={design.fontSize} onChange={(e) => setDesign({ fontSize: Number(e.target.value) as DesignTokens['fontSize'] })}>
          {FONT_SIZES.map((s) => <option key={s} value={s}>{s}pt</option>)}
        </select>
      </div>

      <div className={rowCls}>
        <span className={labelCls}>Margins ({design.margin.toFixed(2)}in)</span>
        <input type="range" min={0.4} max={1.0} step={0.05} value={design.margin} onChange={(e) => setDesign({ margin: Number(e.target.value) })} className="w-32" />
      </div>

      <div className={rowCls}>
        <span className={labelCls}>Line spacing ({design.lineSpacing.toFixed(2)})</span>
        <input type="range" min={0.9} max={1.3} step={0.05} value={design.lineSpacing} onChange={(e) => setDesign({ lineSpacing: Number(e.target.value) })} className="w-32" />
      </div>

      <div className={rowCls}>
        <span className={labelCls}>Section spacing</span>
        <select className={selectCls} value={design.sectionSpacing} onChange={(e) => setDesign({ sectionSpacing: e.target.value as DesignTokens['sectionSpacing'] })}>
          {SECTION_SPACINGS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className={rowCls}>
        <span className={labelCls}>Accent color</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={design.accentColor || '#000000'}
            onChange={(e) => setDesign({ accentColor: e.target.value })}
            className="h-6 w-8 cursor-pointer border border-[#dadce0] rounded"
            title="Accent color"
          />
          <button
            onClick={() => setDesign({ accentColor: null })}
            className={`text-xs px-2 py-0.5 rounded border ${design.accentColor ? 'border-[#dadce0] text-[#5f6368] hover:text-[#202124]' : 'border-[#1a73e8] text-[#1a73e8] font-semibold'}`}
            title="Pure black & white: the ATS-safest choice"
          >
            None (B/W)
          </button>
        </div>
      </div>

      <div className={rowCls}>
        <span className={labelCls}>Header style</span>
        <select className={selectCls} value={design.headerStyle} onChange={(e) => setDesign({ headerStyle: e.target.value as DesignTokens['headerStyle'] })}>
          {HEADER_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className={rowCls}>
        <span className={labelCls}>Section rule</span>
        <select className={selectCls} value={design.sectionRule} onChange={(e) => setDesign({ sectionRule: e.target.value as DesignTokens['sectionRule'] })}>
          <option value="line">line</option>
          <option value="none">none</option>
        </select>
      </div>

      <div className={rowCls}>
        <span className={labelCls}>Bullet</span>
        <div className="flex gap-1">
          {BULLET_CHARS.map((b) => (
            <button
              key={b}
              onClick={() => setDesign({ bulletChar: b })}
              className={`w-7 h-7 rounded border text-sm ${design.bulletChar === b ? 'border-[#1a73e8] text-[#1a73e8] font-bold' : 'border-[#dadce0] text-[#5f6368]'}`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div className={rowCls}>
        <span className={labelCls}>Date format</span>
        <select className={selectCls} value={design.dateFormat} onChange={(e) => setDesign({ dateFormat: e.target.value as DesignTokens['dateFormat'] })}>
          {DATE_FORMATS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className={rowCls}>
        <span className={labelCls}>Links</span>
        <select className={selectCls} value={design.links} onChange={(e) => setDesign({ links: e.target.value as DesignTokens['links'] })}>
          {/* fontawesome5 crashes Tectonic 0.16.9 on every platform — icons
              stays selectable per the M2.5 decision but is labeled so users
              aren't surprised by a failed compile. */}
          {LINK_STYLES.map((s) => <option key={s} value={s}>{s === 'icons' ? 'icons (experimental, may fail to compile)' : s}</option>)}
        </select>
      </div>

      <div className={rowCls}>
        <span className={labelCls}>Columns</span>
        <div className="flex gap-1">
          {[1, 2].map((n) => (
            <button
              key={n}
              onClick={() => setDesign({ columns: n as 1 | 2 })}
              className={`w-7 h-7 rounded border text-sm ${design.columns === n ? 'border-[#1a73e8] text-[#1a73e8] font-bold' : 'border-[#dadce0] text-[#5f6368]'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
          <div className="text-xs font-semibold text-amber-900">ATS heads-up (your call, nothing is blocked)</div>
          {warnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-800">{w}</div>
          ))}
        </div>
      )}
    </div>
  );
}
