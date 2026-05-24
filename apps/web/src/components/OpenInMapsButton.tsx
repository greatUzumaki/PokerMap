"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@pokermap/ui/button";
import { track } from "@/lib/track";

export type MapsTarget = { lat: number; lng: number; name: string; address: string };

type Platform = "ios" | "android" | "desktop" | "telegram";

declare global {
  interface Window {
    Telegram?: { WebApp?: { openLink?: (url: string) => void } };
  }
}

export function detectPlatform(ua: string, telegram?: boolean): Platform {
  if (telegram) return "telegram";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export function yandexWebUrl({ lat, lng }: MapsTarget): string {
  return `https://yandex.ru/maps/?pt=${lng},${lat}&z=17`;
}

export function twogisWebUrl({ lat, lng }: MapsTarget): string {
  return `https://2gis.ru/spb/geo/${lng},${lat}`;
}

export function googleMapsWebUrl({ lat, lng }: MapsTarget): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function appleMapsUrl({ lat, lng, address }: MapsTarget): string {
  return `maps://?daddr=${lat},${lng}&q=${encodeURIComponent(address)}`;
}

export function geoIntent({ lat, lng, name }: MapsTarget): string {
  return `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})`;
}

// Pick the URL whose protocol gives the user the native app picker (or the
// single sensible default) on their device.
//   - Android `geo:` triggers the system chooser → user picks Google Maps /
//     2GIS / Yandex.Maps from installed apps.
//   - iOS `maps://` opens Apple Maps (iOS does not expose a cross-app picker).
//   - Telegram WebApp + desktop fall back to the Yandex web URL.
export function urlForPlatform(target: MapsTarget, platform: Platform): string {
  switch (platform) {
    case "ios":
      return appleMapsUrl(target);
    case "android":
      return geoIntent(target);
    case "telegram":
    case "desktop":
    default:
      return yandexWebUrl(target);
  }
}

export interface OpenInMapsButtonProps {
  target: MapsTarget;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
}

export function OpenInMapsButton({
  target,
  className,
  size = "default",
  variant = "default",
}: OpenInMapsButtonProps) {
  const onClick = () => {
    const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
    const tg = typeof window !== "undefined" && Boolean(window.Telegram?.WebApp?.openLink);
    const platform = detectPlatform(ua, tg);
    const url = urlForPlatform(target, platform);

    track("web.openinmaps_click", { name: target.name, platform });

    if (platform === "telegram") {
      window.Telegram!.WebApp!.openLink!(url);
      return;
    }
    if (url.startsWith("geo:") || url.startsWith("maps:")) {
      window.location.href = url;
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  return (
    <Button type="button" size={size} variant={variant} className={className} onClick={onClick}>
      Открыть в картах <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden />
    </Button>
  );
}
