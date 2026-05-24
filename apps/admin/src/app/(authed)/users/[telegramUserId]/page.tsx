import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser, listEvents } from "@/lib/api/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pokermap/ui/card";
import { Badge } from "@pokermap/ui/badge";

interface PageProps {
  params: Promise<{ telegramUserId: string }>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU");
}

export default async function UserDetailPage({ params }: PageProps) {
  const { telegramUserId } = await params;
  const id = Number(telegramUserId);
  if (!Number.isFinite(id)) notFound();

  const [user, events] = await Promise.all([
    getUser(id),
    listEvents({ telegramUserId: id, limit: 50 }),
  ]);
  if (!user) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {(`${user.firstName} ${user.lastName}`).trim() || `tg:${user.telegramUserId}`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {user.username ? `@${user.username} · ` : ""}tg:{user.telegramUserId}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Профиль</CardTitle>
          <CardDescription>Поля из Telegram</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Row label="Telegram ID" value={String(user.telegramUserId)} />
            <Row label="Username" value={user.username ? `@${user.username}` : "—"} />
            <Row label="Имя" value={user.firstName || "—"} />
            <Row label="Фамилия" value={user.lastName || "—"} />
            <Row label="Язык" value={user.languageCode ?? "—"} />
            <Row label="Premium" value={user.isPremium ? "Да" : "Нет"} />
            <Row label="Bot" value={user.isBot ? "Да" : "Нет"} />
            <Row label="PM allowed" value={user.allowsWriteToPm === null ? "—" : user.allowsWriteToPm ? "Да" : "Нет"} />
            <Row label="Первый визит" value={fmtDate(user.firstSeenAt)} />
            <Row label="Последний визит" value={fmtDate(user.lastSeenAt)} />
            <Row label="Последнее действие" value={fmtDate(user.lastActionAt)} />
            <Row label="События за 30д" value={String(user.eventCount ?? 0)} />
          </dl>
          <div className="mt-4">
            <Link
              href={`/analytics?telegramUserId=${user.telegramUserId}`}
              className="text-sm font-medium underline-offset-2 hover:underline"
            >
              Посмотреть в Аналитике →
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Последние события</CardTitle>
          <CardDescription>{events.items.length} из последних 30 дней</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {events.items.length === 0 ? (
              <li className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                Событий нет
              </li>
            ) : null}
            {events.items.map((ev) => (
              <li key={ev.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Badge>{ev.kind}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(ev.occurredAt).toLocaleString("ru-RU")}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-border/40 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
