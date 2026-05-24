import "server-only";
import { Club, ClubsList } from "@pokermap/types";
import { serverApiUrl } from "@/lib/env";

export interface ListPublishedClubsOpts {
  limit?: number;
  bbox?: string;
  games?: string[];
  types?: string[];
  minBuyIn?: number;
  maxBuyIn?: number;
}

export async function listPublishedClubs(opts: ListPublishedClubsOpts = {}): Promise<ClubsList> {
  const qs = new URLSearchParams();
  if (opts.limit) qs.set("limit", String(opts.limit));
  if (opts.bbox) qs.set("bbox", opts.bbox);
  if (opts.games?.length) qs.set("games", opts.games.join(","));
  if (opts.types?.length) qs.set("types", opts.types.join(","));
  if (opts.minBuyIn != null) qs.set("minBuyIn", String(opts.minBuyIn));
  if (opts.maxBuyIn != null) qs.set("maxBuyIn", String(opts.maxBuyIn));
  const res = await fetch(`${serverApiUrl()}/v1/clubs?${qs}`, {
    next: { revalidate: 60, tags: ["clubs"] },
  });
  if (!res.ok) {
    throw new Error(`api list clubs ${res.status}`);
  }
  return ClubsList.parse(await res.json());
}

export async function getClubBySlug(slug: string): Promise<Club | null> {
  const res = await fetch(`${serverApiUrl()}/v1/clubs/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60, tags: ["clubs", `club:${slug}`] },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`api club by slug ${res.status}`);
  return Club.parse(await res.json());
}
