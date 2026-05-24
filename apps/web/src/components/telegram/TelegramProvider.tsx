"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  init,
  isTMA,
  mountBackButton,
  mountThemeParams,
  mountViewport,
} from "@telegram-apps/sdk-react";
import { ThemeBridge } from "./ThemeBridge";
import { ViewportBridge } from "./ViewportBridge";
import { BackButtonBridge } from "./BackButtonBridge";
import { AuthBridge } from "./AuthBridge";

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [inTma, setInTma] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      try {
        const tma = await isTMA();
        if (cancelled) return;
        if (!tma) {
          setReady(true);
          return;
        }
        init();
        mountThemeParams();
        mountBackButton();
        await mountViewport();
        if (cancelled) return;
        setInTma(true);
      } catch (err) {
        console.warn("telegram init skipped", err);
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void setup();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {ready && inTma ? (
        <>
          <ThemeBridge />
          <ViewportBridge />
          <BackButtonBridge />
          <AuthBridge />
        </>
      ) : null}
      {children}
    </>
  );
}
