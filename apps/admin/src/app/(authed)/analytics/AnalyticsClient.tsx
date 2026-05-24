"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@pokermap/ui/badge";
import { Button } from "@pokermap/ui/button";
import { Input } from "@pokermap/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@pokermap/ui/card";
import type { UserEventsList } from "@pokermap/types";
import { bulkDeleteEvents, deleteEvent } from "./actions";

interface Props {
  initial: UserEventsList;
  kinds: string[];
  filters: {
    from: string;
    to?: string | undefined;
    kinds: string[];
    telegramUserId?: number | undefined;
    q?: string | undefined;
  };
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function kindFamily(k: string): "bot" | "app" | "web" | "admin" | "other" {
  if (k.startsWith("bot.")) return "bot";
  if (k.startsWith("app.")) return "app";
  if (k.startsWith("web.")) return "web";
  if (k.startsWith("admin.")) return "admin";
  return "other";
}

const FAMILY_COLOR: Record<string, string> = {
  bot: "bg-blue-500/20 text-blue-200",
  app: "bg-emerald-500/20 text-emerald-200",
  web: "bg-amber-500/20 text-amber-200",
  admin: "bg-violet-500/20 text-violet-200",
  other: "bg-muted",
};

export function AnalyticsClient({ initial, kinds, filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [items, setItems] = useState(initial.items);

  const activeKinds = useMemo(() => new Set(filters.kinds), [filters.kinds]);

  const setQueryParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, value);
    next.delete("cursor");
    router.replace(`/analytics?${next.toString()}`);
  };

  const toggleKind = (k: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("kind");
    const newSet = new Set(activeKinds);
    if (newSet.has(k)) newSet.delete(k);
    else newSet.add(k);
    for (const kk of newSet) next.append("kind", kk);
    next.delete("cursor");
    router.replace(`/analytics?${next.toString()}`);
  };

  const quickRange = (days: number) => {
    const now = new Date();
    const from = new Date(Date.now() - days * 24 * 3600 * 1000);
    const next = new URLSearchParams(searchParams.toString());
    next.set("from", from.toISOString());
    next.set("to", now.toISOString());
    next.delete("cursor");
    router.replace(`/analytics?${next.toString()}`);
  };

  const onDelete = (id: string) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    startTransition(async () => {
      const res = await deleteEvent(id);
      if ("error" in res) {
        toast.error(res.error);
        setItems(initial.items);
      } else {
        toast.success("Удалено");
      }
    });
  };

  const canBulkDelete = Boolean(filters.to);

  const onBulkDelete = () => {
    if (!filters.to) return;
    if (!confirm("Удалить все записи, соответствующие фильтру?")) return;
    startTransition(async () => {
      const res = await bulkDeleteEvents({
        from: filters.from,
        to: filters.to!,
        kinds: filters.kinds,
        telegramUserId: filters.telegramUserId,
        q: filters.q,
      });
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success(`Удалено: ${res.deleted}`);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Фильтры</CardTitle>
          <CardDescription>
            Период по умолчанию — последние 7 дней. Для массового удаления нужно указать верхнюю границу периода.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => quickRange(1)}>
              24ч
            </Button>
            <Button variant="outline" size="sm" onClick={() => quickRange(7)}>
              7д
            </Button>
            <Button variant="outline" size="sm" onClick={() => quickRange(30)}>
              30д
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              placeholder="Telegram ID"
              defaultValue={filters.telegramUserId?.toString() ?? ""}
              onBlur={(e) => setQueryParam("telegramUserId", e.target.value || undefined)}
            />
            <Input
              placeholder="Поиск по payload"
              defaultValue={filters.q ?? ""}
              onBlur={(e) => setQueryParam("q", e.target.value || undefined)}
            />
            <Button
              variant="destructive"
              disabled={!canBulkDelete || pending}
              onClick={onBulkDelete}
              title={canBulkDelete ? undefined : "Установите верхнюю границу периода"}
            >
              Удалить все по фильтру
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {kinds.map((k) => {
              const active = activeKinds.has(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleKind(k)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    active ? "border-primary bg-primary text-primary-foreground" : "border-input text-foreground"
                  }`}
                >
                  {k}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">События</CardTitle>
          <CardDescription>{items.length} запис(и)</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {items.length === 0 ? (
              <li className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                Нет событий по выбранному фильтру
              </li>
            ) : null}
            {items.map((ev) => {
              const fam = kindFamily(ev.kind);
              const open = expanded === ev.id;
              const fullName = `${ev.actorFirstName ?? ""} ${ev.actorLastName ?? ""}`.trim();
              const actorName =
                fullName || (ev.telegramUserId ? `tg:${ev.telegramUserId}` : "anon");
              return (
                <li key={ev.id} className="rounded-md border">
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-muted/30"
                    onClick={() => setExpanded(open ? null : ev.id)}
                  >
                    <Badge className={FAMILY_COLOR[fam]}>{ev.kind}</Badge>
                    <div className="flex-1">
                      <div className="text-sm">
                        <span className="font-medium">{actorName}</span>
                        {ev.actorUsername ? (
                          <span className="ml-1 text-muted-foreground">@{ev.actorUsername}</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDate(ev.occurredAt)}
                        {ev.entityType ? ` · ${ev.entityType}` : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(ev.id);
                      }}
                      aria-label="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </button>
                  {open ? (
                    <pre className="overflow-x-auto rounded-b-md bg-muted/30 p-3 text-xs">
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {initial.nextCursor ? (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={() => setQueryParam("cursor", initial.nextCursor!)}
                disabled={pending}
              >
                Дальше →
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
