import Link from "next/link";
import { listAdminClubs } from "@/lib/api/server";
import { Button } from "@pokermap/ui/button";
import { Badge } from "@pokermap/ui/badge";
import { Plus } from "lucide-react";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline" | "warning" | "success"> = {
  draft: "warning",
  published: "success",
  archived: "outline",
};

export default async function AdminClubsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const pageNum = Math.max(1, Number(page ?? "1") || 1);
  const limit = 50;
  const offset = (pageNum - 1) * limit;
  const { items, total } = await listAdminClubs({ limit, offset });
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Клубы ({total})</h1>
        <Button asChild>
          <Link href="/clubs/new">
            <Plus className="h-4 w-4" aria-hidden /> Добавить клуб
          </Link>
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3">Статус</th>
              <th className="p-3">Название</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Адрес</th>
              <th className="p-3">Обновлён</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">
                  <Badge variant={statusVariant[c.status] ?? "outline"}>{c.status}</Badge>
                </td>
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{c.slug}</td>
                <td className="p-3 text-muted-foreground">{c.address}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {new Date(c.updatedAt).toLocaleString("ru-RU")}
                </td>
                <td className="p-3 text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/clubs/${c.id}`}>Открыть</Link>
                  </Button>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Пока пусто. Создайте первый клуб.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <nav className="mt-4 flex justify-between text-sm">
        <Button asChild variant="ghost" disabled={pageNum <= 1}>
          <Link href={`/?page=${pageNum - 1}`}>← Назад</Link>
        </Button>
        <span className="text-muted-foreground">
          Стр. {pageNum} из {totalPages}
        </span>
        <Button asChild variant="ghost" disabled={pageNum >= totalPages}>
          <Link href={`/?page=${pageNum + 1}`}>Дальше →</Link>
        </Button>
      </nav>
    </section>
  );
}
