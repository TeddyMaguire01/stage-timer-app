import type { TimerState } from "@/types/room";

/** Seconds remaining right now (negative once in overtime). */
export function remainingSeconds(timer: TimerState, clockOffsetMs: number): number {
  const now = Date.now() + clockOffsetMs;
  if (timer.status === "running") {
    const elapsedSec = (now - timer.changedAt) / 1000;
    return timer.remainingAtChange - elapsedSec;
  }
  return timer.remainingAtChange;
}

function formatUnits(absSeconds: number): string {
  const h = Math.floor(absSeconds / 3600);
  const m = Math.floor((absSeconds % 3600) / 60);
  const s = absSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Counting down: ceil, so the display holds "1:00" for the whole final
 * second instead of jumping to "0:59" early. Counting up (overtime): floor,
 * so it behaves like a normal stopwatch.
 */
export function formatClock(totalSeconds: number): string {
  if (totalSeconds >= 0) {
    return formatUnits(Math.ceil(totalSeconds));
  }
  return `+${formatUnits(Math.floor(Math.abs(totalSeconds)))}`;
}

/** Wall-clock epoch ms this timer will hit zero, counting down from right now. */
export function finishTimeMs(timer: TimerState, clockOffsetMs: number): number {
  const now = Date.now() + clockOffsetMs;
  return now + remainingSeconds(timer, clockOffsetMs) * 1000;
}

/** Formats an epoch ms as a local 24h HH:MM:SS wall-clock time. */
export function formatTimeOfDay(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Current local time as "HH:MM", for pre-filling a time input. */
export function currentHHMM(clockOffsetMs: number): string {
  const d = new Date(Date.now() + clockOffsetMs);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Given an "HH:MM" string (as produced by <input type="time">), returns the
 * next epoch ms that time occurs at — today if it hasn't passed yet, else
 * tomorrow.
 */
export function nextOccurrenceOfTime(hhmm: string, clockOffsetMs: number): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const now = new Date(Date.now() + clockOffsetMs);
  const candidate = new Date(now);
  candidate.setHours(hours, minutes, 0, 0);
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.getTime() - clockOffsetMs;
}
