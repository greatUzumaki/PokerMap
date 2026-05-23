import { NextResponse, type NextRequest } from "next/server";
import { serverApiUrl } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Proxy presigned-GET issuance through the API so MinIO can stay private.
// The API exposes /v1/media/sign-get?key=... — until that endpoint exists we
// fall back to redirecting to MinIO via env (dev only).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const objectKey = key.join("/");
  if (!objectKey) return NextResponse.json({ error: "missing key" }, { status: 400 });

  const url = `${serverApiUrl()}/v1/media?key=${encodeURIComponent(objectKey)}`;
  const res = await fetch(url, { redirect: "manual" });
  if (res.status === 302) {
    const loc = res.headers.get("location");
    if (loc) return NextResponse.redirect(loc, 302);
  }
  if (!res.ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(res.body, {
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/octet-stream" },
  });
}
