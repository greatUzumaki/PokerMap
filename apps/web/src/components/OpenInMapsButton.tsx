"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@pokermap/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
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

// Universal link form — iOS Safari resolves it to the native Apple Maps app
// without triggering the unknown-protocol block that `maps://` hits.
export function appleMapsUrl({ lat, lng, address }: MapsTarget): string {
  return `https://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(address)}`;
}

export function geoIntent({ lat, lng, name }: MapsTarget): string {
  return `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})`;
}

// Kept for backwards-compat with the URL-builder tests; the component itself
// now lets the user pick a provider rather than auto-routing per platform.
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

type Provider = {
  id: "apple" | "yandex" | "twogis" | "google";
  label: string;
  url: (t: MapsTarget) => string;
};

const PROVIDERS: Provider[] = [
  { id: "yandex", label: "Яндекс Карты", url: yandexWebUrl },
  { id: "twogis", label: "2ГИС", url: twogisWebUrl },
  { id: "apple", label: "Apple Карты", url: appleMapsUrl },
  { id: "google", label: "Google Maps", url: googleMapsWebUrl },
];

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
  const [open, setOpen] = useState(false);

  const openWith = (provider: Provider) => {
    const url = provider.url(target);
    const tg = typeof window !== "undefined" && Boolean(window.Telegram?.WebApp?.openLink);
    track("web.openinmaps_click", { name: target.name, provider: provider.id });
    setOpen(false);
    if (tg) {
      window.Telegram!.WebApp!.openLink!(url);
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
      >
        Открыть в картах <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden />
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Открыть в картах</DrawerTitle>
            <p className="text-sm text-muted-foreground">{target.address}</p>
          </DrawerHeader>
          <div className="flex flex-col gap-2 px-4 pb-2">
            {PROVIDERS.map((p) => (
              <Button
                key={p.id}
                type="button"
                variant="outline"
                size="lg"
                className="w-full justify-start"
                onClick={() => openWith(p)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" className="w-full">
                Отмена
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
