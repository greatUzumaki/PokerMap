"use client";

import { publicEnv } from "@/lib/env";
import type { EventKind } from "@pokermap/types";

const ANON_KEY = "pm:anon";
const BATCH_LIMIT = 10;
const FLUSH_DELAY_MS = 2000;

type Pending = { kind: EventKind; payload?: Record<string, unknown> | undefined; occurredAt: string };

let queue: Pending[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let anonSessionId: string | null = null;

function getAnonId(): string {
  if (typeof window === "undefined") return "";
  if (anonSessionId) return anonSessionId;
  try {
    const existing = window.localStorage.getItem(ANON_KEY);
    if (existing) {
      anonSessionId = existing;
      return existing;
    }
  } catch {
    /* localStorage disabled */
  }
  const id = "anon_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  try {
    window.localStorage.setItem(ANON_KEY, id);
  } catch {
    /* ignore */
  }
  anonSessionId = id;
  return id;
}

async function flush() {
  if (typeof window === "undefined") return;
  if (queue.length === 0) return;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const batch = queue.slice(0, BATCH_LIMIT);
  queue = queue.slice(batch.length);

  try {
    const res = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}/v1/events`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Anon-Session": getAnonId(),
      },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
    if (res.status >= 400 && res.status < 500) return;
    if (!res.ok) {
      // Re-queue server errors capped at 2× batch to avoid runaway growth.
      queue = [...batch, ...queue].slice(0, BATCH_LIMIT * 2);
    }
  } catch {
    queue = [...batch, ...queue].slice(0, BATCH_LIMIT * 2);
  }
  if (queue.length > 0) {
    scheduleFlush();
  }
}

function scheduleFlush() {
  if (typeof window === "undefined") return;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_DELAY_MS);
}

export function track(kind: EventKind, payload?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  queue.push({ kind, payload, occurredAt: new Date().toISOString() });
  if (queue.length >= BATCH_LIMIT) {
    void flush();
  } else {
    scheduleFlush();
  }
}

if (typeof window !== "undefined") {
  // Drain the queue before the tab is hidden so closing the page does not lose events.
  window.addEventListener("pagehide", () => void flush(), { capture: true });
}
