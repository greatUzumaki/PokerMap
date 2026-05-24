"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Map, {
  type MapRef,
  type MapLayerMouseEvent,
  Layer,
  Source,
  NavigationControl,
} from "react-map-gl/maplibre";
import type { FeatureCollection, Point } from "geojson";
import type { Club } from "@pokermap/types";
import { publicEnv, SPB_CENTER } from "@/lib/env";
import { useTelegramHaptics } from "@/hooks/useTelegramHaptics";
import { ClubSheet } from "./ClubSheet";

const CLUSTER_LAYER_ID = "clusters";
const UNCLUSTERED_LAYER_ID = "unclustered-point";
const SOURCE_ID = "clubs";

// Glyphs URL omitted on purpose — raster basemap doesn't need glyphs, and the
// previously used demotiles host was an unreliable third-party dependency. We
// render cluster counts via a lightweight DOM overlay instead of a symbol layer.
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

  const geojson = useMemo<FeatureCollection<Point, { id: string; slug: string; name: string }>>(
    () => ({
      type: "FeatureCollection",
      features: clubs.map((c) => ({
        type: "Feature",
        properties: { id: c.id, slug: c.slug, name: c.name },
        geometry: { type: "Point", coordinates: [c.lng, c.lat] },
      })),
    }),
    [clubs],
  );

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      impact("light");
      if (feature.layer.id === CLUSTER_LAYER_ID) {
        const clusterId = feature.properties?.cluster_id as number | undefined;
        if (clusterId == null) return;
        const src = mapRef.current?.getSource(SOURCE_ID) as
          | { getClusterExpansionZoom?: (id: number, cb: (err: unknown, zoom: number) => void) => void }
          | undefined;
        src?.getClusterExpansionZoom?.(clusterId, (err, zoom) => {
          if (err) return;
          mapRef.current?.flyTo({
            center: (feature.geometry as Point).coordinates as [number, number],
            zoom,
            duration: 400,
          });
        });
        return;
      }
      const slug = feature.properties?.slug as string | undefined;
      if (!slug) return;
      const club = clubs.find((c) => c.slug === slug);
      if (club) setSelected(club);
    },
    [clubs, impact],
  );

  return (
    <>
      <Map
        ref={mapRef}
        initialViewState={{ longitude: SPB_CENTER.lng, latitude: SPB_CENTER.lat, zoom: 11 }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        interactiveLayerIds={[CLUSTER_LAYER_ID, UNCLUSTERED_LAYER_ID]}
        onClick={onClick}
        attributionControl={false}
      >
        <NavigationControl position="top-right" />
        <Source
          id={SOURCE_ID}
          type="geojson"
          data={geojson}
          cluster
          clusterRadius={48}
          clusterMaxZoom={14}
        >
          <Layer
            id={CLUSTER_LAYER_ID}
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": "hsl(142 71% 45%)",
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
              "circle-radius": [
                "step",
                ["get", "point_count"],
                18,
                10,
                24,
                30,
                30,
              ],
            }}
          />
          <Layer
            id={UNCLUSTERED_LAYER_ID}
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": "hsl(142 71% 45%)",
              "circle-radius": 8,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            }}
          />
        </Source>
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
