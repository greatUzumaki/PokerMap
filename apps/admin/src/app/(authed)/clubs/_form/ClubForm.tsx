"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Club } from "@pokermap/types";
import { Button } from "@pokermap/ui/button";
import { Input } from "@pokermap/ui/input";
import { Label } from "@pokermap/ui/label";
import { Textarea } from "@pokermap/ui/textarea";
import { type ActionState } from "@/app/actions";
import { GeoPicker } from "./GeoPicker";
import { PhotoUploader } from "./PhotoUploader";

type Action = (state: ActionState | undefined, formData: FormData) => Promise<ActionState>;

const GAME_OPTIONS = ["NLH", "PLO", "PLO5", "MTT", "SnG", "Mixed", "Other"] as const;

function defaultWorkingHours() {
  const day = { closed: false, slots: [{ open: "18:00", close: "06:00" }] };
  return JSON.stringify({ mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day }, null, 2);
}

export function ClubForm({ initial, action }: { initial: Club | null; action: Action }) {
  const [state, formAction] = useActionState<ActionState | undefined, FormData>(action, undefined);
  const [lat, setLat] = useState<number>(initial?.lat ?? 59.9343);
  const [lng, setLng] = useState<number>(initial?.lng ?? 30.3351);
  const [photoKeys, setPhotoKeys] = useState<string[]>(initial?.photoKeys ?? []);
  const [games, setGames] = useState<string[]>(initial?.games ?? []);

  const fieldErr = (field: string): string | undefined =>
    state && !state.ok ? state.fields?.[field] : undefined;

  return (
    <form action={formAction} className="grid gap-4">
      {state && !state.ok ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}
        </div>
      ) : null}

      <Row label="Название" name="name" defaultValue={initial?.name ?? ""} required error={fieldErr("name")} />
      <Row label="Slug (kebab-case)" name="slug" defaultValue={initial?.slug ?? ""} required error={fieldErr("slug")} />
      <Row label="Адрес" name="address" defaultValue={initial?.address ?? ""} required error={fieldErr("address")} />

      <div>
        <Label>Координаты</Label>
        <div className="mt-1 grid gap-2 md:grid-cols-2">
          <Input name="lat" value={lat} onChange={(e) => setLat(parseFloat(e.target.value) || 0)} aria-label="Широта" />
          <Input name="lng" value={lng} onChange={(e) => setLng(parseFloat(e.target.value) || 0)} aria-label="Долгота" />
        </div>
        <div className="mt-2 h-64 overflow-hidden rounded-md border">
          <GeoPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln); }} />
        </div>
        {(fieldErr("lat") || fieldErr("lng")) && (
          <p className="mt-1 text-xs text-destructive">{fieldErr("lat") ?? fieldErr("lng")}</p>
        )}
      </div>

      <div>
        <Label htmlFor="description">Описание</Label>
        <Textarea id="description" name="description" defaultValue={initial?.description ?? ""} rows={6} />
      </div>

      <Row label="Телефоны (через запятую)" name="phones" defaultValue={initial?.phones.join(", ") ?? ""} />
      <Row label="Сайт" name="website" defaultValue={initial?.website ?? ""} type="url" error={fieldErr("website")} />
      <Row label="Telegram" name="telegramUrl" defaultValue={initial?.telegramUrl ?? ""} type="url" error={fieldErr("telegramUrl")} />

      <div>
        <Label>Игры</Label>
        <input type="hidden" name="games" value={games.join(",")} />
        <div className="mt-1 flex flex-wrap gap-2">
          {GAME_OPTIONS.map((g) => {
            const active = games.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => setGames((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))}
                className={`rounded-full border px-3 py-1 text-xs ${active ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <Label htmlFor="minBuyInCents">Мин. бай-ин (копейки)</Label>
          <Input id="minBuyInCents" name="minBuyInCents" type="number" defaultValue={initial?.minBuyInCents ?? ""} />
        </div>
        <div>
          <Label htmlFor="maxBuyInCents">Макс. бай-ин (копейки)</Label>
          <Input id="maxBuyInCents" name="maxBuyInCents" type="number" defaultValue={initial?.maxBuyInCents ?? ""} />
        </div>
      </div>

      <Row label="Рейк" name="rakeDescription" defaultValue={initial?.rakeDescription ?? ""} />

      <div>
        <Label htmlFor="workingHours">Часы работы (JSON)</Label>
        <Textarea
          id="workingHours"
          name="workingHours"
          rows={10}
          defaultValue={initial?.workingHours ? JSON.stringify(initial.workingHours, null, 2) : defaultWorkingHours()}
          className="font-mono text-xs"
        />
      </div>

      <div>
        <Label>Фотографии</Label>
        <input type="hidden" name="photoKeys" value={photoKeys.join(",")} />
        <PhotoUploader clubId={initial?.id} keys={photoKeys} onChange={setPhotoKeys} />
      </div>

      <div>
        <Label htmlFor="status">Статус</Label>
        <select
          id="status"
          name="status"
          defaultValue={initial?.status ?? "draft"}
          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="draft">draft</option>
          <option value="published">published</option>
          <option value="archived">archived</option>
        </select>
      </div>

      <Submit />
    </form>
  );
}

function Row({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  error,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string | undefined;
  required?: boolean | undefined;
  error?: string | undefined;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} />
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Сохраняем…" : "Сохранить"}
    </Button>
  );
}
