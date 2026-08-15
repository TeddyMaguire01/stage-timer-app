"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export default function HomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");

  const createRoom = () => {
    router.push(`/room/${generateCode()}/controller`);
  };

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    router.push(`/room/${code}/display`);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-10 px-6">
      <div className="text-center">
        <h1 className="font-mono text-4xl font-bold tracking-tight text-white">Stage Timer</h1>
        <p className="mt-2 text-neutral-400">Real-time countdowns for live events</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <button
          onClick={createRoom}
          className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-black transition hover:bg-emerald-400"
        >
          Create a new room
        </button>

        <div className="my-6 flex items-center gap-3 text-neutral-600">
          <div className="h-px flex-1 bg-neutral-800" />
          <span className="text-xs uppercase tracking-widest">or view a room</span>
          <div className="h-px flex-1 bg-neutral-800" />
        </div>

        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            placeholder="Room code"
            maxLength={6}
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono uppercase tracking-widest text-white outline-none focus:border-emerald-500"
          />
          <button
            onClick={joinRoom}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-white hover:border-emerald-500"
          >
            View
          </button>
        </div>
      </div>
    </main>
  );
}
