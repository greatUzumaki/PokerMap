"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import type { Club } from "@pokermap/types";
import { Input } from "@pokermap/ui/input";
import { Card } from "@pokermap/ui/card";
import { Badge } from "@pokermap/ui/badge";
import { MapPin } from "lucide-react";
import { OpenInMapsButton } from "@/components/OpenInMapsButton";
import { useClubFilters } from "@/hooks/useClubFilters";

export function ListClient({ clubs }: { clubs: Club[] }) {
  const [q, setQ] = useState("");
  const { predicate } = useClubFilters();
  const filtered = useMemo(() => {
    const base = clubs.filter(predicate);
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    return base.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.address.toLowerCase().includes(needle),
    );
  }, [clubs, q, predicate]);

  return (
    <div className="flex flex-col gap-3">
      <label className="sr-only" htmlFor="club-search">
        Поиск
      </label>
      <Input
        id="club-search"
        placeholder="Поиск по названию или адресу"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        {filtered.length} {pluralize(filtered.length, ["клуб", "клуба", "клубов"])}
      </p>
      <ul className="grid gap-3">
        {filtered.map((c) => (
          <ClubCard key={c.id} club={c} />
        ))}
      </ul>
    </div>
  );
}

function ClubCard({ club }: { club: Club }) {
  const logoKey = club.photoKeys[0];
  const description = (club.description || "").trim();
  const shortDescription = description.length > 140 ? `${description.slice(0, 140).trimEnd()}…` : description;

  return (
    <li className="relative">
      <Link
        href={`/clubs/${club.slug}` as Route}
        prefetch={false}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Card className="overflow-hidden rounded-2xl border-border/60 transition-colors hover:border-primary/60">
          <div className="flex gap-4 p-4 pb-14">
            <ClubLogo logoKey={logoKey} name={club.name} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h2 className="truncate text-base font-semibold leading-tight">{club.name}</h2>
              {shortDescription ? (
                <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">{shortDescription}</p>
              ) : (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> {club.address}
                </p>
              )}
              {club.games.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {club.games.slice(0, 4).map((g) => (
                    <Badge key={g} variant="secondary" className="text-[10px]">
                      {g}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      </Link>
      <div
        className="pointer-events-auto absolute bottom-3 right-3"
        onClick={(e) => e.stopPropagation()}
      >
        <OpenInMapsButton
          target={{ lat: club.lat, lng: club.lng, name: club.name, address: club.address }}
          size="sm"
          variant="outline"
        />
      </div>
    </li>
  );
}

function ClubLogo({ logoKey, name }: { logoKey: string | undefined; name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  if (logoKey) {
    return (
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/60">
        <Image
          src={`/api/media/${encodeURI(logoKey)}`}
          alt=""
          fill
          className="object-cover"
          sizes="64px"
        />
      </div>
    );
  }
  return (
    <div
      aria-hidden
      className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 text-xl font-semibold text-primary ring-1 ring-border/60"
    >
      {initial}
    </div>
  );
}

function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
