"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export const CLUBS_QUERY_KEY = ["clubs", "published"] as const;

export function useClubs() {
  return useQuery({
    queryKey: CLUBS_QUERY_KEY,
    queryFn: () => api.listPublishedClubs({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnMount: false,
    refetchOnReconnect: "always",
  });
}
