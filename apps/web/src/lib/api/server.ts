import "server-only";
import { Club, ClubsList } from "@pokermap/types";
import { serverApiUrl } from "@/lib/env";

export async function listPublishedClubs(opts: { limit?: number; bbox?: string } = {}): Promise<ClubsList> {
  const qs = new URLSearchParams();
  if (opts.limit) qs.set("limit", String(opts.limit));
  if (opts.bbox) qs.set("bbox", opts.bbox);
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
