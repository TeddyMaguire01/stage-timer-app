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
function currentRemaining(timer: TimerState): number {
  if (timer.status === "running") {
    const elapsedSec = (Date.now() - timer.changedAt) / 1000;
    return timer.remainingAtChange - elapsedSec;
  }
  return timer.remainingAtChange;
}

export function createRoomStore() {
  return {
    getState(code: string): RoomState {
      return ensureRoom(code);
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
      };
      room.timers.push(timer);
      if (!room.activeTimerId) room.activeTimerId = timer.id;
    },

    deleteTimer(code: string, id: string) {
      const room = ensureRoom(code);
      room.timers = room.timers.filter((t) => t.id !== id);
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
