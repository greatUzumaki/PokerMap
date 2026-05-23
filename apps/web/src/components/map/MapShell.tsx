"use client";

import dynamic from "next/dynamic";
import type { Club } from "@pokermap/types";

const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex h-app w-full items-center justify-center bg-muted text-sm text-muted-foreground">
      Загружаем карту…
    </div>
  ),
});

export function MapShell({ clubs }: { clubs: Club[] }) {
  return <MapView clubs={clubs} />;
}
