import { z } from "zod";

const Schema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:8080"),
  NEXT_PUBLIC_MAP_TILE_URL: z.string().url().default("https://tile.openstreetmap.org/{z}/{x}/{y}.png"),
  NEXT_PUBLIC_MAP_ATTRIBUTION: z.string().default("© OpenStreetMap contributors"),
  NEXT_PUBLIC_APP_NAME: z.string().default("PokerMap Admin"),
});

export const publicEnv = Schema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_MAP_TILE_URL: process.env.NEXT_PUBLIC_MAP_TILE_URL,
  NEXT_PUBLIC_MAP_ATTRIBUTION: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
});

export function serverApiUrl(): string {
  return process.env.API_URL ?? publicEnv.NEXT_PUBLIC_API_URL;
}
