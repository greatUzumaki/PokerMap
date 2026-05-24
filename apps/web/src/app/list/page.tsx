import { listPublishedClubs } from "@/lib/api/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pokermap/ui/card";
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
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Покер-клубы Петербурга</CardTitle>
          <CardDescription>
            {items.length} {pluralize(items.length, ["клуб", "клуба", "клубов"])} на карте
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4 grid w-full grid-cols-3">
              <TabsTrigger value="all">Все</TabsTrigger>
              <TabsTrigger value="cash">Кэш</TabsTrigger>
              <TabsTrigger value="mtt">Турниры</TabsTrigger>
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
        </CardContent>
      </Card>
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
