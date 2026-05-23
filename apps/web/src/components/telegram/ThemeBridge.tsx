"use client";

import { useEffect } from "react";
import { themeParamsState, useSignal } from "@telegram-apps/sdk-react";

function hexToHsl(hex: string | undefined): string | null {
  if (!hex) return null;
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const hexValue = m[1];
  if (!hexValue) return null;
  const r = parseInt(hexValue.slice(0, 2), 16) / 255;
  const g = parseInt(hexValue.slice(2, 4), 16) / 255;
  const b = parseInt(hexValue.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function ThemeBridge() {
  const params = useSignal(themeParamsState);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const pairs: Array<[string, string | undefined]> = [
      ["--tg-link", params.linkColor],
      ["--tg-button", params.buttonColor],
      ["--tg-button-text", params.buttonTextColor],
      ["--tg-hint", params.hintColor],
      ["--tg-secondary-bg", params.secondaryBackgroundColor],
    ];
    for (const [name, val] of pairs) {
      const hsl = hexToHsl(val);
      if (hsl) root.style.setProperty(name, hsl);
    }
    const bg = hexToHsl(params.backgroundColor);
    if (bg) root.style.setProperty("--background", bg);
    const fg = hexToHsl(params.textColor);
    if (fg) root.style.setProperty("--foreground", fg);

    // Heuristic: derive dark mode by luminance of background.
    if (params.backgroundColor) {
      const v = params.backgroundColor.replace("#", "");
      const r = parseInt(v.slice(0, 2), 16);
      const g = parseInt(v.slice(2, 4), 16);
      const b = parseInt(v.slice(4, 6), 16);
      const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (l < 0.5) root.classList.add("dark");
      else root.classList.remove("dark");
    }
  }, [params]);

  return null;
}
