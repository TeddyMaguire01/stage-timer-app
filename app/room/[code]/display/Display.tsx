"use client";

import { useRoomSocket } from "@/lib/socketClient";
import { useTick } from "@/lib/useTick";
import { formatClock, remainingSeconds } from "@/lib/timerMath";

export default function Display({ code }: { code: string }) {
  const { state, connected, clockOffsetRef } = useRoomSocket(code);
  useTick(100);

  const activeTimer = state?.timers.find((t) => t.id === state.activeTimerId) ?? null;
  const remaining = activeTimer ? remainingSeconds(activeTimer, clockOffsetRef.current) : 0;
  const percentRemaining = activeTimer && activeTimer.durationSec > 0 ? remaining / activeTimer.durationSec : 0;
  const isOvertime = remaining < 0;

  const colorClass = isOvertime
    ? "text-white"
    : percentRemaining > 0.5
    ? "text-timer-green"
    : percentRemaining > 0.2
    ? "text-timer-amber"
    : "text-timer-red";

  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-center gap-8 ${
        isOvertime ? "animate-flash" : "bg-black"
      }`}
    >
      {!connected && <div className="text-sm text-stone-500">Connecting…</div>}
      {connected && !activeTimer && <div className="text-xl text-stone-500">Waiting for timer…</div>}

      {activeTimer && (
        <>
          <div className="text-2xl text-stone-400">{activeTimer.name}</div>
          <div className={`font-mono text-[18vw] font-bold leading-none tabular-nums ${colorClass}`}>
            {formatClock(remaining)}
          </div>
          {isOvertime && (
            <div className="font-mono text-3xl tracking-widest text-red-400">OVERTIME</div>
          )}
        </>
      )}

      {state?.flag && (
        <div className="fixed inset-x-0 bottom-0 bg-amber-400 px-4 py-6 text-center text-3xl font-semibold text-black">
          {state.flag.message}
        </div>
      )}
    </main>
  );
}
