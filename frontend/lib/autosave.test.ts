import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAutosaver, type AutosaveState } from './autosave';

// The autosave engine's contract, tested with fake timers:
// - rapid-fire edits settle into exactly ONE save after the debounce window
// - edits typed during an in-flight save trigger exactly one follow-up save
// - failures retry on the backoff ladder, always persisting the LATEST state
// - an exhausted ladder parks at 'failed' without losing edits; new edits or
//   flush() restart it

const DEBOUNCE = 1500;

const trackStates = () => {
  const states: AutosaveState[] = [];
  return { states, onStateChange: (s: AutosaveState) => states.push(s) };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('debounce', () => {
  it('rapid-fire edits settle into exactly one save call', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const saver = createAutosaver({ save, debounceMs: DEBOUNCE });

    // 40 "keystrokes" 100ms apart — each restarts the debounce window.
    for (let i = 0; i < 40; i++) {
      saver.notifyChange();
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(save).not.toHaveBeenCalled();
    expect(saver.getState()).toBe('pending');

    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(save).toHaveBeenCalledTimes(1);
    expect(saver.getState()).toBe('saved');
    expect(saver.isDirty()).toBe(false);
  });

  it('does not save at all when nothing changed', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const saver = createAutosaver({ save, debounceMs: DEBOUNCE });
    await vi.advanceTimersByTimeAsync(DEBOUNCE * 10);
    expect(save).not.toHaveBeenCalled();
    expect(await saver.flush()).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it('edits during an in-flight save produce exactly one follow-up save', async () => {
    let resolveSave!: () => void;
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((r) => { resolveSave = r; }))
      .mockResolvedValue(undefined);
    const saver = createAutosaver({ save, debounceMs: DEBOUNCE });

    saver.notifyChange();
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(save).toHaveBeenCalledTimes(1);
    expect(saver.getState()).toBe('saving');

    // Two more edits while the request is in flight.
    saver.notifyChange();
    saver.notifyChange();
    resolveSave();
    await vi.advanceTimersByTimeAsync(0);

    // Mid-flight edits are not yet persisted — a new debounce round runs.
    expect(saver.getState()).toBe('pending');
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(save).toHaveBeenCalledTimes(2);
    expect(saver.getState()).toBe('saved');
  });
});

describe('retry with backoff', () => {
  it('retries after a failure and persists the latest state', async () => {
    // The engine calls save() with no snapshot — save reads the caller's
    // CURRENT state. Simulate that with a mutable document.
    let docText = 'v1';
    const persisted: string[] = [];
    const save = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(new Error('network down')))
      .mockImplementation(() => { persisted.push(docText); return Promise.resolve(); });
    const backoffMs = (retry: number) => retry * 1000;
    const saver = createAutosaver({ save, debounceMs: DEBOUNCE, backoffMs });

    saver.notifyChange();
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(save).toHaveBeenCalledTimes(1);
    expect(saver.getState()).toBe('retrying');

    // User keeps typing while the retry backoff is pending.
    docText = 'v2';
    saver.notifyChange();

    await vi.advanceTimersByTimeAsync(1000); // backoff for retry #1
    expect(save).toHaveBeenCalledTimes(2);
    expect(persisted).toEqual(['v2']); // latest state, not a stale snapshot
    expect(saver.getState()).toBe('saved');
  });

  it('parks at failed after the retry budget, then a new edit restarts it', async () => {
    const save = vi.fn().mockRejectedValue(new Error('down'));
    const { states, onStateChange } = trackStates();
    const backoffMs = () => 1000;
    const saver = createAutosaver({ save, debounceMs: DEBOUNCE, maxRetries: 2, backoffMs, onStateChange });

    saver.notifyChange();
    await vi.advanceTimersByTimeAsync(DEBOUNCE); // attempt 1 fails
    await vi.advanceTimersByTimeAsync(1000);     // retry 1 fails
    await vi.advanceTimersByTimeAsync(1000);     // retry 2 fails -> budget spent
    expect(save).toHaveBeenCalledTimes(3);
    expect(saver.getState()).toBe('failed');
    expect(saver.isDirty()).toBe(true); // edits are still held, not dropped

    // Nothing else is scheduled while failed.
    await vi.advanceTimersByTimeAsync(60000);
    expect(save).toHaveBeenCalledTimes(3);

    // A fresh edit re-arms with a fresh budget and succeeds.
    save.mockResolvedValue(undefined);
    saver.notifyChange();
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(save).toHaveBeenCalledTimes(4);
    expect(saver.getState()).toBe('saved');
    // setState dedupes, so the repeated retrying attempts appear once.
    expect(states).toEqual([
      'pending', 'saving', 'retrying', 'failed',
      'pending', 'saving', 'saved',
    ]);
  });

  it('backoff waits are respected — no immediate hammering', async () => {
    const save = vi.fn().mockRejectedValue(new Error('down'));
    const backoffMs = () => 5000;
    const saver = createAutosaver({ save, debounceMs: DEBOUNCE, backoffMs });

    saver.notifyChange();
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4999);
    expect(save).toHaveBeenCalledTimes(1); // still waiting out the backoff
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(2);
  });
});

describe('flush', () => {
  it('saves immediately without waiting out the debounce', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const saver = createAutosaver({ save, debounceMs: DEBOUNCE });

    saver.notifyChange();
    const ok = await saver.flush();
    expect(ok).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    expect(saver.getState()).toBe('saved');

    // The debounce timer was cancelled — no second save later.
    await vi.advanceTimersByTimeAsync(DEBOUNCE * 2);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('returns false when the immediate attempt fails, and keeps retrying', async () => {
    const save = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(new Error('down')))
      .mockResolvedValue(undefined);
    const backoffMs = () => 1000;
    const saver = createAutosaver({ save, debounceMs: DEBOUNCE, backoffMs });

    saver.notifyChange();
    expect(await saver.flush()).toBe(false);
    expect(saver.getState()).toBe('retrying');

    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(saver.getState()).toBe('saved');
  });

  it('waits for an in-flight save and covers edits made before the flush call', async () => {
    let resolveFirst!: () => void;
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((r) => { resolveFirst = r; }))
      .mockResolvedValue(undefined);
    const saver = createAutosaver({ save, debounceMs: DEBOUNCE });

    saver.notifyChange();
    await vi.advanceTimersByTimeAsync(DEBOUNCE); // save #1 in flight
    saver.notifyChange();                        // edit during flight
    const flushPromise = saver.flush();
    resolveFirst();
    await vi.advanceTimersByTimeAsync(0);
    expect(await flushPromise).toBe(true);
    expect(save).toHaveBeenCalledTimes(2); // flush ran the follow-up immediately
    expect(saver.getState()).toBe('saved');
  });
});

describe('lifecycle', () => {
  it('markClean drops pending work without saving', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const saver = createAutosaver({ save, debounceMs: DEBOUNCE });
    saver.notifyChange();
    saver.markClean();
    expect(saver.isDirty()).toBe(false);
    await vi.advanceTimersByTimeAsync(DEBOUNCE * 2);
    expect(save).not.toHaveBeenCalled();
    expect(saver.getState()).toBe('saved');
  });

  it('dispose cancels scheduled saves', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const saver = createAutosaver({ save, debounceMs: DEBOUNCE });
    saver.notifyChange();
    saver.dispose();
    await vi.advanceTimersByTimeAsync(DEBOUNCE * 2);
    expect(save).not.toHaveBeenCalled();
  });
});
