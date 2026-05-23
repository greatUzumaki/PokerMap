"use client";

import { useEffect } from "react";
import { initDataRaw, useSignal } from "@telegram-apps/sdk-react";
import { api } from "@/lib/api/client";

export function AuthBridge() {
  const raw = useSignal(initDataRaw);

  useEffect(() => {
    if (!raw) return;
    void api.telegramAuth(raw).catch((err: unknown) => {
      console.warn("telegram auth failed", err);
    });
  }, [raw]);

  return null;
}
