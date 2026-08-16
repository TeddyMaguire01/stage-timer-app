"use client";

import { useMemo, useState } from "react";
import { useRoomSocket } from "@/lib/socketClient";
import { useTick } from "@/lib/useTick";
import { finishTimeMs, formatClock, formatTimeOfDay, nextOccurrenceOfTime, remainingSeconds } from "@/lib/timerMath";
import type { TimerState } from "@/types/room";

type DurationMode = "duration" | "finish";

export default function Controller({ code }: { code: string }) {
  const { state, connected, socket, clockOffsetRef } = useRoomSocket(code);
  useTick(200);
  const offset = clockOffsetRef.current;

  const [name, setName] = useState("");
  const [mode, setMode] = useState<DurationMode>("duration");
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);
  const [finishTimeInput, setFinishTimeInput] = useState("");
  const [flagText, setFlagText] = useState("");

  const displayUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/room/${code}/display`;
  }, [code]);

  const addPreview = (() => {
    if (mode === "duration") {
      const durationSec = Math.max(0, minutes * 60 + seconds);
      if (durationSec <= 0) return "";
      return `Finishes at ${formatTimeOfDay(Date.now() + offset + durationSec * 1000)}`;
    }
    const finishAt = nextOccurrenceOfTime(finishTimeInput, offset);
    if (!finishAt) return "";
    const durationSec = Math.max(1, Math.round((finishAt - (Date.now() + offset)) / 1000));
    return `Runs for ${formatClock(durationSec)}`;
  })();

  const addTimer = () => {
    let durationSec: number;
    if (mode === "duration") {
      durationSec = Math.max(1, minutes * 60 + seconds);
    } else {
      const finishAt = nextOccurrenceOfTime(finishTimeInput, offset);
      if (!finishAt) return;
      durationSec = Math.max(1, Math.round((finishAt - (Date.now() + offset)) / 1000));
    }
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

  const allTimers = state?.timers ?? [];

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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500">Add timer</h2>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
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

          {mode === "duration" ? (
            <>
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
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500">Finish time</label>
              <input
                type="time"
                value={finishTimeInput}
                onChange={(e) => setFinishTimeInput(e.target.value)}
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-white outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <button
            onClick={addTimer}
            className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-black hover:bg-emerald-400"
          >
            Add
          </button>

          {addPreview && <span className="pb-2 text-sm text-neutral-500">{addPreview}</span>}
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
              clockOffset={offset}
              allTimers={allTimers}
              onSelect={() => socket.current?.emit("timer:select", { code, id: timer.id })}
              onStart={() => socket.current?.emit("timer:start", { code, id: timer.id })}
              onPause={() => socket.current?.emit("timer:pause", { code, id: timer.id })}
              onReset={() => socket.current?.emit("timer:reset", { code, id: timer.id })}
              onAdjust={(delta) => socket.current?.emit("timer:adjust", { code, id: timer.id, deltaSec: delta })}
              onDelete={() => socket.current?.emit("timer:delete", { code, id: timer.id })}
              onRename={(newName) => socket.current?.emit("timer:rename", { code, id: timer.id, name: newName })}
              onSetDuration={(durationSec) =>
                socket.current?.emit("timer:setDuration", { code, id: timer.id, durationSec })
              }
              onSetFinishTime={(finishAt) =>
                socket.current?.emit("timer:setFinishTime", { code, id: timer.id, finishAt })
              }
              onLink={(nextId) => socket.current?.emit("timer:link", { code, id: timer.id, nextId })}
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

function ModeToggle({ mode, onChange }: { mode: DurationMode; onChange: (mode: DurationMode) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-neutral-700 text-xs">
      <button
        onClick={() => onChange("duration")}
        className={`px-3 py-1.5 ${mode === "duration" ? "bg-emerald-500 text-black" : "text-neutral-400 hover:text-white"}`}
      >
        Duration
      </button>
      <button
        onClick={() => onChange("finish")}
        className={`px-3 py-1.5 ${mode === "finish" ? "bg-emerald-500 text-black" : "text-neutral-400 hover:text-white"}`}
      >
        Finish time
      </button>
    </div>
  );
}

function TimerRow({
  timer,
  isActive,
  clockOffset,
  allTimers,
  onSelect,
  onStart,
  onPause,
  onReset,
  onAdjust,
  onDelete,
  onRename,
  onSetDuration,
  onSetFinishTime,
  onLink,
}: {
  timer: TimerState;
  isActive: boolean;
  clockOffset: number;
  allTimers: TimerState[];
  onSelect: () => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onAdjust: (deltaSec: number) => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onSetDuration: (durationSec: number) => void;
  onSetFinishTime: (finishAt: number) => void;
  onLink: (nextId: string | null) => void;
}) {
  const remaining = remainingSeconds(timer, clockOffset);
  const isOvertime = remaining < 0;

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(timer.name);
  const [editMode, setEditMode] = useState<DurationMode>("duration");
  const [editMinutes, setEditMinutes] = useState(Math.floor(timer.durationSec / 60));
  const [editSeconds, setEditSeconds] = useState(timer.durationSec % 60);
  const [editFinishTimeInput, setEditFinishTimeInput] = useState("");

  const [customAmount, setCustomAmount] = useState(30);
  const [customUnit, setCustomUnit] = useState<"sec" | "min">("sec");

  const openEdit = () => {
    setEditName(timer.name);
    setEditMode("duration");
    setEditMinutes(Math.floor(timer.durationSec / 60));
    setEditSeconds(timer.durationSec % 60);
    setEditFinishTimeInput("");
    setEditOpen(true);
  };

  const applyEdit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== timer.name) onRename(trimmed);

    if (editMode === "duration") {
      const durationSec = Math.max(1, editMinutes * 60 + editSeconds);
      onSetDuration(durationSec);
    } else {
      const finishAt = nextOccurrenceOfTime(editFinishTimeInput, clockOffset);
      if (finishAt) onSetFinishTime(finishAt);
    }
    setEditOpen(false);
  };

  const customSeconds = customUnit === "min" ? customAmount * 60 : customAmount;
  const linkOptions = allTimers.filter((t) => t.id !== timer.id);

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
        <div className="text-right">
          <div className={`font-mono text-2xl tabular-nums ${isOvertime ? "text-red-500" : "text-white"}`}>
            {formatClock(remaining)}
          </div>
          <div className="text-xs text-neutral-500">finishes {formatTimeOfDay(finishTimeMs(timer, clockOffset))}</div>
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
          onClick={editOpen ? () => setEditOpen(false) : openEdit}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:border-white"
        >
          {editOpen ? "Close" : "Edit"}
        </button>
        <button
          onClick={onDelete}
          className="ml-auto rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-500 hover:border-red-500 hover:text-red-400"
        >
          Delete
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-neutral-800 pt-2">
        <span className="text-xs text-neutral-500">Custom:</span>
        <input
          type="number"
          min={1}
          value={customAmount}
          onChange={(e) => setCustomAmount(Math.max(1, Number(e.target.value)))}
          className="w-16 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-sm text-white outline-none focus:border-emerald-500"
        />
        <select
          value={customUnit}
          onChange={(e) => setCustomUnit(e.target.value as "sec" | "min")}
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-white outline-none focus:border-emerald-500"
        >
          <option value="sec">sec</option>
          <option value="min">min</option>
        </select>
        <button
          onClick={() => onAdjust(-customSeconds)}
          className="rounded-lg border border-neutral-700 px-3 py-1 text-sm hover:border-white"
        >
          −
        </button>
        <button
          onClick={() => onAdjust(customSeconds)}
          className="rounded-lg border border-neutral-700 px-3 py-1 text-sm hover:border-white"
        >
          +
        </button>

        <span className="ml-4 text-xs text-neutral-500">Then start:</span>
        <select
          value={timer.linkedNextId ?? ""}
          onChange={(e) => onLink(e.target.value || null)}
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-white outline-none focus:border-emerald-500"
        >
          <option value="">None</option>
          {linkOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {editOpen && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Name</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            />
          </div>

          <ModeToggle mode={editMode} onChange={setEditMode} />

          {editMode === "duration" ? (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500">Minutes</label>
                <input
                  type="number"
                  min={0}
                  value={editMinutes}
                  onChange={(e) => setEditMinutes(Math.max(0, Number(e.target.value)))}
                  className="w-20 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500">Seconds</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={editSeconds}
                  onChange={(e) => setEditSeconds(Math.min(59, Math.max(0, Number(e.target.value))))}
                  className="w-20 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500">Finish time</label>
              <input
                type="time"
                value={editFinishTimeInput}
                onChange={(e) => setEditFinishTimeInput(e.target.value)}
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <button
            onClick={applyEdit}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
