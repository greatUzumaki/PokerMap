"use client";

import { usePathname } from "next/navigation";
import { cn } from "@pokermap/ui/cn";
import { useClubs } from "@/hooks/useClubs";
import { MapShell } from "./MapShell";

export function MapStage() {
  const pathname = usePathname();
  const isMapRoute = pathname === "/";
  const { data, isLoading, error } = useClubs();
  const clubs = data?.items ?? [];

  return (
    <div
      aria-hidden={!isMapRoute}
      className={cn(
        "fixed inset-0 transition-opacity duration-300",
        isMapRoute ? "z-20 opacity-100" : "pointer-events-none z-0 opacity-0",
      )}
    >
      <MapShell clubs={clubs} />
      {isMapRoute && clubs.length === 0 && !isLoading && !error ? (
        <div className="pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 rounded-full border border-border/60 bg-background/80 px-4 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur">
          Клубы пока не загружены
        </div>
      ) : null}
    </div>
  );
}
