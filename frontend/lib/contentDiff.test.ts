import { describe, it, expect } from 'vitest';
import { contentDiff } from './contentDiff';
import type { ResumeContent } from './resumeSchema';

// The version-compare contract: identity-matched items (an edited entry is
// ONE change, not remove+add), bullet alignment (an edited bullet pairs its
// old and new text), and silence on identical content.

const base = (): ResumeContent => ({
  user: { name: 'Ada Lovelace', email: 'ada@example.com' },
  experience: [
    {
      company: 'Analytical Engines',
      role: 'Programmer',
      startDate: 'Jan 1843',
      bulletPoints: ['Wrote the first algorithm', 'Documented the engine'],
    },
  ],
  skills: { languages: ['Ada', 'Notes'], frameworks: [], tools: [], other: [] },
});

describe('contentDiff', () => {
  it('identical content yields no sections', () => {
    expect(contentDiff(base(), base())).toEqual([]);
  });

  it('an edited field on a matched item is a single "changed" item', () => {
    const after = base();
    after.experience![0].startDate = 'Feb 1843';
    const diff = contentDiff(base(), after);
    expect(diff).toHaveLength(1);
    expect(diff[0].key).toBe('experience');
    expect(diff[0].items).toEqual([
      expect.objectContaining({
        kind: 'changed',
        label: 'Programmer at Analytical Engines',
        fields: [{ label: 'Start', before: 'Jan 1843', after: 'Feb 1843' }],
      }),
    ]);
  });

  it('an edited bullet pairs old and new text; untouched bullets stay silent', () => {
    const after = base();
    after.experience![0].bulletPoints = ['Wrote the first published algorithm', 'Documented the engine'];
    const [section] = contentDiff(base(), after);
    expect(section.items[0].bullets).toEqual([
      { label: 'bullet', before: 'Wrote the first algorithm', after: 'Wrote the first published algorithm' },
    ]);
  });

  it('added and removed bullets show as one-sided diffs', () => {
    const after = base();
    after.experience![0].bulletPoints = ['Wrote the first algorithm'];
    const removedDiff = contentDiff(base(), after);
    expect(removedDiff[0].items[0].bullets).toEqual([
      { label: 'bullet', before: 'Documented the engine', after: '' },
    ]);

    const grown = base();
    grown.experience![0].bulletPoints!.push('Corresponded with Babbage');
    const addedDiff = contentDiff(base(), grown);
    expect(addedDiff[0].items[0].bullets).toEqual([
      { label: 'bullet', before: '', after: 'Corresponded with Babbage' },
    ]);
  });

  it('a new entry is "added", a dropped entry is "removed"', () => {
    const after = base();
    after.experience!.push({ company: 'Royal Society', role: 'Fellow', bulletPoints: [] });
    after.education = [{ institution: 'Home tutoring' }];
    const beforeContent = base();
    beforeContent.projects = [{ title: 'Bernoulli numbers' }];

    const diff = contentDiff(beforeContent, after);
    const byKey = Object.fromEntries(diff.map((s) => [s.key, s]));
    expect(byKey.experience.items).toEqual([
      expect.objectContaining({ kind: 'added', label: 'Fellow at Royal Society' }),
    ]);
    expect(byKey.education.items).toEqual([expect.objectContaining({ kind: 'added' })]);
    expect(byKey.projects.items).toEqual([
      expect.objectContaining({ kind: 'removed', label: 'Bernoulli numbers' }),
    ]);
  });

  it('skills and contact changes are field-level diffs', () => {
    const after = base();
    after.user!.email = 'countess@example.com';
    after.skills!.languages = ['Ada', 'Notes', 'Mathematics'];
    const diff = contentDiff(base(), after);
    const byKey = Object.fromEntries(diff.map((s) => [s.key, s]));
    expect(byKey.contact.items[0].fields).toEqual([
      { label: 'Email', before: 'ada@example.com', after: 'countess@example.com' },
    ]);
    expect(byKey.skills.items[0].fields).toEqual([
      { label: 'Languages', before: 'Ada, Notes', after: 'Ada, Notes, Mathematics' },
    ]);
  });

  it('handles empty/missing content on either side', () => {
    const diff = contentDiff({}, base());
    expect(diff.length).toBeGreaterThan(0);
    expect(contentDiff({}, {})).toEqual([]);
  });
});
