import { listPublishedClubs } from "@/lib/api/server";
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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4">
      <h1 className="mb-4 text-2xl font-semibold">Покер-клубы Петербурга</h1>
      <ListClient clubs={items} />
    </div>
  );
}
