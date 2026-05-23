"use client";

import { useCallback } from "react";
import Map, { Marker, type MapLayerMouseEvent } from "react-map-gl/maplibre";
import { publicEnv } from "@/lib/env";

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
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

export function GeoPickerInner({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const onClick = useCallback(
    (e: MapLayerMouseEvent) => onChange(e.lngLat.lat, e.lngLat.lng),
    [onChange],
  );

  return (
    <Map
      initialViewState={{ longitude: lng, latitude: lat, zoom: 11 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={mapStyle}
      onClick={onClick}
    >
      <Marker
        longitude={lng}
        latitude={lat}
        draggable
        onDragEnd={(e) => onChange(e.lngLat.lat, e.lngLat.lng)}
      />
    </Map>
  );
}
