"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { ClubType, Game } from "@pokermap/types";
import { Badge } from "@pokermap/ui/badge";
import { Button } from "@pokermap/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@pokermap/ui/sheet";
import { Switch } from "@pokermap/ui/switch";
import { RangeSlider } from "@pokermap/ui/slider";
import {
  BUY_IN_MAX,
  BUY_IN_MIN,
  GAME_FILTER_VALUES,
  TYPE_FILTER_VALUES,
  defaultFilters,
  useClubFilters,
  type ClubFilters,
} from "@/hooks/useClubFilters";
import { track } from "@/lib/track";

const GAME_LABELS: Record<Game, string> = {
  NLH: "NLH",
  PLO: "PLO",
  PLO5: "PLO5",
  MTT: "MTT",
  SnG: "SnG",
  Mixed: "Mixed",
  Other: "Other",
};

const TYPE_LABELS: Record<ClubType, string> = {
  cash: "Кэш",
  club: "Клуб",
  "mtt-series": "Турниры",
  "mafia-and-poker": "Мафия+покер",
  underground: "Подпольный",
};

function formatRub(cents: number): string {
  return `${(cents / 100).toLocaleString("ru-RU")} ₽`;
}

export function MapFilters() {
  const { filters, setFilters, resetFilters, activeCount } = useClubFilters();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ClubFilters>(filters);

  const openSheet = (next: boolean) => {
    if (next) setDraft(filters);
    setOpen(next);
  };

  const toggleGame = (g: Game) => {
    setDraft((d) => ({
      ...d,
      games: d.games.includes(g) ? d.games.filter((x) => x !== g) : [...d.games, g],
    }));
  };
  const toggleType = (t: ClubType) => {
    setDraft((d) => ({
      ...d,
      types: d.types.includes(t) ? d.types.filter((x) => x !== t) : [...d.types, t],
    }));
  };

  const lo = draft.minBuyIn ?? BUY_IN_MIN;
  const hi = draft.maxBuyIn ?? BUY_IN_MAX;

  const apply = () => {
    setFilters(draft);
    track("web.filter_apply", {
      openNow: draft.openNow,
      games: draft.games,
      types: draft.types,
      minBuyIn: draft.minBuyIn,
      maxBuyIn: draft.maxBuyIn,
    });
    setOpen(false);
  };
  const reset = () => {
    setDraft(defaultFilters);
    resetFilters();
    track("web.filter_reset");
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={openSheet}>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          size="lg"
          className="pointer-events-auto fixed left-1/2 z-30 -translate-x-1/2 gap-2 rounded-full shadow-lg top-[calc(env(safe-area-inset-top,0px)+var(--tg-inset-top,1rem))]"
          aria-label="Открыть фильтры"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Фильтры
          {activeCount > 0 ? (
            <Badge variant="default" className="ml-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1.5rem)]"
      >
        <SheetHeader>
          <SheetTitle>Фильтры</SheetTitle>
          <SheetDescription>Выберите параметры, чтобы сузить список клубов.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-6">
          <div className="flex items-center justify-between">
            <label htmlFor="open-now" className="text-sm font-medium">
              Открыто сейчас
            </label>
            <Switch
              id="open-now"
              checked={draft.openNow}
              onCheckedChange={(checked) => setDraft((d) => ({ ...d, openNow: checked }))}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Игры</p>
            <div className="flex flex-wrap gap-2">
              {GAME_FILTER_VALUES.map((g) => {
                const active = draft.games.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGame(g)}
                    className={`rounded-full border px-3 py-1 text-xs ${active ? "border-primary bg-primary text-primary-foreground" : "border-input text-foreground"}`}
                  >
                    {GAME_LABELS[g]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Тип клуба</p>
            <div className="flex flex-wrap gap-2">
              {TYPE_FILTER_VALUES.map((t) => {
                const active = draft.types.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    className={`rounded-full border px-3 py-1 text-xs ${active ? "border-primary bg-primary text-primary-foreground" : "border-input text-foreground"}`}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Бай-ин</p>
            <RangeSlider
              min={BUY_IN_MIN}
              max={BUY_IN_MAX}
              step={50000}
              value={[lo, hi]}
              onValueChange={([nlo, nhi]) =>
                setDraft((d) => ({
                  ...d,
                  minBuyIn: nlo === BUY_IN_MIN ? null : nlo,
                  maxBuyIn: nhi === BUY_IN_MAX ? null : nhi,
                }))
              }
              formatValue={formatRub}
            />
          </div>
        </div>

        <SheetFooter className="mt-8 gap-2">
          <Button variant="outline" onClick={reset} className="w-full">
            Сбросить
          </Button>
          <Button onClick={apply} className="w-full">
            Готово
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
