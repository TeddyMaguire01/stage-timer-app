"use client";

import { useEffect, useState } from "react";

/** Forces a re-render every `intervalMs` so live countdowns stay current. */
export function useTick(intervalMs = 200) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
