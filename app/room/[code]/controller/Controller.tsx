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
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const displayUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/room/${code}/display`;
  }, [code]);

  const timers = state?.timers ?? [];
  const focusedTimer =
    timers.find((t) => t.id === focusedId) ?? timers.find((t) => t.id === state?.activeTimerId) ?? timers[0] ?? null;

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

  return (
    <main className="min-h-screen px-4 py-6">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
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

      <div className="mx-auto mt-6 grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[240px_1fr_280px]">
        <QueueColumn
          timers={timers}
          focusedId={focusedTimer?.id ?? null}
          activeId={state?.activeTimerId ?? null}
          offset={offset}
          onFocus={setFocusedId}
          onShowOnDisplay={(id) => socket.current?.emit("timer:select", { code, id })}
        />

        <div className="flex flex-col gap-6">
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

          <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 text-center">
            <div className="text-xs uppercase tracking-widest text-neutral-500">Current time</div>
            <div className="font-mono text-2xl text-neutral-300">{formatTimeOfDay(Date.now() + offset)}</div>
          </section>

          {focusedTimer ? (
            <FocusedTimerPanel
              key={focusedTimer.id}
              timer={focusedTimer}
              isOnDisplay={state?.activeTimerId === focusedTimer.id}
              clockOffset={offset}
              allTimers={timers}
              onShowOnDisplay={() => socket.current?.emit("timer:select", { code, id: focusedTimer.id })}
              onStart={() => socket.current?.emit("timer:start", { code, id: focusedTimer.id })}
              onPause={() => socket.current?.emit("timer:pause", { code, id: focusedTimer.id })}
              onReset={() => socket.current?.emit("timer:reset", { code, id: focusedTimer.id })}
              onAdjust={(delta) => socket.current?.emit("timer:adjust", { code, id: focusedTimer.id, deltaSec: delta })}
              onDelete={() => {
                socket.current?.emit("timer:delete", { code, id: focusedTimer.id });
                setFocusedId(null);
              }}
              onRename={(newName) => socket.current?.emit("timer:rename", { code, id: focusedTimer.id, name: newName })}
              onSetDuration={(durationSec) =>
                socket.current?.emit("timer:setDuration", { code, id: focusedTimer.id, durationSec })
              }
              onSetFinishTime={(finishAt) =>
                socket.current?.emit("timer:setFinishTime", { code, id: focusedTimer.id, finishAt })
              }
              onLink={(nextId) => socket.current?.emit("timer:link", { code, id: focusedTimer.id, nextId })}
              onSeek={(remainingSec) =>
                socket.current?.emit("timer:seek", { code, id: focusedTimer.id, remainingSec })
              }
            />
          ) : (
            <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8 text-center text-sm text-neutral-500">
              No timers yet. Add one above.
            </section>
          )}
        </div>

        <MessagesColumn
          flag={state?.flag ?? null}
          flagText={flagText}
          onFlagTextChange={setFlagText}
          onSend={sendFlag}
          onClear={() => socket.current?.emit("flag:clear", { code })}
        />
      </div>
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

function QueueColumn({
  timers,
  focusedId,
  activeId,
  offset,
  onFocus,
  onShowOnDisplay,
}: {
  timers: TimerState[];
  focusedId: string | null;
  activeId: string | null;
  offset: number;
  onFocus: (id: string) => void;
  onShowOnDisplay: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 p-3 lg:h-fit">
      <h2 className="px-1 pb-1 text-sm font-semibold uppercase tracking-widest text-neutral-500">Queue</h2>
      {timers.length === 0 && <p className="px-1 text-sm text-neutral-500">No timers yet.</p>}
      {timers.map((timer) => {
        const remaining = remainingSeconds(timer, offset);
        const isFocused = timer.id === focusedId;
        const isOnDisplay = timer.id === activeId;
        return (
          <button
            key={timer.id}
            onClick={() => onFocus(timer.id)}
            className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left ${
              isFocused ? "border-emerald-500 bg-neutral-800" : "border-transparent hover:bg-neutral-800"
            }`}
          >
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onShowOnDisplay(timer.id);
              }}
              title="Show on display"
              className={`h-3 w-3 shrink-0 rounded-full border ${
                isOnDisplay ? "border-emerald-500 bg-emerald-500" : "border-neutral-600"
              }`}
            />
            <span className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{timer.name}</div>
              <div className="text-xs uppercase tracking-widest text-neutral-500">{timer.status}</div>
            </span>
            <span className={`font-mono text-sm tabular-nums ${remaining < 0 ? "text-red-500" : "text-neutral-300"}`}>
              {formatClock(remaining)}
            </span>
          </button>
        );
      })}
    </section>
  );
}

function Scrubber({
  timer,
  clockOffset,
  onSeek,
}: {
  timer: TimerState;
  clockOffset: number;
  onSeek: (remainingSec: number) => void;
}) {
  const [dragRemaining, setDragRemaining] = useState<number | null>(null);
  const liveRemaining = remainingSeconds(timer, clockOffset);
  const clampedLive = Math.max(0, Math.min(timer.durationSec, liveRemaining));
  const displayRemaining = dragRemaining ?? clampedLive;
  const elapsed = Math.round(timer.durationSec - displayRemaining);

  const commit = () => {
    if (dragRemaining !== null) {
      onSeek(dragRemaining);
      setDragRemaining(null);
    }
  };

  return (
    <input
      type="range"
      min={0}
      max={Math.max(1, timer.durationSec)}
      step={1}
      value={elapsed}
      onChange={(e) => setDragRemaining(timer.durationSec - Number(e.target.value))}
      onMouseUp={commit}
      onTouchEnd={commit}
      onKeyUp={commit}
      onBlur={commit}
      className="w-full accent-emerald-500"
      title="Drag to jump the countdown"
    />
  );
}

function FocusedTimerPanel({
  timer,
  isOnDisplay,
  clockOffset,
  allTimers,
  onShowOnDisplay,
  onStart,
  onPause,
  onReset,
  onAdjust,
  onDelete,
  onRename,
  onSetDuration,
  onSetFinishTime,
  onLink,
  onSeek,
}: {
  timer: TimerState;
  isOnDisplay: boolean;
  clockOffset: number;
  allTimers: TimerState[];
  onShowOnDisplay: () => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onAdjust: (deltaSec: number) => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onSetDuration: (durationSec: number) => void;
  onSetFinishTime: (finishAt: number) => void;
  onLink: (nextId: string | null) => void;
  onSeek: (remainingSec: number) => void;
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
      onSetDuration(Math.max(1, editMinutes * 60 + editSeconds));
    } else {
      const finishAt = nextOccurrenceOfTime(editFinishTimeInput, clockOffset);
      if (finishAt) onSetFinishTime(finishAt);
    }
    setEditOpen(false);
  };

  const customSeconds = customUnit === "min" ? customAmount * 60 : customAmount;
  const linkOptions = allTimers.filter((t) => t.id !== timer.id);

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onShowOnDisplay}
            title="Show on display"
            className={`h-4 w-4 shrink-0 rounded-full border ${
              isOnDisplay ? "border-emerald-500 bg-emerald-500" : "border-neutral-600"
            }`}
          />
          <div>
            <div className="text-lg font-medium">{timer.name}</div>
            <div className="text-xs uppercase tracking-widest text-neutral-500">{timer.status}</div>
          </div>
        </div>
        <div className="text-right">
          <div className={`font-mono text-4xl tabular-nums ${isOvertime ? "text-red-500" : "text-white"}`}>
            {formatClock(remaining)}
          </div>
          <div className="text-xs text-neutral-500">finishes {formatTimeOfDay(finishTimeMs(timer, clockOffset))}</div>
        </div>
      </div>

      <div className="mt-4">
        <Scrubber timer={timer} clockOffset={clockOffset} onSeek={onSeek} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
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

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-800 pt-3">
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
        <button onClick={() => onAdjust(-customSeconds)} className="rounded-lg border border-neutral-700 px-3 py-1 text-sm hover:border-white">
          −
        </button>
        <button onClick={() => onAdjust(customSeconds)} className="rounded-lg border border-neutral-700 px-3 py-1 text-sm hover:border-white">
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
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Name</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
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
                  className="w-20 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-sm text-white outline-none focus:border-emerald-500"
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
                  className="w-20 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-sm text-white outline-none focus:border-emerald-500"
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
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-sm text-white outline-none focus:border-emerald-500"
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
    </section>
  );
}

function MessagesColumn({
  flag,
  flagText,
  onFlagTextChange,
  onSend,
  onClear,
}: {
  flag: { message: string; sentAt: number } | null;
  flagText: string;
  onFlagTextChange: (text: string) => void;
  onSend: () => void;
  onClear: () => void;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 lg:h-fit">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500">Messages</h2>
      <textarea
        value={flagText}
        onChange={(e) => onFlagTextChange(e.target.value)}
        placeholder="e.g. Wrap it up"
        rows={3}
        className="resize-none rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
      />
      <div className="flex gap-2">
        <button
          onClick={onSend}
          className="flex-1 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300"
        >
          Send
        </button>
        <button
          onClick={onClear}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm hover:border-red-500"
        >
          Clear
        </button>
      </div>
      {flag && <p className="text-sm text-amber-300">Live on display: &ldquo;{flag.message}&rdquo;</p>}
    </section>
  );
}
