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
