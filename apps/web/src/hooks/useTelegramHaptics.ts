"use client";

import { useCallback } from "react";
import {
  hapticFeedbackImpactOccurred,
  hapticFeedbackNotificationOccurred,
  hapticFeedbackSelectionChanged,
} from "@telegram-apps/sdk-react";

type Impact = "light" | "medium" | "heavy" | "rigid" | "soft";
type Notif = "success" | "warning" | "error";

export function useTelegramHaptics() {
  const impact = useCallback((style: Impact = "light") => {
    try {
      hapticFeedbackImpactOccurred(style);
    } catch {
      // outside Telegram
    }
  }, []);
  const notify = useCallback((kind: Notif) => {
    try {
      hapticFeedbackNotificationOccurred(kind);
    } catch {
      // ignore
    }
  }, []);
  const selection = useCallback(() => {
    try {
      hapticFeedbackSelectionChanged();
    } catch {
      // ignore
    }
  }, []);
  return { impact, notify, selection };
}
