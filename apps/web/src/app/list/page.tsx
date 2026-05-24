import { listPublishedClubs } from "@/lib/api/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@pokermap/ui/tabs";
import { ListClient } from "./ListClient";

export const dynamic = "force-dynamic";

export default async function ListPage() {
  let items: Awaited<ReturnType<typeof listPublishedClubs>>["items"] = [];
  try {
    const data = await listPublishedClubs({ limit: 200 });
    items = data.items;
  } catch {
    items = [];
  }

  const cash = items.filter((c) => c.games.some((g) => /кэш|cash/i.test(g)));
  const tournaments = items.filter((c) => c.games.some((g) => /турнир|tournament|mtt/i.test(g)));

  return (
    <div className="min-h-app bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-8 md:pt-12">
        <header className="mb-6 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Клубы</h1>
          <span className="text-sm tabular-nums text-muted-foreground">
            {items.length} {pluralize(items.length, ["клуб", "клуба", "клубов"])}
          </span>
        </header>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6 grid w-full grid-cols-3 rounded-full bg-muted/60 p-1">
            <TabsTrigger value="all" className="rounded-full">
              Все
            </TabsTrigger>
            <TabsTrigger value="cash" className="rounded-full">
              Кэш
            </TabsTrigger>
            <TabsTrigger value="mtt" className="rounded-full">
              Турниры
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <ListClient clubs={items} />
          </TabsContent>
          <TabsContent value="cash">
            <ListClient clubs={cash} />
          </TabsContent>
          <TabsContent value="mtt">
            <ListClient clubs={tournaments} />
          </TabsContent>
        </Tabs>
      </div>
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
