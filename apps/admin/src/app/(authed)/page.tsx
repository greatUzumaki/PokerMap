import Link from "next/link";
import { ArrowUpRight, Building2, FilePenLine, Globe, Plus } from "lucide-react";
import { Badge } from "@pokermap/ui/badge";
import { Button } from "@pokermap/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pokermap/ui/card";
import { Separator } from "@pokermap/ui/separator";
import { getAdminOverview } from "@/lib/api/server";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  published: "Опубликован",
  archived: "В архиве",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline" | "warning" | "success"> = {
  draft: "warning",
  published: "success",
  archived: "outline",
};

export default async function DashboardPage() {
  let overview;
  try {
    overview = await getAdminOverview();
  } catch {
    overview = { totals: { all: 0, draft: 0, published: 0, archived: 0 }, recent: [] };
  }
  const { totals, recent } = overview;

  const kpis = [
    { label: "Всего клубов", value: totals.all, hint: "в базе" },
    { label: "Опубликовано", value: totals.published, hint: "видимы на карте" },
    { label: "Черновики", value: totals.draft, hint: "не показываются" },
    { label: "В архиве", value: totals.archived, hint: "скрыты" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
        <p className="text-sm text-muted-foreground">Сводка по клубам и быстрые действия</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardDescription>{k.label}</CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums">{k.value}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">{k.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Последние изменения</CardTitle>
              <CardDescription>5 недавно обновлённых клубов</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/clubs" className="gap-1">
                Все клубы <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {recent.length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Пока пусто. Создайте первый клуб.
              </p>
            ) : (
              <ul className="divide-y">
                {recent.map((club) => (
                  <li key={club.id}>
                    <Link
                      href={`/clubs/${club.id}`}
                      className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-3 transition-colors hover:bg-accent/40"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{club.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{club.address}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge variant={STATUS_VARIANT[club.status] ?? "outline"}>
                          {STATUS_LABEL[club.status] ?? club.status}
                        </Badge>
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {new Date(club.updatedAt).toLocaleDateString("ru-RU")}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
            <CardDescription>Самое нужное под рукой</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild className="w-full justify-start gap-2">
              <Link href="/clubs/new">
                <Plus className="h-4 w-4" /> Добавить клуб
              </Link>
            </Button>
            <Separator className="my-2" />
            <Button asChild variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
              <Link href="/clubs">
                <Building2 className="h-4 w-4" /> Список клубов
              </Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
              <Link href="/media">
                <FilePenLine className="h-4 w-4" /> Медиа
              </Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
              <Link href="/audit">
                <Globe className="h-4 w-4" /> Аудит
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
