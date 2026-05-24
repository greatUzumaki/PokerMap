"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/track";
import type { EventKind } from "@pokermap/types";

interface Props {
  kind: EventKind;
  payload?: Record<string, unknown>;
  /** Fire only once per mount (default). When false, fires every effect-run. */
  once?: boolean;
}

/**
 * Lifecycle-only tracker. Renders nothing; emits `kind` when mounted (and once
 * per mount by default). Useful inside conditionally-rendered components like
 * <ClubSheet> so that "club view" is captured exactly when the sheet opens.
 */
export function TrackOnView({ kind, payload, once = true }: Props) {
  const fired = useRef(false);
  useEffect(() => {
    if (once && fired.current) return;
    fired.current = true;
    track(kind, payload);
  }, [kind, payload, once]);
  return null;
}
