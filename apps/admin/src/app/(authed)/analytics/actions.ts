"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
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

export async function deleteEvent(id: string): Promise<{ ok: true } | { error: string }> {
  const res = await authedFetch(`/v1/admin/events/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    return { error: `delete failed: ${res.status}` };
  }
  revalidatePath("/analytics");
  return { ok: true };
}

export interface BulkDeleteFilters {
  from?: string | undefined;
  to: string;
  kinds?: string[] | undefined;
  telegramUserId?: number | undefined;
  q?: string | undefined;
}

export async function bulkDeleteEvents(f: BulkDeleteFilters): Promise<{ deleted: number } | { error: string }> {
  const qs = new URLSearchParams();
  qs.set("confirm", "true");
  qs.set("to", f.to);
  if (f.from) qs.set("from", f.from);
  for (const k of f.kinds ?? []) qs.append("kind", k);
  if (f.telegramUserId) qs.set("telegramUserId", String(f.telegramUserId));
  if (f.q) qs.set("q", f.q);
  const res = await authedFetch(`/v1/admin/events?${qs}`, { method: "DELETE" });
  if (!res.ok) {
    return { error: `bulk delete failed: ${res.status}` };
  }
  const body = (await res.json()) as { deleted: number };
  revalidatePath("/analytics");
  return { deleted: body.deleted };
}
