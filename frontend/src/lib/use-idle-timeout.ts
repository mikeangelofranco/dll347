"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { logoutCurrentSession } from "@/lib/api";

export function useIdleTimeout(timeoutMs: number = 5 * 60 * 1000) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          await logoutCurrentSession();
        } finally {
          router.replace("/");
        }
      }, timeoutMs);
    }

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [timeoutMs, router]);
}
