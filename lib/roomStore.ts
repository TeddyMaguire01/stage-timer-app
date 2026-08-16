import { randomUUID } from "crypto";
import type { RoomState, TimerState } from "../types/room";

const rooms = new Map<string, RoomState>();

function ensureRoom(code: string): RoomState {
  let room = rooms.get(code);
  if (!room) {
    room = { code, timers: [], activeTimerId: null, flag: null };
    rooms.set(code, room);
  }
  return room;
}

function findTimer(room: RoomState, id: string): TimerState | undefined {
  return room.timers.find((t) => t.id === id);
}

/** Remaining seconds right now, given the timer's last recorded checkpoint. */
export function currentRemaining(timer: TimerState): number {
  if (timer.status === "running") {
    const elapsedSec = (Date.now() - timer.changedAt) / 1000;
    return timer.remainingAtChange - elapsedSec;
  }
  return timer.remainingAtChange;
}

/** True if walking nextId's chain from `id` would loop back to `id`. */
function wouldCreateCycle(room: RoomState, id: string, nextId: string): boolean {
  let cursor: string | null = nextId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === id) return true;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = findTimer(room, cursor)?.linkedNextId ?? null;
  }
  return false;
}

export function createRoomStore() {
  return {
    getState(code: string): RoomState {
      return ensureRoom(code);
    },

    getTimer(code: string, id: string): TimerState | undefined {
      return findTimer(ensureRoom(code), id);
    },

    createTimer(code: string, name: string, durationSec: number) {
      const room = ensureRoom(code);
      const timer: TimerState = {
        id: randomUUID(),
        name: name || "Timer",
        durationSec,
        remainingAtChange: durationSec,
        changedAt: Date.now(),
        status: "idle",
        linkedNextId: null,
      };
      room.timers.push(timer);
      if (!room.activeTimerId) room.activeTimerId = timer.id;
    },

    deleteTimer(code: string, id: string) {
      const room = ensureRoom(code);
      room.timers = room.timers.filter((t) => t.id !== id);
      for (const t of room.timers) {
        if (t.linkedNextId === id) t.linkedNextId = null;
      }
      if (room.activeTimerId === id) {
        room.activeTimerId = room.timers[0]?.id ?? null;
      }
    },

    selectTimer(code: string, id: string) {
      const room = ensureRoom(code);
      if (findTimer(room, id)) room.activeTimerId = id;
    },

    rename(code: string, id: string, name: string) {
      const room = ensureRoom(code);
      const timer = findTimer(room, id);
      if (timer && name.trim()) timer.name = name.trim();
    },

    start(code: string, id: string) {
      const room = ensureRoom(code);
      const timer = findTimer(room, id);
      if (!timer || timer.status === "running") return;
      timer.remainingAtChange = currentRemaining(timer);
      timer.changedAt = Date.now();
      timer.status = "running";
    },

    pause(code: string, id: string) {
      const room = ensureRoom(code);
      const timer = findTimer(room, id);
      if (!timer || timer.status !== "running") return;
      timer.remainingAtChange = currentRemaining(timer);
      timer.changedAt = Date.now();
      timer.status = "paused";
    },

    reset(code: string, id: string) {
      const room = ensureRoom(code);
      const timer = findTimer(room, id);
      if (!timer) return;
      timer.remainingAtChange = timer.durationSec;
      timer.changedAt = Date.now();
      timer.status = "idle";
    },

    adjust(code: string, id: string, deltaSec: number) {
      const room = ensureRoom(code);
      const timer = findTimer(room, id);
      if (!timer) return;
      timer.remainingAtChange = currentRemaining(timer) + deltaSec;
      timer.changedAt = Date.now();
    },

    /** Sets the timer's total length directly — redefines both the color/% baseline and remaining time. */
    setDuration(code: string, id: string, durationSec: number) {
      const room = ensureRoom(code);
      const timer = findTimer(room, id);
      if (!timer || durationSec <= 0) return;
      timer.durationSec = durationSec;
      timer.remainingAtChange = durationSec;
      timer.changedAt = Date.now();
    },

    /** Sets the timer's length so it hits zero at the given wall-clock time. */
    setFinishTime(code: string, id: string, finishAt: number) {
      const room = ensureRoom(code);
      const timer = findTimer(room, id);
      if (!timer) return;
      const durationSec = Math.max(1, Math.round((finishAt - Date.now()) / 1000));
      timer.durationSec = durationSec;
      timer.remainingAtChange = durationSec;
      timer.changedAt = Date.now();
    },

    /** Links this timer to auto-start `nextId` (or clears the link if nextId is null). */
    setLink(code: string, id: string, nextId: string | null) {
      const room = ensureRoom(code);
      const timer = findTimer(room, id);
      if (!timer) return;
      if (nextId === null) {
        timer.linkedNextId = null;
        return;
      }
      if (nextId === id) return;
      if (!findTimer(room, nextId)) return;
      if (wouldCreateCycle(room, id, nextId)) return;
      timer.linkedNextId = nextId;
    },

    setFlag(code: string, message: string) {
      const room = ensureRoom(code);
      const trimmed = message.trim();
      if (!trimmed) return;
      room.flag = { message: trimmed, sentAt: Date.now() };
    },

    clearFlag(code: string) {
      const room = ensureRoom(code);
      room.flag = null;
    },
  };
}

export type RoomStore = ReturnType<typeof createRoomStore>;
