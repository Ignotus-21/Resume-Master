// Structured diff between two resume `content` objects — the engine behind
// the version compare view. This is a CONTENT diff (what the user typed), not
// a .tex diff: items are matched by identity (company+role, institution,
// title, …), then compared field-by-field, with bullet lists aligned so an
// edited bullet reads as one change, not a delete + an insert.

import type { ResumeContent, SectionKey } from './resumeSchema';
import { DEFAULT_SECTION_TITLES } from './resumeSchema';

export type ChangeKind = 'added' | 'removed' | 'changed';

export interface FieldDiff {
  label: string;
  before: string;
  after: string;
}

export interface ItemDiff {
  kind: ChangeKind;
  /** Human handle for the item, e.g. "SWE Intern — Google". */
  label: string;
  /** Changed scalar fields (only present when kind === 'changed'). */
  fields: FieldDiff[];
  /** Bullet-level changes (only for sections that carry bullets). */
  bullets: FieldDiff[]; // label 'bullet'; before/after '' for pure add/remove
}

export interface SectionDiff {
  key: SectionKey | 'contact';
  title: string;
  items: ItemDiff[];
}

const str = (v: unknown): string => (v == null ? '' : String(v).trim());
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

// ---------------------------------------------------------------------------
// Bullet alignment: exact-equal bullets are anchors (LCS), the leftovers are
// paired in order as edits, and the overhang becomes pure adds/removes.

const alignBullets = (before: string[], after: string[]): FieldDiff[] => {
  const n = before.length;
  const m = after.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const diffs: FieldDiff[] = [];
  let pendingDel: string[] = [];
  let pendingAdd: string[] = [];
  const flush = () => {
    const pairs = Math.min(pendingDel.length, pendingAdd.length);
    for (let k = 0; k < pairs; k++) diffs.push({ label: 'bullet', before: pendingDel[k], after: pendingAdd[k] });
    for (let k = pairs; k < pendingDel.length; k++) diffs.push({ label: 'bullet', before: pendingDel[k], after: '' });
    for (let k = pairs; k < pendingAdd.length; k++) diffs.push({ label: 'bullet', before: '', after: pendingAdd[k] });
    pendingDel = [];
    pendingAdd = [];
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      flush();
      i++; j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      pendingDel.push(before[i++]);
    } else {
      pendingAdd.push(after[j++]);
    }
  }
  while (i < n) pendingDel.push(before[i++]);
  while (j < m) pendingAdd.push(after[j++]);
  flush();

  return diffs;
};

// ---------------------------------------------------------------------------
// Per-section shape: how to identify an item, label it, and which fields to
// compare. Identity is what "same item, edited" means — fields outside the
// identity can change without splitting into remove + add.

interface SectionSpec {
  key: SectionKey;
  identity: (it: any) => string;
  label: (it: any) => string;
  fields: [string, string][]; // [property, human label]
  bulletsProp?: string;
}

const SECTION_SPECS: SectionSpec[] = [
  {
    key: 'experience',
    identity: (it) => `${str(it.company)}|${str(it.role)}`.toLowerCase(),
    label: (it) => [str(it.role), str(it.company)].filter(Boolean).join(' — ') || 'Experience entry',
    fields: [['startDate', 'Start'], ['endDate', 'End'], ['location', 'Location'], ['isCurrent', 'Current']],
    bulletsProp: 'bulletPoints',
  },
  {
    key: 'education',
    identity: (it) => str(it.institution).toLowerCase(),
    label: (it) => [str(it.degree), str(it.institution)].filter(Boolean).join(' — ') || 'Education entry',
    fields: [['degree', 'Degree'], ['fieldOfStudy', 'Field'], ['startDate', 'Start'], ['endDate', 'End'], ['gpa', 'GPA'], ['coursework', 'Coursework']],
  },
  {
    key: 'projects',
    identity: (it) => str(it.title).toLowerCase(),
    label: (it) => str(it.title) || 'Project',
    fields: [['description', 'Description'], ['link', 'Link'], ['techStack', 'Tech stack']],
    bulletsProp: 'bulletPoints',
  },
  {
    key: 'certificates',
    identity: (it) => str(it.name).toLowerCase(),
    label: (it) => str(it.name) || 'Certificate',
    fields: [['issuer', 'Issuer'], ['date', 'Date']],
  },
  {
    key: 'achievements',
    identity: (it) => str(it.title).toLowerCase(),
    label: (it) => str(it.title) || 'Achievement',
    fields: [['description', 'Description'], ['date', 'Date']],
  },
  {
    key: 'publications',
    identity: (it) => str(it.title).toLowerCase(),
    label: (it) => str(it.title) || 'Publication',
    fields: [['description', 'Description'], ['date', 'Date'], ['link', 'Link']],
  },
  {
    key: 'volunteering',
    identity: (it) => `${str(it.organization)}|${str(it.role)}`.toLowerCase(),
    label: (it) => [str(it.role), str(it.organization)].filter(Boolean).join(' — ') || 'Volunteering entry',
    fields: [['startDate', 'Start'], ['endDate', 'End'], ['description', 'Description']],
  },
  {
    key: 'patents',
    identity: (it) => str(it.title).toLowerCase(),
    label: (it) => str(it.title) || 'Patent',
    fields: [['number', 'Number'], ['date', 'Date'], ['description', 'Description']],
  },
];

const fieldValue = (it: any, prop: string): string => {
  const v = it?.[prop];
  if (Array.isArray(v)) return list(v).join(', ');
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return str(v);
};

const diffItemPair = (spec: SectionSpec, before: any, after: any): ItemDiff | null => {
  const fields: FieldDiff[] = [];
  for (const [prop, label] of spec.fields) {
    const b = fieldValue(before, prop);
    const a = fieldValue(after, prop);
    if (b !== a) fields.push({ label, before: b, after: a });
  }
  const bullets = spec.bulletsProp
    ? alignBullets(list(before?.[spec.bulletsProp]), list(after?.[spec.bulletsProp]))
    : [];
  if (fields.length === 0 && bullets.length === 0) return null;
  return { kind: 'changed', label: spec.label(after), fields, bullets };
};

const diffListSection = (spec: SectionSpec, before: any[], after: any[]): ItemDiff[] => {
  const items: ItemDiff[] = [];
  const beforeLeft = [...before];

  for (const a of after) {
    const idx = beforeLeft.findIndex((b) => spec.identity(b) === spec.identity(a));
    if (idx === -1) {
      items.push({ kind: 'added', label: spec.label(a), fields: [], bullets: [] });
    } else {
      const [b] = beforeLeft.splice(idx, 1);
      const changed = diffItemPair(spec, b, a);
      if (changed) items.push(changed);
    }
  }
  for (const b of beforeLeft) {
    items.push({ kind: 'removed', label: spec.label(b), fields: [], bullets: [] });
  }
  return items;
};

// ---------------------------------------------------------------------------

const CONTACT_FIELDS: [string, string][] = [
  ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['location', 'Location'],
  ['linkedin', 'LinkedIn'], ['github', 'GitHub'], ['website', 'Website'],
];

const SKILL_GROUPS: [string, string][] = [
  ['languages', 'Languages'], ['frameworks', 'Frameworks'], ['tools', 'Tools'], ['other', 'Other'],
];

/**
 * Diff two resume contents. Returns only sections that actually changed;
 * an empty array means the two versions have identical content.
 */
export function contentDiff(before: ResumeContent, after: ResumeContent): SectionDiff[] {
  const sections: SectionDiff[] = [];

  // Contact block: one pseudo-item with per-field diffs.
  const contactFields: FieldDiff[] = [];
  for (const [prop, label] of CONTACT_FIELDS) {
    const b = str((before.user as any)?.[prop]);
    const a = str((after.user as any)?.[prop]);
    if (b !== a) contactFields.push({ label, before: b, after: a });
  }
  if (contactFields.length > 0) {
    sections.push({
      key: 'contact',
      title: 'Contact',
      items: [{ kind: 'changed', label: 'Contact details', fields: contactFields, bullets: [] }],
    });
  }

  for (const spec of SECTION_SPECS) {
    const items = diffListSection(spec, (before as any)[spec.key] || [], (after as any)[spec.key] || []);
    if (items.length > 0) sections.push({ key: spec.key, title: DEFAULT_SECTION_TITLES[spec.key], items });
  }

  // Skills: four comma-joined lists, compared as text.
  const skillFields: FieldDiff[] = [];
  for (const [prop, label] of SKILL_GROUPS) {
    const b = list((before.skills as any)?.[prop]).join(', ');
    const a = list((after.skills as any)?.[prop]).join(', ');
    if (b !== a) skillFields.push({ label, before: b, after: a });
  }
  if (skillFields.length > 0) {
    sections.push({
      key: 'skills',
      title: DEFAULT_SECTION_TITLES.skills,
      items: [{ kind: 'changed', label: 'Skills', fields: skillFields, bullets: [] }],
    });
  }

  // Hobbies: one comma-joined list.
  const hb = list(before.hobbies).join(', ');
  const ha = list(after.hobbies).join(', ');
  if (hb !== ha) {
    sections.push({
      key: 'hobbies',
      title: DEFAULT_SECTION_TITLES.hobbies,
      items: [{ kind: 'changed', label: 'Interests', fields: [{ label: 'Interests', before: hb, after: ha }], bullets: [] }],
    });
  }

  // Custom sections: identified by section title; items flattened to text.
  const customSpec: SectionSpec = {
    key: 'customSections',
    identity: (s) => str(s.title).toLowerCase(),
    label: (s) => str(s.title) || 'Custom section',
    fields: [],
    bulletsProp: '__lines',
  };
  const flattenCustom = (s: any) => ({
    ...s,
    __lines: (s.items || []).map((it: any) =>
      [str(it.title), str(it.subtitle), str(it.date), str(it.description)].filter(Boolean).join(' · ')
    ).filter(Boolean),
  });
  const customItems = diffListSection(
    customSpec,
    ((before.customSections as any[]) || []).map(flattenCustom),
    ((after.customSections as any[]) || []).map(flattenCustom)
  );
  if (customItems.length > 0) sections.push({ key: 'customSections', title: 'Custom Sections', items: customItems });

  return sections;
}
