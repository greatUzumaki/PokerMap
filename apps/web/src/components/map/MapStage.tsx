"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@pokermap/ui/cn";
import { useClubs } from "@/hooks/useClubs";
import { useClubFilters } from "@/hooks/useClubFilters";
import { MapShell } from "./MapShell";
import { MapFilters } from "./MapFilters";

const EMPTY_BANNER_TIMEOUT_MS = 3000;

export function MapStage() {
  const pathname = usePathname();
  const isMapRoute = pathname === "/";
  const { data, isLoading, error } = useClubs();
  const { predicate } = useClubFilters();
  const clubs = (data?.items ?? []).filter(predicate);

  const showEmptyCandidate = isMapRoute && clubs.length === 0 && !isLoading && !error;
  const [showEmpty, setShowEmpty] = useState(false);

  useEffect(() => {
    if (!showEmptyCandidate) {
      setShowEmpty(false);
      return;
    }
    setShowEmpty(true);
    const t = setTimeout(() => setShowEmpty(false), EMPTY_BANNER_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [showEmptyCandidate, clubs.length, predicate]);

  return (
    <div
      aria-hidden={!isMapRoute}
      className={cn(
        "fixed inset-0 transition-opacity duration-300",
        isMapRoute ? "z-20 opacity-100" : "pointer-events-none z-0 opacity-0",
      )}
    >
      <MapShell clubs={clubs} />
      {isMapRoute ? <MapFilters /> : null}
      {showEmpty ? (
        <div
          role="status"
          className="pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 rounded-full border border-border/60 bg-background/80 px-4 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur transition-opacity duration-300"
        >
          Клубы по фильтру не найдены
        </div>
      ) : null}
    </div>
  );
}
