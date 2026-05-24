"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { track } from "@/lib/track";

/** Emits a `web.page_view` event on every pathname change. */
export function usePageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const current = pathname + (searchParams.toString() ? "?" + searchParams.toString() : "");
    if (lastPath.current === current) return;
    track("web.page_view", { path: pathname, from: lastPath.current ?? null });
    lastPath.current = current;
  }, [pathname, searchParams]);
}
