export type TimerStatus = "idle" | "running" | "paused";

export interface TimerState {
  id: string;
  name: string;
  durationSec: number;
  /** Remaining seconds as of `changedAt`. If running, keeps counting down from here. */
  remainingAtChange: number;
  /** Epoch ms of the last status/adjustment change. */
  changedAt: number;
  status: TimerStatus;
  /** If set, this timer auto-starts and becomes the active display timer the moment this timer hits zero. */
  linkedNextId: string | null;
  /** If set (and the timer is idle), it auto-starts itself at this wall-clock time. */
  scheduledStartAt: number | null;
}

export interface FlagState {
  message: string;
  sentAt: number;
}

export interface RoomState {
  code: string;
  timers: TimerState[];
  activeTimerId: string | null;
  flag: FlagState | null;
}

/** What actually goes over the wire: room state plus the server's clock. */
export type RoomStateMessage = RoomState & { now: number };

export interface ClientToServerEvents {
  "room:join": (code: string) => void;
  "timer:create": (payload: {
    code: string;
    name: string;
    durationSec: number;
    scheduledStartAt?: number | null;
  }) => void;
  "timer:delete": (payload: { code: string; id: string }) => void;
  "timer:select": (payload: { code: string; id: string }) => void;
  "timer:start": (payload: { code: string; id: string }) => void;
  "timer:pause": (payload: { code: string; id: string }) => void;
  "timer:reset": (payload: { code: string; id: string }) => void;
  "timer:adjust": (payload: { code: string; id: string; deltaSec: number }) => void;
  "timer:rename": (payload: { code: string; id: string; name: string }) => void;
  /** Sets the timer's total length directly (both the countdown baseline and remaining time). */
  "timer:setDuration": (payload: { code: string; id: string; durationSec: number }) => void;
  /** Sets the timer's length so it hits zero at this wall-clock time (epoch ms). */
  "timer:setFinishTime": (payload: { code: string; id: string; finishAt: number }) => void;
  /** Sets (or clears, with nextId: null) which timer auto-starts when this one hits zero. */
  "timer:link": (payload: { code: string; id: string; nextId: string | null }) => void;
  /** Jumps the countdown position without changing the timer's total length (scrubber drag). */
  "timer:seek": (payload: { code: string; id: string; remainingSec: number }) => void;
  /** Arms (or clears, with startAt: null) an auto-start for this timer at a future wall-clock time. */
  "timer:schedule": (payload: { code: string; id: string; startAt: number | null }) => void;
  "flag:send": (payload: { code: string; message: string }) => void;
  "flag:clear": (payload: { code: string }) => void;
}

export interface ServerToClientEvents {
  "room:state": (state: RoomStateMessage) => void;
}
