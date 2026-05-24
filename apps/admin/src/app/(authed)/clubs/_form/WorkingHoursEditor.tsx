"use client";

import { useId } from "react";
import type { DayKey, WorkingDay, WorkingHours } from "@pokermap/types";
import { DAY_KEYS } from "@pokermap/types";
import { Button } from "@pokermap/ui/button";
import { Label } from "@pokermap/ui/label";
import { Switch } from "@pokermap/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@pokermap/ui/dropdown-menu";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";

const DAY_LABELS: Record<DayKey, string> = {
  mon: "Пн",
  tue: "Вт",
  wed: "Ср",
  thu: "Чт",
  fri: "Пт",
  sat: "Сб",
  sun: "Вс",
};

const WEEKDAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

export interface WorkingHoursEditorProps {
  value: WorkingHours;
  onChange: (next: WorkingHours) => void;
  error?: string | undefined;
}

function patchDay(value: WorkingHours, day: DayKey, patch: WorkingDay): WorkingHours {
  return { ...value, [day]: patch };
}

export function WorkingHoursEditor({ value, onChange, error }: WorkingHoursEditorProps) {
  const errorId = useId();

  const updateDay = (day: DayKey, patch: WorkingDay) => {
    onChange(patchDay(value, day, patch));
  };

  const copyToWeekdays = (source: DayKey) => {
    const next: WorkingHours = { ...value };
    for (const d of WEEKDAY_KEYS) next[d] = clone(value[source]);
    onChange(next);
  };

  const copyToAll = (source: DayKey) => {
    const next: WorkingHours = { ...value };
    for (const d of DAY_KEYS) next[d] = clone(value[source]);
    onChange(next);
  };

  return (
    <div className="grid gap-2">
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <ul className="grid gap-2">
        {DAY_KEYS.map((d) => (
          <DayRow
            key={d}
            day={d}
            value={value[d]}
            onChange={(patch) => updateDay(d, patch)}
            onCopyToWeekdays={() => copyToWeekdays(d)}
            onCopyToAll={() => copyToAll(d)}
          />
        ))}
      </ul>
    </div>
  );
}

function DayRow({
  day,
  value,
  onChange,
  onCopyToWeekdays,
  onCopyToAll,
}: {
  day: DayKey;
  value: WorkingDay;
  onChange: (next: WorkingDay) => void;
  onCopyToWeekdays: () => void;
  onCopyToAll: () => void;
}) {
  const toggleClosed = (closed: boolean) => {
    onChange(closed ? { closed: true, slots: [] } : { closed: false, slots: value.slots.length ? value.slots : [{ open: "18:00", close: "06:00" }] });
  };

  const addSlot = () => {
    onChange({ closed: false, slots: [...value.slots, { open: "18:00", close: "06:00" }] });
  };

  const removeSlot = (i: number) => {
    const slots = value.slots.filter((_, idx) => idx !== i);
    onChange({ closed: false, slots });
  };

  const updateSlot = (i: number, key: "open" | "close", time: string) => {
    const slots = value.slots.map((s, idx) => (idx === i ? { ...s, [key]: time } : s));
    onChange({ closed: false, slots });
  };

  return (
    <li className="grid grid-cols-[3rem_auto_1fr_2.25rem] items-center gap-2 rounded-md border border-input bg-card/40 p-2">
      <Label className="text-sm font-medium" htmlFor={`day-${day}-state`}>
        {DAY_LABELS[day]}
      </Label>
      <div className="flex items-center gap-2">
        <Switch
          id={`day-${day}-state`}
          checked={!value.closed}
          onCheckedChange={(open) => toggleClosed(!open)}
          label={value.closed ? `${DAY_LABELS[day]}: закрыто` : `${DAY_LABELS[day]}: открыто`}
        />
        <span className="text-xs text-muted-foreground">{value.closed ? "Закрыто" : "Открыто"}</span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {!value.closed
          ? value.slots.map((s, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  type="time"
                  value={s.open}
                  onChange={(e) => updateSlot(i, "open", e.target.value)}
                  className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
                  aria-label={`${DAY_LABELS[day]} слот ${i + 1}: открытие`}
                />
                <span className="text-muted-foreground">–</span>
                <input
                  type="time"
                  value={s.close}
                  onChange={(e) => updateSlot(i, "close", e.target.value)}
                  className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
                  aria-label={`${DAY_LABELS[day]} слот ${i + 1}: закрытие`}
                />
                {value.slots.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeSlot(i)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Удалить слот ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))
          : <span className="text-xs text-muted-foreground">—</span>}
        {!value.closed && value.slots.length < 4 ? (
          <Button type="button" variant="outline" size="sm" onClick={addSlot}>
            <Plus className="h-3.5 w-3.5" /> Слот
          </Button>
        ) : null}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`Действия для ${DAY_LABELS[day]}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onCopyToWeekdays}>Скопировать в Пн–Пт</DropdownMenuItem>
          <DropdownMenuItem onClick={onCopyToAll}>Скопировать на все дни</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onChange({ closed: true, slots: [] })}>
            Закрыть весь день
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function clone(day: WorkingDay): WorkingDay {
  return { closed: day.closed, slots: day.slots.map((s) => ({ ...s })) };
}
