"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { Club } from "@pokermap/types";
import { Button } from "@pokermap/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@pokermap/ui/card";

type MapViewModule = { MapView: ComponentType<{ clubs: Club[] }> };

export function MapShell({ clubs }: { clubs: Club[] }) {
  const [mod, setMod] = useState<MapViewModule | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    import("./MapView")
      .then((m) => {
        if (!cancelled) setMod(m);
      })
      .catch((err: unknown) => {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error("Failed to load map module", e);
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (error) {
    return (
      <div
        data-test="map-error"
        className="flex h-full w-full items-center justify-center bg-muted/30 p-6"
      >
        <Card className="max-w-sm">
          <CardContent className="space-y-3 p-6 text-center">
            <CardTitle>Не удалось загрузить карту</CardTitle>
            <CardDescription>
              {error.message || "Проверьте соединение и попробуйте ещё раз."}
            </CardDescription>
            <Button onClick={() => setAttempt((n) => n + 1)}>Повторить</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!mod) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/30 text-sm text-muted-foreground">
        Загружаем карту…
      </div>
    );
  }

  const MapView = mod.MapView;
  return <MapView clubs={clubs} />;
}
