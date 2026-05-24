"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Club, ClubType, SocialLinks, WorkingHours } from "@pokermap/types";
import { defaultWorkingHours } from "@pokermap/types";
import { Button } from "@pokermap/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pokermap/ui/card";
import { Input } from "@pokermap/ui/input";
import { Label } from "@pokermap/ui/label";
import { Textarea } from "@pokermap/ui/textarea";
import { type ActionState } from "@/app/actions";
import { GeoPicker } from "./GeoPicker";
import { PhotoUploader } from "./PhotoUploader";
import { WorkingHoursEditor } from "./WorkingHoursEditor";
import { SocialsEditor } from "./SocialsEditor";

type Action = (state: ActionState | undefined, formData: FormData) => Promise<ActionState>;

const GAME_OPTIONS = ["NLH", "PLO", "PLO5", "MTT", "SnG", "Mixed", "Other"] as const;

const CLUB_TYPE_OPTIONS: { value: ClubType; label: string }[] = [
  { value: "cash", label: "Кэш" },
  { value: "club", label: "Клуб" },
  { value: "mtt-series", label: "Турнирная серия" },
  { value: "mafia-and-poker", label: "Мафия и покер" },
  { value: "underground", label: "Подпольный" },
];

export function ClubForm({ initial, action }: { initial: Club | null; action: Action }) {
  const [state, formAction] = useActionState<ActionState | undefined, FormData>(action, undefined);
  const [lat, setLat] = useState<number>(initial?.lat ?? 59.9343);
  const [lng, setLng] = useState<number>(initial?.lng ?? 30.3351);
  const [photoKeys, setPhotoKeys] = useState<string[]>(initial?.photoKeys ?? []);
  const [games, setGames] = useState<string[]>(initial?.games ?? []);
  const [hours, setHours] = useState<WorkingHours>(
    initial?.workingHours && Object.keys(initial.workingHours).length > 0
      ? initial.workingHours
      : defaultWorkingHours(),
  );
  const [socials, setSocials] = useState<SocialLinks>(initial?.socialLinks ?? {});

  const fieldErr = (field: string): string | undefined =>
    state && !state.ok ? state.fields?.[field] : undefined;

  return (
    <form action={formAction} className="grid gap-4">
      {state && !state.ok ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}
        </div>
      ) : null}

      <Section title="Основное">
        <Row label="Название" name="name" defaultValue={initial?.name ?? ""} required error={fieldErr("name")} />
        <Row label="Slug (kebab-case)" name="slug" defaultValue={initial?.slug ?? ""} required error={fieldErr("slug")} />
        <div>
          <Label htmlFor="clubType">Тип клуба</Label>
          <select
            id="clubType"
            name="clubType"
            defaultValue={initial?.clubType ?? "cash"}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {CLUB_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {fieldErr("clubType") ? <p className="mt-1 text-xs text-destructive">{fieldErr("clubType")}</p> : null}
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
      </Section>

      <Section title="Локация">
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
      </Section>

      <Section title="Контакты">
        <Row label="Телефоны (через запятую)" name="phones" defaultValue={initial?.phones.join(", ") ?? ""} />
        <Row label="Сайт" name="website" defaultValue={initial?.website ?? ""} type="url" error={fieldErr("website")} />
        <Row label="Telegram для связи" name="telegramUrl" defaultValue={initial?.telegramUrl ?? ""} type="url" error={fieldErr("telegramUrl")} />
        <div>
          <Label>Соцсети</Label>
          <input type="hidden" name="socialLinks" value={JSON.stringify(socials)} />
          <div className="mt-1">
            <SocialsEditor value={socials} onChange={setSocials} />
          </div>
        </div>
      </Section>

      <Section title="Игра">
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
        <div className="grid gap-2 md:grid-cols-3">
          <div>
            <Label htmlFor="minBuyInCents">Мин. бай-ин (копейки)</Label>
            <Input id="minBuyInCents" name="minBuyInCents" type="number" min="0" defaultValue={initial?.minBuyInCents ?? ""} />
          </div>
          <div>
            <Label htmlFor="maxBuyInCents">Макс. бай-ин (копейки)</Label>
            <Input id="maxBuyInCents" name="maxBuyInCents" type="number" min="0" defaultValue={initial?.maxBuyInCents ?? ""} />
          </div>
          <div>
            <Label htmlFor="entryFeeCents">Взнос (копейки)</Label>
            <Input id="entryFeeCents" name="entryFeeCents" type="number" min="0" defaultValue={initial?.entryFeeCents ?? ""} />
            {fieldErr("entryFeeCents") ? <p className="mt-1 text-xs text-destructive">{fieldErr("entryFeeCents")}</p> : null}
          </div>
        </div>
        <Row label="Рейк" name="rakeDescription" defaultValue={initial?.rakeDescription ?? ""} />
      </Section>

      <Section title="Расписание">
        <input type="hidden" name="workingHours" value={JSON.stringify(hours)} />
        <WorkingHoursEditor value={hours} onChange={setHours} error={fieldErr("workingHours")} />
      </Section>

      <Section title="Описание">
        <div>
          <Label htmlFor="description">Описание</Label>
          <Textarea id="description" name="description" defaultValue={initial?.description ?? ""} rows={6} />
        </div>
      </Section>

      <Section title="Фотографии">
        <input type="hidden" name="photoKeys" value={photoKeys.join(",")} />
        <PhotoUploader clubId={initial?.id} keys={photoKeys} onChange={setPhotoKeys} />
      </Section>

      <Submit />
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">{children}</CardContent>
    </Card>
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
