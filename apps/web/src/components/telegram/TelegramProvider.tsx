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

  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      try {
        if (!(await isTMA())) {
          return;
        }
        init();
        mountThemeParams();
        mountBackButton();
        await mountViewport();
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
      {ready ? (
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
