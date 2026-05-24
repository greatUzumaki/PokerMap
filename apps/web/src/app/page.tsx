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
    <div
      data-test="map-container"
      className="relative h-[calc(100dvh-5rem)] min-h-[400px] w-full md:h-[calc(100dvh-4rem)]"
    >
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            Загружаем карту…
          </div>
        }
      >
        <MapData />
      </Suspense>
    </div>
  );
}
