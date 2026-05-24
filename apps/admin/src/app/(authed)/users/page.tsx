import Link from "next/link";
import { listUsers } from "@/lib/api/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pokermap/ui/card";
import { Badge } from "@pokermap/ui/badge";
import { Input } from "@pokermap/ui/input";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function UsersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { items } = await listUsers(sp.q);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Пользователи</h1>
        <p className="text-sm text-muted-foreground">
          Все Telegram-идентичности, которые открывали бота или Mini App.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Поиск</CardTitle>
          <CardDescription>По имени или @username</CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <Input name="q" placeholder="ivan, @ivan42…" defaultValue={sp.q ?? ""} />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Список</CardTitle>
          <CardDescription>{items.length} пользовател(ей), сортировка по последнему визиту</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="px-2 py-2 text-left">Имя</th>
                  <th className="px-2 py-2 text-left">Username</th>
                  <th className="px-2 py-2 text-left">Lang</th>
                  <th className="px-2 py-2 text-left">Premium</th>
                  <th className="px-2 py-2 text-left">First</th>
                  <th className="px-2 py-2 text-left">Last seen</th>
                  <th className="px-2 py-2 text-right">События</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                      Нет пользователей
                    </td>
                  </tr>
                ) : null}
                {items.map((u) => (
                  <tr key={u.telegramUserId} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="px-2 py-2">
                      <Link
                        className="font-medium underline-offset-2 hover:underline"
                        href={`/users/${u.telegramUserId}`}
                      >
                        {(`${u.firstName} ${u.lastName}`).trim() || `tg:${u.telegramUserId}`}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {u.username ? `@${u.username}` : "—"}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{u.languageCode ?? "—"}</td>
                    <td className="px-2 py-2">
                      {u.isPremium ? <Badge variant="secondary">Premium</Badge> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{fmtDate(u.firstSeenAt)}</td>
                    <td className="px-2 py-2">{fmtDate(u.lastSeenAt)}</td>
                    <td className="px-2 py-2 text-right">{u.eventCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
