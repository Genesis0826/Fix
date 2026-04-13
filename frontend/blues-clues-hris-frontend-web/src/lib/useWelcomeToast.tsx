"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { PartyPopper } from "lucide-react";

const WELCOME_KEY = "welcome_shown";

/**
 * Shows a personalized welcome toast once per session.
 * Uses sessionStorage to prevent duplicate toasts when a page re-renders
 * or when name is set asynchronously after initial mount.
 */
export function useWelcomeToast(name: string, subtitle: string) {
  useEffect(() => {
    if (!name) return;
    if (sessionStorage.getItem(WELCOME_KEY) === "1") return;

    const timer = setTimeout(() => {
      sessionStorage.setItem(WELCOME_KEY, "1");
      toast.custom(
        () => (
          <div className="flex items-start gap-3 w-80 bg-card border border-border rounded-2xl shadow-2xl px-4 pt-4 pb-5">
            <div className="bg-primary/10 p-2 rounded-xl shrink-0 mt-0.5">
              <PartyPopper className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground leading-snug">
                Welcome back, {name}!
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">
                {subtitle}
              </p>
            </div>
          </div>
        ),
        { duration: 4000 }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [name, subtitle]);
}
