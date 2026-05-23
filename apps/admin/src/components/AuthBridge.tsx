"use client";

import { useEffect, useState, type ReactNode } from "react";
import { init, initDataRaw, isTMA, useSignal } from "@telegram-apps/sdk-react";
import { api } from "@/lib/api/client";

function InitData() {
  const raw = useSignal(initDataRaw);
  useEffect(() => {
    if (!raw) return;
    void api.telegramAuth(raw).catch((err: unknown) => {
      console.warn("telegram auth failed", err);
    });
  }, [raw]);
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      try {
        if (await isTMA()) {
          init();
        }
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
      {ready ? <InitData /> : null}
      {children}
    </>
  );
}
