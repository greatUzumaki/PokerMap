"use server";

import { cookies } from "next/headers";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { serverApiUrl } from "@/lib/env";

const SESSION_COOKIE = "pm_session";

async function authedFetch(path: string, init: RequestInit = {}) {
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

export type ActionState =
  | { ok: true }
  | { ok: false; code: string; message: string; fields?: Record<string, string> };

function readPayload(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  const getOptional = (k: string) => {
    const v = get(k).trim();
    return v === "" ? undefined : v;
  };
  const getNumber = (k: string) => {
    const raw = get(k).trim();
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };
  const getList = (k: string) =>
    get(k)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  return {
    slug: get("slug"),
    name: get("name"),
    address: get("address"),
    lat: getNumber("lat") ?? 0,
    lng: getNumber("lng") ?? 0,
    description: get("description"),
    phones: getList("phones"),
    website: getOptional("website") ?? null,
    telegramUrl: getOptional("telegramUrl") ?? null,
    games: getList("games"),
    minBuyInCents: getNumber("minBuyInCents") ?? null,
    maxBuyInCents: getNumber("maxBuyInCents") ?? null,
    rakeDescription: get("rakeDescription"),
    photoKeys: getList("photoKeys"),
    status: getOptional("status") ?? "draft",
    workingHours: tryParseJSON(get("workingHours")) ?? {},
  };
}

function tryParseJSON(s: string): unknown {
  if (!s.trim()) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function liftError(body: unknown): ActionState {
  const e = body as {
    error?: { code?: string; message?: string; details?: Array<{ field: string; message: string }> };
  };
  const fields: Record<string, string> = {};
  for (const d of e.error?.details ?? []) fields[d.field] = d.message;
  return { ok: false, code: e.error?.code ?? "internal", message: e.error?.message ?? "Ошибка", fields };
}

export async function createClub(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const payload = readPayload(formData);
  const res = await authedFetch("/v1/admin/clubs", { method: "POST", body: JSON.stringify(payload) });
  if (!res.ok) return liftError(await res.json().catch(() => ({})));
  const created = (await res.json()) as { id: string };
  updateTag("clubs");
  redirect(`/clubs/${created.id}`);
}

export async function updateClub(id: string, _: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const payload = readPayload(formData);
  const res = await authedFetch(`/v1/admin/clubs/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  if (!res.ok) return liftError(await res.json().catch(() => ({})));
  updateTag("clubs");
  return { ok: true };
}

export async function archiveClub(id: string): Promise<void> {
  await authedFetch(`/v1/admin/clubs/${id}`, { method: "DELETE" });
  updateTag("clubs");
  redirect("/");
}

export async function transitionStatus(id: string, status: "draft" | "published" | "archived"): Promise<void> {
  await authedFetch(`/v1/admin/clubs/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
  updateTag("clubs");
}
