"use client";

import { useEffect } from "react";
import { expandViewport, useSignal, viewportStableHeight } from "@telegram-apps/sdk-react";

export function ViewportBridge() {
  const height = useSignal(viewportStableHeight);

  useEffect(() => {
    try {
      expandViewport();
    } catch {
      // not in Telegram
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const h = height || window.innerHeight;
    document.documentElement.style.setProperty("--app-height", `${h}px`);
  }, [height]);

  return null;
}
