"use client";

import { useCallback, useRef, useState } from "react";
import Map, {
  type MapRef,
  Marker,
  NavigationControl,
} from "react-map-gl/maplibre";
import type { Club } from "@pokermap/types";
import { publicEnv, SPB_CENTER } from "@/lib/env";
import { useTelegramHaptics } from "@/hooks/useTelegramHaptics";
import { ClubSheet } from "./ClubSheet";
import { PokerChip } from "./PokerChip";

const mapStyle = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: [publicEnv.NEXT_PUBLIC_MAP_TILE_URL],
      tileSize: 256,
      attribution: publicEnv.NEXT_PUBLIC_MAP_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster" as const,
      source: "osm",
    },
  ],
};

export function MapView({ clubs }: { clubs: Club[] }) {
  const mapRef = useRef<MapRef | null>(null);
  const [selected, setSelected] = useState<Club | null>(null);
  const { impact } = useTelegramHaptics();

  const handleSelect = useCallback(
    (club: Club) => {
      impact("light");
      setSelected(club);
      mapRef.current?.flyTo({
        center: [club.lng, club.lat],
        zoom: Math.max(mapRef.current.getZoom(), 13),
        duration: 450,
      });
    },
    [impact],
  );

  return (
    <>
      <Map
        ref={mapRef}
        initialViewState={{ longitude: SPB_CENTER.lng, latitude: SPB_CENTER.lat, zoom: 11 }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        attributionControl={false}
        reuseMaps
      >
        <NavigationControl position="top-right" />
        {clubs.map((club) => {
          const active = selected?.id === club.id;
          return (
            <Marker
              key={club.id}
              longitude={club.lng}
              latitude={club.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handleSelect(club);
              }}
            >
              <button
                type="button"
                aria-label={club.name}
                className={`group relative flex flex-col items-center transition-transform duration-200 ease-out ${
                  active ? "scale-110" : "hover:scale-110"
                }`}
              >
                <PokerChip size={active ? 44 : 36} active={active} />
                <span
                  className={`pointer-events-none absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 translate-y-full rounded-full bg-primary ring-2 ring-background transition-opacity ${
                    active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                />
              </button>
            </Marker>
          );
        })}
      </Map>
      <ClubSheet
        club={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}
