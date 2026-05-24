"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/track";
import type { EventKind } from "@pokermap/types";

interface Props {
  kind: EventKind;
  payload?: Record<string, unknown>;
  /** When false, fires on every effect-run instead of once per mount. */
  once?: boolean;
}

export function TrackOnView({ kind, payload, once = true }: Props) {
  const fired = useRef(false);
  useEffect(() => {
    if (once && fired.current) return;
    fired.current = true;
    track(kind, payload);
  }, [kind, payload, once]);
  return null;
}
