"use client";

import type { SocialLinks } from "@pokermap/types";
import { Input } from "@pokermap/ui/input";
import { Label } from "@pokermap/ui/label";

export interface SocialsEditorProps {
  value: SocialLinks;
  onChange: (next: SocialLinks) => void;
  errors?: Partial<Record<keyof SocialLinks, string>>;
}

const FIELDS: { key: keyof SocialLinks; label: string; placeholder: string }[] = [
  { key: "vk", label: "ВКонтакте", placeholder: "https://vk.com/..." },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/..." },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@..." },
  { key: "telegramChannel", label: "Telegram-канал", placeholder: "https://t.me/..." },
];

export function SocialsEditor({ value, onChange, errors }: SocialsEditorProps) {
  const setField = (key: keyof SocialLinks, raw: string) => {
    const trimmed = raw.trim();
    const next: SocialLinks = { ...value };
    if (trimmed === "") {
      delete next[key];
    } else {
      next[key] = trimmed;
    }
    onChange(next);
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <Label htmlFor={`social-${f.key}`}>{f.label}</Label>
          <Input
            id={`social-${f.key}`}
            type="url"
            placeholder={f.placeholder}
            value={value[f.key] ?? ""}
            onChange={(e) => setField(f.key, e.target.value)}
          />
          {errors?.[f.key] ? <p className="mt-1 text-xs text-destructive">{errors[f.key]}</p> : null}
        </div>
      ))}
    </div>
  );
}
