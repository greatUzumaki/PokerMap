"use client";

import { ClubsList, type ClubsList as ClubsListT } from "@pokermap/types";
import { publicEnv } from "@/lib/env";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Array<{ field: string; message: string }>) {
    super(message);
  }
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  let code = "internal";
  let message = res.statusText;
  let details: Array<{ field: string; message: string }> | undefined;
  try {
    const body = (await res.json()) as {
      error?: { code: string; message: string; details?: Array<{ field: string; message: string }> };
    };
    if (body.error) {
      code = body.error.code;
      message = body.error.message;
      details = body.error.details;
    }
  } catch {
    // swallow
  }
  throw new ApiError(res.status, code, message, details);
}

export const api = {
  async telegramAuth(initData: string) {
    const res = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}/v1/auth/telegram`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    });
    return parseJsonOrThrow<{ telegramUserId: number; isAdmin: boolean; firstName: string; username: string }>(res);
  },
  async logout() {
    await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  },
  async signUpload(payload: { clubId?: string; filename: string; mime: string; size: number }) {
    const res = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}/v1/admin/uploads/sign`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow<{ url: string; key: string; expiresAt: string }>(res);
  },
  async listPublishedClubs(opts: { limit?: number; bbox?: string } = {}): Promise<ClubsListT> {
    const qs = new URLSearchParams();
    if (opts.limit) qs.set("limit", String(opts.limit));
    if (opts.bbox) qs.set("bbox", opts.bbox);
    const res = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}/v1/clubs?${qs}`, {
      credentials: "include",
    });
    const data = await parseJsonOrThrow<unknown>(res);
    return ClubsList.parse(data);
  },
};
