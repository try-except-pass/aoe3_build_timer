import type { BuildStep } from './types';

/** 754 -> "12:34" (or "1:02:03" past an hour). Negative values are clamped to 0. */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/**
 * Lenient parser for user-typed times: "1:30", "130" (= 1:30), "90s", "2m", "" (= untimed).
 * Returns `undefined` when the input can't be understood.
 */
export function parseTime(input: string): number | null | undefined {
  const t = input.trim().toLowerCase();
  if (t === '' || t === '-' || t === '—') return null;
  let m = t.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) {
    return m[3] !== undefined ? +m[1] * 3600 + +m[2] * 60 + +m[3] : +m[1] * 60 + +m[2];
  }
  m = t.match(/^(\d+)\s*s$/);
  if (m) return +m[1];
  m = t.match(/^(\d+)\s*m$/);
  if (m) return +m[1] * 60;
  m = t.match(/^(\d{1,4})$/);
  if (m) {
    // "130" reads as 1:30, "45" as 0:45.
    const n = m[1];
    return n.length <= 2 ? +n : +n.slice(0, -2) * 60 + +n.slice(-2);
  }
  return undefined;
}

/** Resolves untimed steps to the time of the closest timed step before them. */
export function effectiveTimes(steps: BuildStep[]): number[] {
  let last = 0;
  return steps.map((s) => (last = s.time ?? last));
}

/** Stable sort by effective time, so untimed steps stay attached to the step before them. */
export function sortStepsByTime(steps: BuildStep[]): BuildStep[] {
  const times = effectiveTimes(steps);
  return steps
    .map((step, i) => ({ step, t: times[i], i }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.step);
}

export function buildDuration(steps: BuildStep[]): number {
  const times = effectiveTimes(steps);
  return times.length ? Math.max(...times) : 0;
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
