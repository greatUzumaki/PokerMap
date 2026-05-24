import { Send } from "lucide-react";
import { publicEnv } from "@/lib/env";
import { Separator } from "@pokermap/ui/separator";

export default function AboutPage() {
  return (
    <div className="min-h-app bg-background">
      <div className="mx-auto w-full max-w-xl px-6 pb-32 pt-12 md:pt-20">
        <div className="mb-10 flex flex-col items-start gap-3">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            beta · Санкт-Петербург
          </span>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {publicEnv.NEXT_PUBLIC_APP_NAME}
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            Карта живых покер-клубов Петербурга. Открывайте бот в Telegram, чтобы получить полный
            доступ к фильтрам и расписаниям.
          </p>
        </div>

        <a
          href={publicEnv.NEXT_PUBLIC_SUPPORT_TG}
          target="_blank"
          rel="noopener"
          className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Send className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          Связаться с нами
        </a>

        <Separator className="my-10" />

        <dl className="grid grid-cols-1 gap-6 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Города</dt>
            <dd className="mt-1 font-medium">Санкт-Петербург</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Источник</dt>
            <dd className="mt-1 font-medium">OpenStreetMap</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Версия</dt>
            <dd className="mt-1 font-medium">0.1</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
