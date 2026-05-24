import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@pokermap/ui/badge";
import { Button } from "@pokermap/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pokermap/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pokermap/ui/table";
import { listAdminClubs } from "@/lib/api/server";

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

const PAGE_SIZE = 50;

export default async function AdminClubsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const pageNum = Math.max(1, Number(page ?? "1") || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;
  const { items, total } = await listAdminClubs({ limit: PAGE_SIZE, offset });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Клубы</h1>
        <p className="text-sm text-muted-foreground">Управление каталогом покер-клубов</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b">
          <div>
            <CardTitle>Каталог</CardTitle>
            <CardDescription>
              Всего {total} {pluralize(total, ["клуб", "клуба", "клубов"])}
            </CardDescription>
          </div>
          <Button asChild>
            <Link href="/clubs/new">
              <Plus className="h-4 w-4" aria-hidden /> Добавить клуб
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Статус</TableHead>
                <TableHead>Название</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Адрес</TableHead>
                <TableHead>Обновлён</TableHead>
                <TableHead className="w-24 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.slug}</TableCell>
                  <TableCell className="text-muted-foreground">{c.address}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(c.updatedAt).toLocaleString("ru-RU")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/clubs/${c.id}`}>Открыть</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-6 text-center text-muted-foreground">
                    Пока пусто. Создайте первый клуб.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <nav className="flex items-center justify-between text-sm" aria-label="Пагинация">
        <Button asChild variant="ghost" disabled={pageNum <= 1}>
          <Link
            href={pageNum <= 1 ? "#" : `/clubs?page=${pageNum - 1}`}
            aria-disabled={pageNum <= 1}
          >
            ← Назад
          </Link>
        </Button>
        <span className="text-muted-foreground">
          Стр. {pageNum} из {totalPages}
        </span>
        <Button asChild variant="ghost" disabled={pageNum >= totalPages}>
          <Link
            href={pageNum >= totalPages ? "#" : `/clubs?page=${pageNum + 1}`}
            aria-disabled={pageNum >= totalPages}
          >
            Дальше →
          </Link>
        </Button>
      </nav>
    </div>
  );
}

function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
