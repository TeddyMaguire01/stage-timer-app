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
        <h1 className="font-mono text-4xl font-bold tracking-tight text-stone-50">Stage Timer</h1>
        <p className="mt-2 text-stone-400">Real-time countdowns for live events</p>
      </div>

      <div className="w-full max-w-sm rounded-md border border-stone-800 bg-stone-900 p-6">
        <button
          onClick={createRoom}
          className="w-full rounded-md bg-gradient-to-r from-brand-pink to-brand-purple px-4 py-3 font-semibold text-white transition hover:opacity-90"
        >
          Create a new room
        </button>

        <div className="my-6 flex items-center gap-3 text-stone-600">
          <div className="h-px flex-1 bg-stone-800" />
          <span className="text-xs uppercase tracking-widest">or view a room</span>
          <div className="h-px flex-1 bg-stone-800" />
        </div>

        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            placeholder="Room code"
            maxLength={6}
            className="flex-1 rounded-md border border-stone-700 bg-stone-950 px-3 py-2 font-mono uppercase tracking-widest text-stone-50 outline-none focus:border-brand-pink"
          />
          <button
            onClick={joinRoom}
            className="rounded-md border border-stone-700 px-4 py-2 text-stone-50 hover:border-brand-pink"
          >
            View
          </button>
        </div>
      </div>
    </main>
  );
}
