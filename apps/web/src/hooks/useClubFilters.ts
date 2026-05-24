"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { isOpenNow, type Club, type ClubType, type Game } from "@pokermap/types";

export const GAME_FILTER_VALUES = ["NLH", "PLO", "PLO5", "MTT", "SnG", "Mixed"] as const satisfies readonly Game[];
export const TYPE_FILTER_VALUES = [
  "cash",
  "club",
  "mtt-series",
  "mafia-and-poker",
  "underground",
] as const satisfies readonly ClubType[];

export const BUY_IN_MIN = 0;
export const BUY_IN_MAX = 10_000_000;

export interface ClubFilters {
  openNow: boolean;
  games: Game[];
  types: ClubType[];
  minBuyIn: number | null;
  maxBuyIn: number | null;
}

export const defaultFilters: ClubFilters = {
  openNow: false,
  games: [],
  types: [],
  minBuyIn: null,
  maxBuyIn: null,
};

function parseCsv<T extends string>(value: string | null, allowed: readonly T[]): T[] {
  if (!value) return [];
  const set = new Set<string>(allowed);
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is T => set.has(s));
}

export function parseFilters(params: URLSearchParams): ClubFilters {
  const minBuyInRaw = params.get("minBuyIn");
  const maxBuyInRaw = params.get("maxBuyIn");
  return {
    openNow: params.get("openNow") === "1",
    games: parseCsv(params.get("games"), GAME_FILTER_VALUES),
    types: parseCsv(params.get("types"), TYPE_FILTER_VALUES),
    minBuyIn: minBuyInRaw ? Number(minBuyInRaw) || null : null,
    maxBuyIn: maxBuyInRaw ? Number(maxBuyInRaw) || null : null,
  };
}

export function filtersToParams(filters: ClubFilters): URLSearchParams {
  const qs = new URLSearchParams();
  if (filters.openNow) qs.set("openNow", "1");
  if (filters.games.length) qs.set("games", filters.games.join(","));
  if (filters.types.length) qs.set("types", filters.types.join(","));
  if (filters.minBuyIn != null) qs.set("minBuyIn", String(filters.minBuyIn));
  if (filters.maxBuyIn != null) qs.set("maxBuyIn", String(filters.maxBuyIn));
  return qs;
}

export function activeFilterCount(filters: ClubFilters): number {
  let n = 0;
  if (filters.openNow) n++;
  if (filters.games.length) n++;
  if (filters.types.length) n++;
  if (filters.minBuyIn != null || filters.maxBuyIn != null) n++;
  return n;
}

export function makePredicate(filters: ClubFilters, now: Date = new Date()): (c: Club) => boolean {
  const gameSet = new Set<string>(filters.games);
  const typeSet = new Set<string>(filters.types);
  return (c) => {
    if (filters.openNow && !isOpenNow(c.workingHours, now, "Europe/Moscow")) return false;
    if (gameSet.size > 0 && !c.games.some((g) => gameSet.has(g))) return false;
    if (typeSet.size > 0 && !typeSet.has(c.clubType)) return false;
    if (filters.minBuyIn != null) {
      if (c.maxBuyInCents != null && c.maxBuyInCents < filters.minBuyIn) return false;
    }
    if (filters.maxBuyIn != null) {
      if (c.minBuyInCents != null && c.minBuyInCents > filters.maxBuyIn) return false;
    }
    return true;
  };
}

export interface UseClubFiltersReturn {
  filters: ClubFilters;
  setFilters: (next: ClubFilters) => void;
  resetFilters: () => void;
  predicate: (c: Club) => boolean;
  activeCount: number;
}

export function useClubFilters(): UseClubFiltersReturn {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(() => parseFilters(new URLSearchParams(params.toString())), [params]);

  const writeUrl = useCallback(
    (next: ClubFilters) => {
      const qs = filtersToParams(next);
      const search = qs.toString();
      const href = (search ? `${pathname}?${search}` : pathname) as Route;
      router.replace(href, { scroll: false });
    },
    [pathname, router],
  );

  const setFilters = useCallback((next: ClubFilters) => writeUrl(next), [writeUrl]);
  const resetFilters = useCallback(() => writeUrl(defaultFilters), [writeUrl]);

  const predicate = useMemo(() => makePredicate(filters), [filters]);

  return {
    filters,
    setFilters,
    resetFilters,
    predicate,
    activeCount: activeFilterCount(filters),
  };
}
