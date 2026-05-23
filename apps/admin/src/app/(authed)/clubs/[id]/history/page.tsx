import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { serverApiUrl } from "@/lib/env";
import { getAdminClub } from "@/lib/api/server";

const SESSION_COOKIE = "pm_session";

interface AuditEntry {
  id: number;
  actor_telegram_user_id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  diff: Record<string, unknown>;
  created_at: string;
}

async function fetchHistory(id: string): Promise<AuditEntry[]> {
  const session = (await cookies()).get(SESSION_COOKIE);
  const init: RequestInit = { cache: "no-store" };
  if (session) {
    init.headers = { Cookie: `${SESSION_COOKIE}=${session.value}` };
  }
  const res = await fetch(`${serverApiUrl()}/v1/admin/clubs/${id}/history`, init);
  if (!res.ok) return [];
  const data = (await res.json()) as { items: AuditEntry[] };
  return data.items ?? [];
}

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const club = await getAdminClub(id);
  if (!club) notFound();
  const items = await fetchHistory(id);

  return (
    <section>
      <h1 className="mb-4 text-lg font-semibold">История · {club.name}</h1>
      <ul className="grid gap-3">
        {items.map((e) => (
          <li key={e.id} className="rounded-md border p-3 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">{e.action}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString("ru-RU")} · tg:{e.actor_telegram_user_id}
              </span>
            </div>
            <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(e.diff, null, 2)}</pre>
          </li>
        ))}
        {items.length === 0 ? <li className="text-muted-foreground">История пуста.</li> : null}
      </ul>
    </section>
  );
}
