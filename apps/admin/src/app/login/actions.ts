"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverApiUrl } from "@/lib/env";

const SESSION_COOKIE = "pm_session";

export type LoginState = { ok: true } | { ok: false; message: string };

export async function loginAction(_: LoginState | undefined, formData: FormData): Promise<LoginState> {
  const usernameRaw = formData.get("username");
  const passwordRaw = formData.get("password");
  const username = typeof usernameRaw === "string" ? usernameRaw.trim() : "";
  const password = typeof passwordRaw === "string" ? passwordRaw : "";

  if (!username || !password) {
    return { ok: false, message: "Введите логин и пароль" };
  }

  const res = await fetch(`${serverApiUrl()}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } };
    const msg = body.error?.code === "invalid_credentials" ? "Неверный логин или пароль" : (body.error?.message ?? "Ошибка входа");
    return { ok: false, message: msg };
  }

  // Forward Set-Cookie from the API to the browser via Next's cookies API.
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const value = extractCookieValue(setCookie, SESSION_COOKIE);
    if (value) {
      const store = await cookies();
      store.set(SESSION_COOKIE, value, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    }
  }
  redirect("/");
}

function extractCookieValue(header: string, name: string): string | null {
  for (const part of header.split(",")) {
    const [pair] = part.split(";");
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const key = pair.slice(0, eq).trim();
    if (key === name) return pair.slice(eq + 1).trim();
  }
  return null;
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
