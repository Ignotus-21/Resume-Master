// Debounced autosave engine for the resume workspace. Deliberately
// framework-free (no React imports) so its timing semantics — debounce
// settling, retry backoff, edits-during-save — are unit-testable with fake
// timers (see autosave.test.ts).
//
// Design invariants:
// - `save` is called with NO snapshot argument: the caller reads its latest
//   state at call time, so a retry after further edits never replays a stale
//   snapshot. Whatever happens to the network, the newest edits are what get
//   persisted next — that's the promise autosave makes to the user.
// - The autosave debounce is independent of the compile debounce in
//   useWorkspace (COMPILE_DEBOUNCE_MS); save timing must never be coupled to
//   preview timing.
// - Failures retry on a backoff ladder; when the ladder is exhausted the
//   state parks at 'failed' (edits stay in memory) and any new edit or a
//   manual flush() restarts with a fresh retry budget.

export type AutosaveState =
  | 'saved'     // nothing to persist
  | 'pending'   // edits waiting out the debounce window
  | 'saving'    // save request in flight
  | 'retrying'  // last attempt failed; waiting out backoff or retrying
  | 'failed';   // retry budget exhausted; edits kept, waiting for user action

export interface AutosaverOptions {
  /** Persist the caller's CURRENT state. Reject to trigger the retry ladder. */
  save: () => Promise<void>;
  /** Quiet time after the last edit before saving. Default 1500ms. */
  debounceMs?: number;
  /** Failed attempts allowed after the first before parking at 'failed'. Default 4. */
  maxRetries?: number;
  /** Backoff delay before retry N (1-based). Default 1s, 2s, 4s, 8s… capped at 15s. */
  backoffMs?: (retry: number) => number;
  onStateChange?: (state: AutosaveState) => void;
}

export interface Autosaver {
  /** Call on every edit. Starts/restarts the debounce window. */
  notifyChange(): void;
  /** Save now (manual Save, doc switch, blur). Resolves true once everything
   * known at call time is persisted; false if the immediate attempt failed
   * (the retry ladder keeps running in the background). */
  flush(): Promise<boolean>;
  /** Mark the current state as persisted without saving — for flows that
   * already wrote the document through their own request (eject/revert). */
  markClean(): void;
  getState(): AutosaveState;
  /** True when there are edits the server doesn't have yet. */
  isDirty(): boolean;
  /** Cancel timers and ignore any in-flight result. Does NOT flush. */
  dispose(): void;
}

const defaultBackoff = (retry: number) => Math.min(1000 * 2 ** (retry - 1), 15000);

export function createAutosaver({
  save,
  debounceMs = 1500,
  maxRetries = 4,
  backoffMs = defaultBackoff,
  onStateChange,
}: AutosaverOptions): Autosaver {
  let state: AutosaveState = 'saved';
  // Monotonic edit counter vs. the highest counter value known to be saved.
  // Comparing these is what makes "edits typed during a save still get
  // saved afterwards" fall out naturally.
  let changeSeq = 0;
  let savedSeq = 0;
  let retryCount = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // The whole current attempt including its bookkeeping, so flush() can await
  // it and observe consistent state afterwards.
  let currentRun: Promise<void> | null = null;
  let disposed = false;

  const setState = (next: AutosaveState) => {
    if (state === next) return;
    state = next;
    onStateChange?.(next);
  };

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = (ms: number) => {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void runSave();
    }, ms);
  };

  const runSave = (): Promise<void> => {
    if (currentRun) return currentRun;
    currentRun = (async () => {
      clearTimer();
      if (disposed || changeSeq === savedSeq) return;
      const seqAtStart = changeSeq;
      setState(retryCount > 0 ? 'retrying' : 'saving');
      try {
        await save();
        if (disposed) return;
        savedSeq = seqAtStart;
        retryCount = 0;
        if (changeSeq > savedSeq) {
          // Edits arrived while the request was in flight — new debounce round.
          setState('pending');
          schedule(debounceMs);
        } else {
          setState('saved');
        }
      } catch {
        if (disposed) return;
        retryCount += 1;
        if (retryCount > maxRetries) {
          setState('failed');
        } else {
          setState('retrying');
          schedule(backoffMs(retryCount));
        }
      }
    })().finally(() => {
      currentRun = null;
    });
    return currentRun;
  };

  return {
    notifyChange() {
      if (disposed) return;
      changeSeq += 1;
      // While a save is in flight, the completion handler reschedules; while
      // a retry backoff is pending, the scheduled attempt will pick up these
      // edits anyway (save reads latest state) — don't reset its pacing.
      if (currentRun || state === 'retrying') return;
      if (state === 'failed') retryCount = 0; // fresh edits get a fresh budget
      setState('pending');
      schedule(debounceMs);
    },

    async flush() {
      if (disposed) return true;
      const target = changeSeq;
      if (currentRun) await currentRun;
      if (savedSeq >= target) return true;
      clearTimer(); // cancel any debounce/backoff timer; we're saving now
      retryCount = 0; // manual save restarts the retry budget
      await runSave();
      return savedSeq >= target;
    },

    markClean() {
      if (disposed) return;
      clearTimer();
      savedSeq = changeSeq;
      retryCount = 0;
      setState('saved');
    },

    getState: () => state,
    isDirty: () => changeSeq > savedSeq || currentRun !== null,

    dispose() {
      disposed = true;
      clearTimer();
    },
  };
}
