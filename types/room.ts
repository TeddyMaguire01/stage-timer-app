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
  "timer:create": (payload: { code: string; name: string; durationSec: number }) => void;
  "timer:delete": (payload: { code: string; id: string }) => void;
  "timer:select": (payload: { code: string; id: string }) => void;
  "timer:start": (payload: { code: string; id: string }) => void;
  "timer:pause": (payload: { code: string; id: string }) => void;
  "timer:reset": (payload: { code: string; id: string }) => void;
  "timer:adjust": (payload: { code: string; id: string; deltaSec: number }) => void;
  "timer:rename": (payload: { code: string; id: string; name: string }) => void;
  "flag:send": (payload: { code: string; message: string }) => void;
  "flag:clear": (payload: { code: string }) => void;
}

export interface ServerToClientEvents {
  "room:state": (state: RoomStateMessage) => void;
}
