"use client";

import dynamic from "next/dynamic";

const PickerInner = dynamic(() => import("./GeoPickerInner").then((m) => m.GeoPickerInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      Загрузка карты…
    </div>
  ),
});

export function GeoPicker(props: { lat: number; lng: number; onChange: (lat: number, lng: number) => void }) {
  return <PickerInner {...props} />;
}
