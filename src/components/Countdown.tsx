"use client";

import { useEffect, useState } from "react";

export function useSecondsLeft(until: string | null) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!until) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(until).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);

  return until ? left : null;
}

export function formatClock(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
