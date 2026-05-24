import "server-only";
import { cookies } from "next/headers";
import { Club } from "@pokermap/types";
import { serverApiUrl } from "@/lib/env";

const SESSION_COOKIE = "pm_session";

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  return fetch(`${serverApiUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
      ...(session ? { Cookie: `${SESSION_COOKIE}=${session.value}` } : {}),
    },
    cache: "no-store",
  });
}

interface SessionUser {
  telegramUserId: number;
  isAdmin: boolean;
  firstName: string | null;
  username: string | null;
}

export async function getSession(): Promise<SessionUser | null> {
  const res = await authedFetch("/v1/auth/me");
  if (!res.ok) return null;
  return (await res.json()) as SessionUser;
}

export async function listAdminClubs(opts: { limit?: number; offset?: number } = {}) {
  const qs = new URLSearchParams();
  qs.set("limit", String(opts.limit ?? 50));
  qs.set("offset", String(opts.offset ?? 0));
  const res = await authedFetch(`/v1/admin/clubs?${qs}`);
  if (!res.ok) throw new Error(`api admin list ${res.status}`);
  return (await res.json()) as { items: Club[]; total: number };
}

export async function getAdminClub(id: string): Promise<Club | null> {
  const res = await authedFetch(`/v1/admin/clubs/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`api admin get ${res.status}`);
  return Club.parse(await res.json());
}

export interface AdminOverview {
  totals: { all: number; draft: number; published: number; archived: number };
  recent: Club[];
}

export async function getAdminOverview(): Promise<AdminOverview> {
  // Backend list endpoint has no status filter; fetch a large batch and count locally.
  // PokerMap SPb scope (~tens of clubs) makes this cheap; revisit when scale demands.
  const { items, total } = await listAdminClubs({ limit: 1000, offset: 0 });
  const totals = { all: total, draft: 0, published: 0, archived: 0 };
  for (const club of items) {
    if (club.status === "draft") totals.draft += 1;
    else if (club.status === "published") totals.published += 1;
    else if (club.status === "archived") totals.archived += 1;
  }
  const recent = [...items]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
  return { totals, recent };
}
