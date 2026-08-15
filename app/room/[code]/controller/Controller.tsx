"use client";

import { useMemo, useState } from "react";
import { useRoomSocket } from "@/lib/socketClient";
import { useTick } from "@/lib/useTick";
import { formatClock, remainingSeconds } from "@/lib/timerMath";
import type { TimerState } from "@/types/room";

export default function Controller({ code }: { code: string }) {
  const { state, connected, socket, clockOffsetRef } = useRoomSocket(code);
  useTick(200);

  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);
  const [flagText, setFlagText] = useState("");

  const displayUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/room/${code}/display`;
  }, [code]);

  const addTimer = () => {
    const durationSec = Math.max(1, minutes * 60 + seconds);
    socket.current?.emit("timer:create", { code, name: name.trim() || "Timer", durationSec });
    setName("");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
    } catch {
      // clipboard unavailable (e.g. insecure context) — user can still select the text field
    }
  };

  const sendFlag = () => {
    if (!flagText.trim()) return;
    socket.current?.emit("flag:send", { code, message: flagText });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-neutral-500">Room</div>
          <div className="font-mono text-3xl font-bold">{code}</div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`} />
          <span className="text-sm text-neutral-400">{connected ? "Connected" : "Disconnected"}</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            readOnly
            value={displayUrl}
            onFocus={(e) => e.target.select()}
            className="w-56 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-2 text-xs text-neutral-400"
          />
          <button
            onClick={copyLink}
            className="rounded-lg border border-neutral-700 px-3 py-2 text-sm hover:border-emerald-500"
          >
            Copy display link
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-neutral-500">Add timer</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTimer()}
              placeholder="e.g. Keynote"
              className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Minutes</label>
            <input
              type="number"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, Number(e.target.value)))}
              className="w-20 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-white outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Seconds</label>
            <input
              type="number"
              min={0}
              max={59}
              value={seconds}
              onChange={(e) => setSeconds(Math.min(59, Math.max(0, Number(e.target.value))))}
              className="w-20 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-white outline-none focus:border-emerald-500"
            />
          </div>
          <button
            onClick={addTimer}
            className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-black hover:bg-emerald-400"
          >
            Add
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500">Timers</h2>
        {state?.timers.length ? (
          state.timers.map((timer) => (
            <TimerRow
              key={timer.id}
              timer={timer}
              isActive={state.activeTimerId === timer.id}
              clockOffset={clockOffsetRef.current}
              onSelect={() => socket.current?.emit("timer:select", { code, id: timer.id })}
              onStart={() => socket.current?.emit("timer:start", { code, id: timer.id })}
              onPause={() => socket.current?.emit("timer:pause", { code, id: timer.id })}
              onReset={() => socket.current?.emit("timer:reset", { code, id: timer.id })}
              onAdjust={(delta) => socket.current?.emit("timer:adjust", { code, id: timer.id, deltaSec: delta })}
              onDelete={() => socket.current?.emit("timer:delete", { code, id: timer.id })}
            />
          ))
        ) : (
          <p className="text-sm text-neutral-500">No timers yet. Add one above.</p>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-neutral-500">Flag message</h2>
        <div className="flex gap-2">
          <input
            value={flagText}
            onChange={(e) => setFlagText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendFlag()}
            placeholder="e.g. Wrap it up"
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-amber-400"
          />
          <button
            onClick={sendFlag}
            className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black hover:bg-amber-300"
          >
            Send
          </button>
          <button
            onClick={() => socket.current?.emit("flag:clear", { code })}
            className="rounded-lg border border-neutral-700 px-4 py-2 hover:border-red-500"
          >
            Clear
          </button>
        </div>
        {state?.flag && (
          <p className="mt-3 text-sm text-amber-300">Live on display: &ldquo;{state.flag.message}&rdquo;</p>
        )}
      </section>
    </main>
  );
}

function TimerRow({
  timer,
  isActive,
  clockOffset,
  onSelect,
  onStart,
  onPause,
  onReset,
  onAdjust,
  onDelete,
}: {
  timer: TimerState;
  isActive: boolean;
  clockOffset: number;
  onSelect: () => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onAdjust: (deltaSec: number) => void;
  onDelete: () => void;
}) {
  const remaining = remainingSeconds(timer, clockOffset);
  const isOvertime = remaining < 0;

  return (
    <div
      className={`rounded-xl border p-4 ${
        isActive ? "border-emerald-500 bg-neutral-900" : "border-neutral-800 bg-neutral-950"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onSelect}
            title="Show on display"
            className={`h-4 w-4 shrink-0 rounded-full border ${
              isActive ? "border-emerald-500 bg-emerald-500" : "border-neutral-600"
            }`}
          />
          <div>
            <div className="font-medium">{timer.name}</div>
            <div className="text-xs uppercase tracking-widest text-neutral-500">{timer.status}</div>
          </div>
        </div>
        <div className={`font-mono text-2xl tabular-nums ${isOvertime ? "text-red-500" : "text-white"}`}>
          {formatClock(remaining)}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {timer.status === "running" ? (
          <button
            onClick={onPause}
            className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-semibold text-black hover:bg-amber-300"
          >
            Pause
          </button>
        ) : (
          <button
            onClick={onStart}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Start
          </button>
        )}
        <button onClick={onReset} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:border-white">
          Reset
        </button>
        <button onClick={() => onAdjust(-60)} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:border-white">
          -1m
        </button>
        <button onClick={() => onAdjust(-10)} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:border-white">
          -10s
        </button>
        <button onClick={() => onAdjust(10)} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:border-white">
          +10s
        </button>
        <button onClick={() => onAdjust(60)} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:border-white">
          +1m
        </button>
        <button
          onClick={onDelete}
          className="ml-auto rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-500 hover:border-red-500 hover:text-red-400"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
