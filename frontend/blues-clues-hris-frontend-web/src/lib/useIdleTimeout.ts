// src/lib/useIdleTimeout.ts
// Calls onIdle() after IDLE_TIMEOUT_MS of no user activity.
// To revert: delete this file and remove useIdleTimeout() from (dashboard)/layout.tsx.

import { useEffect, useRef, useCallback } from "react";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
] as const;

export function useIdleTimeout(onIdle: () => void, enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onIdle, IDLE_TIMEOUT_MS);
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) return;

    ACTIVITY_EVENTS.forEach((e) =>
      globalThis.addEventListener(e, reset, { passive: true })
    );
    reset(); // start the timer immediately on mount

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((e) => globalThis.removeEventListener(e, reset));
    };
  }, [enabled, reset]);
}
