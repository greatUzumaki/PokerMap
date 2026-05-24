"use client";

import { usePageView } from "@/hooks/usePageView";

/** Mount-only side-effect component. Renders nothing. */
export function PageViewTracker() {
  usePageView();
  return null;
}
