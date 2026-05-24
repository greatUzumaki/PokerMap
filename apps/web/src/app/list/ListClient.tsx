"use client";

import { useMemo, useState } from "react";
import type { Club } from "@pokermap/types";
import { Input } from "@pokermap/ui/input";
import { Card, CardContent } from "@pokermap/ui/card";
import { Badge } from "@pokermap/ui/badge";

export function ListClient({ clubs }: { clubs: Club[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return clubs;
    return clubs.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.address.toLowerCase().includes(needle),
    );
  }, [clubs, q]);

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
          <li key={c.id}>
            <Card>
              <CardContent className="p-4">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <h2 className="font-semibold">{c.name}</h2>
                  <Badge variant="outline">{c.games.length} игр</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{c.address}</p>
                {c.games.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.games.map((g) => (
                      <Badge key={g} variant="secondary" className="text-[10px]">
                        {g}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
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
