"use client";

import Image from "next/image";
import Link from "next/link";
import type { Club, WorkingHours } from "@pokermap/types";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Badge } from "@pokermap/ui/badge";
import { Button } from "@pokermap/ui/button";
import { Phone, Globe, Send, MapPin, ExternalLink } from "lucide-react";
import { OpenInMapsButton } from "@/components/OpenInMapsButton";
import { TrackOnView } from "@/components/track/TrackOnView";

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  mon: "Пн",
  tue: "Вт",
  wed: "Ср",
  thu: "Чт",
  fri: "Пт",
  sat: "Сб",
  sun: "Вс",
};

function formatBuyIn(min: number | null | undefined, max: number | null | undefined): string {
  if (!min && !max) return "—";
  const fmt = (cents: number) => `${(cents / 100).toLocaleString("ru-RU")} ₽`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `от ${fmt(min)}`;
  return `до ${fmt(max ?? 0)}`;
}

function todayKey(): keyof WorkingHours {
  const idx = new Date().getDay();
  return DAYS[idx]!;
}

export function ClubSheet({
  club,
  open,
  onOpenChange,
}: {
  club: Club | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!club) return null;
  const today = todayKey();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {open ? <TrackOnView kind="web.club_view" payload={{ slug: club.slug }} /> : null}
      <DrawerContent className="max-h-[88dvh]">
        <DrawerHeader>
          <DrawerTitle className="text-xl">{club.name}</DrawerTitle>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" aria-hidden /> {club.address}
          </p>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-4">
          {club.photoKeys.length > 0 ? (
            <div className="-mx-4 mb-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4">
              {club.photoKeys.map((key) => (
                <div key={key} className="relative h-44 w-72 shrink-0 snap-start overflow-hidden rounded-lg bg-muted">
                  <Image src={`/api/media/${encodeURI(key)}`} alt={club.name} fill className="object-cover" sizes="288px" />
                </div>
              ))}
            </div>
          ) : null}

          <div className="mb-4 flex flex-wrap gap-2">
            {club.games.map((g) => (
              <Badge key={g} variant="secondary">
                {g}
              </Badge>
            ))}
          </div>

          <section className="mb-4">
            <h3 className="mb-2 text-sm font-semibold">Часы работы</h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((d) => {
                  const day = club.workingHours[d as keyof WorkingHours];
                  const isToday = d === today;
                  return (
                    <li
                      key={d}
                      className={`flex justify-between rounded px-2 py-1 ${isToday ? "bg-primary/10 font-medium" : ""}`}
                    >
                      <span>{DAY_LABELS[d]}</span>
                      <span>
                        {day.closed
                          ? "Закрыто"
                          : day.slots.map((s) => `${s.open}–${s.close}`).join(", ") || "—"}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </section>

          <section className="mb-4 grid gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Бай-ин:</span>{" "}
              {formatBuyIn(club.minBuyInCents ?? null, club.maxBuyInCents ?? null)}
            </div>
            {club.rakeDescription ? (
              <div>
                <span className="text-muted-foreground">Рейк:</span> {club.rakeDescription}
              </div>
            ) : null}
          </section>

          {club.description ? (
            <section className="mb-4 whitespace-pre-wrap text-sm leading-6">{club.description}</section>
          ) : null}

          <section className="grid gap-2">
            {club.phones.map((p) => (
              <a key={p} href={`tel:${p.replace(/\s+/g, "")}`} className="flex items-center gap-2 text-sm text-primary">
                <Phone className="h-4 w-4" aria-hidden /> {p}
              </a>
            ))}
            {club.website ? (
              <a
                href={club.website}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-2 text-sm text-primary"
              >
                <Globe className="h-4 w-4" aria-hidden /> {club.website.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
            {club.telegramUrl ? (
              <a
                href={club.telegramUrl}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-2 text-sm text-primary"
              >
                <Send className="h-4 w-4" aria-hidden /> Telegram
              </a>
            ) : null}
          </section>
        </div>

        <DrawerFooter className="gap-2">
          <Button asChild size="lg" className="w-full">
            <Link href={`/clubs/${club.slug}`} prefetch={false}>
              <ExternalLink className="h-4 w-4" aria-hidden /> Подробнее
            </Link>
          </Button>
          <OpenInMapsButton
            target={{ lat: club.lat, lng: club.lng, name: club.name, address: club.address }}
            className="w-full"
          />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
