import { EVENT_KINDS } from "@pokermap/types";
import { listEvents } from "@/lib/api/server";
import { AnalyticsClient } from "./AnalyticsClient";

interface PageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    kind?: string | string[];
    telegramUserId?: string;
    q?: string;
    cursor?: string;
  }>;
}

function defaultFromIso(): string {
  // last 7 days
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const kinds = sp.kind === undefined ? [] : Array.isArray(sp.kind) ? sp.kind : [sp.kind];
  const from = sp.from || defaultFromIso();
  const to = sp.to;
  const telegramUserId = sp.telegramUserId ? Number(sp.telegramUserId) : undefined;
  const data = await listEvents({
    from,
    to,
    kinds,
    telegramUserId: Number.isFinite(telegramUserId) ? telegramUserId : undefined,
    q: sp.q,
    cursor: sp.cursor,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Аналитика</h1>
        <p className="text-sm text-muted-foreground">
          Журнал действий: bot, Mini App, public-сайт, админ-мутации. Хранится 30 дней.
        </p>
      </div>
      <AnalyticsClient
        initial={data}
        kinds={[...EVENT_KINDS]}
        filters={{ from, to, kinds, telegramUserId, q: sp.q }}
      />
    </div>
  );
}
