import { publicEnv } from "@/lib/env";

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold">{publicEnv.NEXT_PUBLIC_APP_NAME}</h1>
      <p className="mb-3 leading-7 text-muted-foreground">
        Карта живых покер-клубов в Санкт-Петербурге. Откройте бот в Telegram, чтобы получить полный доступ.
      </p>
      <p className="mb-3 leading-7">
        По вопросам и предложениям:{" "}
        <a className="text-primary" href={publicEnv.NEXT_PUBLIC_SUPPORT_TG} target="_blank" rel="noopener">
          поддержка
        </a>
        .
      </p>
      <hr className="my-6" />
      <p className="text-xs text-muted-foreground">
        Карта построена на данных © участники{" "}
        <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">
          OpenStreetMap
        </a>
        .
      </p>
    </div>
  );
}
