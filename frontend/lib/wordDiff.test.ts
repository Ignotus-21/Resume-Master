import { describe, it, expect } from 'vitest';
import { wordDiff, hasChanges, type DiffSegment } from './wordDiff';

// The word-diff contract: merged segments in reading order, runs coalesced,
// whitespace-insensitive. Everything downstream (rewrite previews, version
// compare) renders these segments directly.

const ops = (segs: DiffSegment[]) => segs.map((s) => `${s.op}:${s.text}`);

describe('wordDiff', () => {
  it('identical strings produce one unchanged run', () => {
    expect(ops(wordDiff('led the team', 'led the team'))).toEqual(['same:led the team']);
    expect(hasChanges(wordDiff('led the team', 'led the team'))).toBe(false);
  });

  it('a replaced word yields del + add at the same spot', () => {
    expect(ops(wordDiff('improved API latency', 'reduced API latency'))).toEqual([
      'del:improved',
      'add:reduced',
      'same:API latency',
    ]);
  });

  it('pure insertion', () => {
    expect(ops(wordDiff('built pipeline', 'built scalable data pipeline'))).toEqual([
      'same:built',
      'add:scalable data',
      'same:pipeline',
    ]);
  });

  it('pure deletion', () => {
    expect(ops(wordDiff('built very scalable pipeline', 'built pipeline'))).toEqual([
      'same:built',
      'del:very scalable',
      'same:pipeline',
    ]);
  });

  it('empty before = all added; empty after = all deleted', () => {
    expect(ops(wordDiff('', 'new bullet'))).toEqual(['add:new bullet']);
    expect(ops(wordDiff('old bullet', ''))).toEqual(['del:old bullet']);
    expect(wordDiff('', '')).toEqual([]);
  });

  it('is whitespace-insensitive', () => {
    expect(ops(wordDiff('led  the\tteam', ' led the team '))).toEqual(['same:led the team']);
  });

  it('full rewrite with a shared tail keeps the tail unchanged', () => {
    const segs = wordDiff(
      'Worked on backend stuff for the payments team',
      'Designed and shipped three microservices for the payments team'
    );
    expect(segs[segs.length - 1]).toEqual({ op: 'same', text: 'for the payments team' });
    expect(hasChanges(segs)).toBe(true);
  });

  it('reconstructs both sides from the segments', () => {
    const before = 'a quick brown fox jumps over the lazy dog';
    const after = 'a slow brown fox leaps over the dog today';
    const segs = wordDiff(before, after);
    const rebuiltBefore = segs.filter((s) => s.op !== 'add').map((s) => s.text).join(' ');
    const rebuiltAfter = segs.filter((s) => s.op !== 'del').map((s) => s.text).join(' ');
    expect(rebuiltBefore).toBe(before);
    expect(rebuiltAfter).toBe(after);
  });
});
