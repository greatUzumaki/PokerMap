"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@pokermap/ui/button";
import { api } from "@/lib/api/client";
import { Trash2, Upload } from "lucide-react";

export function PhotoUploader({
  clubId,
  keys,
  onChange,
}: {
  clubId?: string | undefined;
  keys: string[];
  onChange: (next: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const onFile = useCallback(
    async (file: File) => {
      if (file.size > 8 * 1024 * 1024) {
        toast.error("Файл больше 8 МБ");
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast.error("Только JPEG/PNG/WEBP");
        return;
      }
      setUploading(true);
      try {
        const signed = await api.signUpload({ clubId, filename: file.name, mime: file.type, size: file.size });
        const put = await fetch(signed.url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!put.ok) throw new Error(`upload failed: ${put.status}`);
        onChange([...keys, signed.key]);
        toast.success("Загружено");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Не удалось загрузить");
      } finally {
        setUploading(false);
      }
    },
    [clubId, keys, onChange],
  );

  return (
    <div className="mt-1 flex flex-col gap-2">
      <label className="flex h-32 w-full cursor-pointer items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        <Upload className="mr-2 h-4 w-4" aria-hidden />
        {uploading ? "Загружаем…" : "Нажмите, чтобы выбрать файл"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
      </label>
      {keys.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {keys.map((k) => (
            <li key={k} className="relative">
              <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/media/${encodeURI(k)}`} alt="" className="aspect-video w-full rounded-md object-cover" />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7"
                onClick={() => onChange(keys.filter((x) => x !== k))}
                aria-label="Удалить"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
