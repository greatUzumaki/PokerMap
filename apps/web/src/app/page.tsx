import { Suspense } from "react";
import { listPublishedClubs } from "@/lib/api/server";
import { MapShell } from "@/components/map/MapShell";

export const dynamic = "force-dynamic";

async function MapData() {
  let clubs: Awaited<ReturnType<typeof listPublishedClubs>>["items"] = [];
  try {
    const data = await listPublishedClubs({ limit: 100 });
    clubs = data.items;
  } catch {
    // Backend may be down in local dev — render an empty map instead of crashing.
    clubs = [];
  }
  return <MapShell clubs={clubs} />;
}

export default function HomePage() {
  return (
    <div className="relative h-app flex-1">
      <Suspense
        fallback={
          <div className="flex h-app flex-1 items-center justify-center text-sm text-muted-foreground">
            Загружаем карту…
          </div>
        }
      >
        <MapData />
      </Suspense>
    </div>
  );
}
