import { z } from "zod";

const PublicSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:8080"),
  NEXT_PUBLIC_MAP_TILE_URL: z.string().url().default("https://tile.openstreetmap.org/{z}/{x}/{y}.png"),
  NEXT_PUBLIC_MAP_ATTRIBUTION: z.string().default("© OpenStreetMap contributors"),
  NEXT_PUBLIC_DEFAULT_BBOX: z.string().default("30.18,59.83,30.55,60.07"),
  NEXT_PUBLIC_APP_NAME: z.string().default("PokerMap SPb"),
  NEXT_PUBLIC_SUPPORT_TG: z.string().default("https://t.me/"),
});

export const publicEnv = PublicSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_MAP_TILE_URL: process.env.NEXT_PUBLIC_MAP_TILE_URL,
  NEXT_PUBLIC_MAP_ATTRIBUTION: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION,
  NEXT_PUBLIC_DEFAULT_BBOX: process.env.NEXT_PUBLIC_DEFAULT_BBOX,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_SUPPORT_TG: process.env.NEXT_PUBLIC_SUPPORT_TG,
});

export const defaultBBox = (() => {
  const [minLng, minLat, maxLng, maxLat] = publicEnv.NEXT_PUBLIC_DEFAULT_BBOX.split(",").map(Number);
  return { minLng, minLat, maxLng, maxLat };
})();

export const SPB_CENTER = { lng: 30.3351, lat: 59.9343 };

export function serverApiUrl(): string {
  return process.env.API_URL ?? publicEnv.NEXT_PUBLIC_API_URL;
}
