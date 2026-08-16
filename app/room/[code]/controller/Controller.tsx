"use client";

import { useEffect, useMemo, useState } from "react";
import { useRoomSocket } from "@/lib/socketClient";
import { useTick } from "@/lib/useTick";
import {
  currentHHMM,
  finishTimeMs,
  formatClock,
  formatTimeOfDay,
  nextOccurrenceOfTime,
  remainingSeconds,
} from "@/lib/timerMath";
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
  const [startTimeInput, setStartTimeInput] = useState("");
  const [startTimeTouched, setStartTimeTouched] = useState(false);
  const [finishTimeInput, setFinishTimeInput] = useState("");
  const [flagText, setFlagText] = useState("");
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // Date.now()-derived text must not render until after hydration, or the
  // server-rendered timestamp (moments earlier) mismatches the client's.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setStartTimeInput(currentHHMM(offset));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/room/${code}/display`;
  }, [code]);

  const timers = state?.timers ?? [];
  const focusedTimer =
    timers.find((t) => t.id === focusedId) ?? timers.find((t) => t.id === state?.activeTimerId) ?? timers[0] ?? null;

  // A touched Start field arms a real scheduled auto-start; left alone, the
  // timer is just created idle as usual (operator presses Start manually).
  const scheduledStartAt = startTimeTouched ? nextOccurrenceOfTime(startTimeInput, offset) : null;

  const addPreview = (() => {
    if (!mounted) return "";
    if (mode === "duration") {
      const durationSec = Math.max(0, minutes * 60 + seconds);
      if (durationSec <= 0) return "";
      const startAt = scheduledStartAt ?? Date.now() + offset;
      const endsAt = formatTimeOfDay(startAt + durationSec * 1000);
      return scheduledStartAt
        ? `Starts at ${formatTimeOfDay(scheduledStartAt)} · Ends at ${endsAt}`
        : `Finishes at ${endsAt}`;
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
    socket.current?.emit("timer:create", {
      code,
      name: name.trim() || "Timer",
      durationSec,
      scheduledStartAt: mode === "duration" ? scheduledStartAt : null,
    });
    setName("");
    setStartTimeTouched(false);
    setStartTimeInput(currentHHMM(offset));
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
          <div className="text-xs uppercase tracking-widest text-stone-500">Room</div>
          <div className="font-mono text-3xl font-bold">{code}</div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-brand-pink" : "bg-red-500"}`} />
          <span className="text-sm text-stone-400">{connected ? "Connected" : "Disconnected"}</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            readOnly
            value={displayUrl}
            onFocus={(e) => e.target.select()}
            className="w-56 rounded-md border border-stone-700 bg-stone-950 px-2 py-2 text-xs text-stone-400"
          />
          <button
            onClick={copyLink}
            className="rounded-md border border-stone-700 px-3 py-2 text-sm hover:border-brand-pink"
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
          <section className="rounded-md border border-stone-800 bg-stone-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500">Add timer</h2>
              <ModeToggle mode={mode} onChange={setMode} />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-stone-500">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTimer()}
                  placeholder="e.g. Keynote"
                  className="rounded-md border border-stone-700 bg-stone-950 px-3 py-2 text-stone-50 outline-none focus:border-brand-pink"
                />
              </div>

              {mode === "duration" ? (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-stone-500">Start</label>
                    <input
                      type="time"
                      value={startTimeInput}
                      onChange={(e) => {
                        setStartTimeInput(e.target.value);
                        setStartTimeTouched(true);
                      }}
                      className="rounded-md border border-stone-700 bg-stone-950 px-3 py-2 font-mono text-stone-50 outline-none focus:border-brand-pink"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-stone-500">Minutes</label>
                    <input
                      type="number"
                      min={0}
                      value={minutes}
                      onChange={(e) => setMinutes(Math.max(0, Number(e.target.value)))}
                      className="w-20 rounded-md border border-stone-700 bg-stone-950 px-3 py-2 font-mono text-stone-50 outline-none focus:border-brand-pink"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-stone-500">Seconds</label>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={seconds}
                      onChange={(e) => setSeconds(Math.min(59, Math.max(0, Number(e.target.value))))}
                      className="w-20 rounded-md border border-stone-700 bg-stone-950 px-3 py-2 font-mono text-stone-50 outline-none focus:border-brand-pink"
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-stone-500">Finish time</label>
                  <input
                    type="time"
                    value={finishTimeInput}
                    onChange={(e) => setFinishTimeInput(e.target.value)}
                    className="rounded-md border border-stone-700 bg-stone-950 px-3 py-2 font-mono text-stone-50 outline-none focus:border-brand-pink"
                  />
                </div>
              )}

              <button
                onClick={addTimer}
                className="rounded-md bg-brand-pink px-4 py-2 font-semibold text-white hover:bg-brand-pink-hover"
              >
                Add
              </button>

              {addPreview && <span className="pb-2 text-sm text-stone-500">{addPreview}</span>}
            </div>
          </section>

          <section className="rounded-md border border-stone-800 bg-stone-900 p-5 text-center">
            <div className="text-xs uppercase tracking-widest text-stone-500">Current time</div>
            <div className="font-mono text-2xl text-stone-300">
              {mounted ? formatTimeOfDay(Date.now() + offset) : "--:--:--"}
            </div>
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
              onSchedule={(startAt) => socket.current?.emit("timer:schedule", { code, id: focusedTimer.id, startAt })}
            />
          ) : (
            <section className="rounded-md border border-stone-800 bg-stone-900 p-8 text-center text-sm text-stone-500">
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
    <div className="flex overflow-hidden rounded-md border border-stone-700 text-xs">
      <button
        onClick={() => onChange("duration")}
        className={`px-3 py-1.5 ${mode === "duration" ? "bg-brand-pink text-white" : "text-stone-400 hover:text-stone-50"}`}
      >
        Duration
      </button>
      <button
        onClick={() => onChange("finish")}
        className={`px-3 py-1.5 ${mode === "finish" ? "bg-brand-pink text-white" : "text-stone-400 hover:text-stone-50"}`}
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
    <section className="flex flex-col gap-2 rounded-md border border-stone-800 bg-stone-900 p-3 lg:h-fit">
      <h2 className="px-1 pb-1 text-sm font-semibold uppercase tracking-widest text-stone-500">Queue</h2>
      {timers.length === 0 && <p className="px-1 text-sm text-stone-500">No timers yet.</p>}
      {timers.map((timer) => {
        const remaining = remainingSeconds(timer, offset);
        const isFocused = timer.id === focusedId;
        const isOnDisplay = timer.id === activeId;
        return (
          <button
            key={timer.id}
            onClick={() => onFocus(timer.id)}
            className={`flex items-center gap-2 rounded-md border px-2 py-2 text-left ${
              isFocused ? "border-brand-pink bg-stone-800" : "border-transparent hover:bg-stone-800"
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
                isOnDisplay ? "border-brand-pink bg-brand-pink" : "border-stone-600"
              }`}
            />
            <span className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{timer.name}</div>
              <div className="text-xs uppercase tracking-widest text-stone-500">
                {timer.status === "idle" && timer.scheduledStartAt ? "scheduled" : timer.status}
              </div>
            </span>
            <span className="text-right">
              {timer.status === "idle" && timer.scheduledStartAt ? (
                <>
                  <div className="font-mono text-sm tabular-nums text-brand-purple">
                    {formatTimeOfDay(timer.scheduledStartAt)}
                  </div>
                  <div className="font-mono text-[10px] text-stone-500">
                    {formatTimeOfDay(timer.scheduledStartAt + timer.durationSec * 1000)}
                  </div>
                </>
              ) : (
                <>
                  <div className={`font-mono text-sm tabular-nums ${remaining < 0 ? "text-red-500" : "text-stone-300"}`}>
                    {formatClock(remaining)}
                  </div>
                  <div className="font-mono text-[10px] text-stone-500">{formatTimeOfDay(finishTimeMs(timer, offset))}</div>
                </>
              )}
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
      className="w-full accent-brand-pink"
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
  onSchedule,
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
  onSchedule: (startAt: number | null) => void;
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
    <section className="rounded-md border border-stone-800 bg-stone-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onShowOnDisplay}
            title="Show on display"
            className={`h-4 w-4 shrink-0 rounded-full border ${
              isOnDisplay ? "border-brand-pink bg-brand-pink" : "border-stone-600"
            }`}
          />
          <div>
            <div className="text-lg font-medium">{timer.name}</div>
            <div className="text-xs uppercase tracking-widest text-stone-500">{timer.status}</div>
          </div>
        </div>
        <div className="flex items-baseline gap-6">
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-stone-500">Remaining</div>
            <div className={`font-mono text-4xl tabular-nums ${isOvertime ? "text-red-500" : "text-stone-50"}`}>
              {formatClock(remaining)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-stone-500">Ends at</div>
            <div className="font-mono text-2xl tabular-nums text-stone-300">
              {formatTimeOfDay(finishTimeMs(timer, clockOffset))}
            </div>
          </div>
        </div>
      </div>

      {timer.status === "idle" && timer.scheduledStartAt && (
        <div className="mt-3 flex items-center justify-between rounded-md border border-brand-purple bg-stone-950 px-3 py-2 text-sm">
          <span className="text-brand-purple">
            Scheduled to auto-start at {formatTimeOfDay(timer.scheduledStartAt)}
          </span>
          <button onClick={() => onSchedule(null)} className="text-stone-400 hover:text-stone-50">
            Cancel
          </button>
        </div>
      )}

      <div className="mt-4">
        <Scrubber timer={timer} clockOffset={clockOffset} onSeek={onSeek} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {timer.status === "running" ? (
          <button
            onClick={onPause}
            className="rounded-md bg-amber-400 px-3 py-1.5 text-sm font-semibold text-black hover:bg-amber-300"
          >
            Pause
          </button>
        ) : (
          <button
            onClick={onStart}
            className="rounded-md bg-brand-pink px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-pink-hover"
          >
            Start
          </button>
        )}
        <button onClick={onReset} className="rounded-md border border-stone-700 px-3 py-1.5 text-sm hover:border-stone-50">
          Reset
        </button>
        <button onClick={() => onAdjust(-60)} className="rounded-md border border-stone-700 px-3 py-1.5 text-sm hover:border-stone-50">
          -1m
        </button>
        <button onClick={() => onAdjust(-10)} className="rounded-md border border-stone-700 px-3 py-1.5 text-sm hover:border-stone-50">
          -10s
        </button>
        <button onClick={() => onAdjust(10)} className="rounded-md border border-stone-700 px-3 py-1.5 text-sm hover:border-stone-50">
          +10s
        </button>
        <button onClick={() => onAdjust(60)} className="rounded-md border border-stone-700 px-3 py-1.5 text-sm hover:border-stone-50">
          +1m
        </button>
        <button
          onClick={editOpen ? () => setEditOpen(false) : openEdit}
          className="rounded-md border border-stone-700 px-3 py-1.5 text-sm hover:border-stone-50"
        >
          {editOpen ? "Close" : "Edit"}
        </button>
        <button
          onClick={onDelete}
          className="ml-auto rounded-md border border-stone-800 px-3 py-1.5 text-sm text-stone-500 hover:border-red-500 hover:text-red-400"
        >
          Delete
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-800 pt-3">
        <span className="text-xs text-stone-500">Custom:</span>
        <input
          type="number"
          min={1}
          value={customAmount}
          onChange={(e) => setCustomAmount(Math.max(1, Number(e.target.value)))}
          className="w-16 rounded-md border border-stone-700 bg-stone-950 px-2 py-1 font-mono text-sm text-stone-50 outline-none focus:border-brand-pink"
        />
        <select
          value={customUnit}
          onChange={(e) => setCustomUnit(e.target.value as "sec" | "min")}
          className="rounded-md border border-stone-700 bg-stone-950 px-2 py-1 text-sm text-stone-50 outline-none focus:border-brand-pink"
        >
          <option value="sec">sec</option>
          <option value="min">min</option>
        </select>
        <button onClick={() => onAdjust(-customSeconds)} className="rounded-md border border-stone-700 px-3 py-1 text-sm hover:border-stone-50">
          −
        </button>
        <button onClick={() => onAdjust(customSeconds)} className="rounded-md border border-stone-700 px-3 py-1 text-sm hover:border-stone-50">
          +
        </button>

        <span className="ml-4 text-xs text-stone-500">Then start:</span>
        <select
          value={timer.linkedNextId ?? ""}
          onChange={(e) => onLink(e.target.value || null)}
          className="rounded-md border border-stone-700 bg-stone-950 px-2 py-1 text-sm text-stone-50 outline-none focus:border-brand-pink"
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
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-stone-800 bg-stone-950 p-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-stone-500">Name</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="rounded-md border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-50 outline-none focus:border-brand-pink"
            />
          </div>

          <ModeToggle mode={editMode} onChange={setEditMode} />

          {editMode === "duration" ? (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-stone-500">Minutes</label>
                <input
                  type="number"
                  min={0}
                  value={editMinutes}
                  onChange={(e) => setEditMinutes(Math.max(0, Number(e.target.value)))}
                  className="w-20 rounded-md border border-stone-700 bg-stone-900 px-3 py-2 font-mono text-sm text-stone-50 outline-none focus:border-brand-pink"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-stone-500">Seconds</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={editSeconds}
                  onChange={(e) => setEditSeconds(Math.min(59, Math.max(0, Number(e.target.value))))}
                  className="w-20 rounded-md border border-stone-700 bg-stone-900 px-3 py-2 font-mono text-sm text-stone-50 outline-none focus:border-brand-pink"
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-stone-500">Finish time</label>
              <input
                type="time"
                value={editFinishTimeInput}
                onChange={(e) => setEditFinishTimeInput(e.target.value)}
                className="rounded-md border border-stone-700 bg-stone-900 px-3 py-2 font-mono text-sm text-stone-50 outline-none focus:border-brand-pink"
              />
            </div>
          )}

          <button
            onClick={applyEdit}
            className="rounded-md bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pink-hover"
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
    <section className="flex flex-col gap-3 rounded-md border border-stone-800 bg-stone-900 p-4 lg:h-fit">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500">Messages</h2>
      <textarea
        value={flagText}
        onChange={(e) => onFlagTextChange(e.target.value)}
        placeholder="e.g. Wrap it up"
        rows={3}
        className="resize-none rounded-md border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-50 outline-none focus:border-amber-400"
      />
      <div className="flex gap-2">
        <button
          onClick={onSend}
          className="flex-1 rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300"
        >
          Send
        </button>
        <button
          onClick={onClear}
          className="rounded-md border border-stone-700 px-4 py-2 text-sm hover:border-red-500"
        >
          Clear
        </button>
      </div>
      {flag && <p className="text-sm text-amber-300">Live on display: &ldquo;{flag.message}&rdquo;</p>}
    </section>
  );
}
