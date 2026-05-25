"use client";

import { useEffect } from "react";
import {
  expandViewport,
  isChangingFullscreen,
  isFullscreen,
  requestFullscreen,
  useSignal,
  viewportStableHeight,
} from "@telegram-apps/sdk-react";

export function ViewportBridge() {
  const height = useSignal(viewportStableHeight);
  const fullscreen = useSignal(isFullscreen);

  useEffect(() => {
    try {
      expandViewport();
    } catch {
      // not in Telegram
    }

    void (async () => {
      if (isFullscreen() || isChangingFullscreen()) return;
      if (!requestFullscreen.isAvailable()) return;
      try {
        await requestFullscreen();
      } catch (err) {
        const code = (err as { type?: string } | null)?.type;
        if (code !== "ERR_FULLSCREEN_FAILED" && code !== "ERR_ALREADY_REQUESTING") {
          console.warn("telegram fullscreen request skipped", err);
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.tma = "true";
    return () => {
      delete document.documentElement.dataset.tma;
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (fullscreen) {
      document.documentElement.dataset.tmaFullscreen = "true";
    } else {
      delete document.documentElement.dataset.tmaFullscreen;
    }
  }, [fullscreen]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const h = height || window.innerHeight;
    document.documentElement.style.setProperty("--app-height", `${h}px`);
  }, [height]);

  return null;
}
