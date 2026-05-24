import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DAY_KEYS, type DayKey } from "@pokermap/types";
import { Badge } from "@pokermap/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@pokermap/ui/card";
import { Phone, Globe, Send, Instagram, Youtube } from "lucide-react";
import { getClubBySlug } from "@/lib/api/server";
import { OpenInMapsButton } from "@/components/OpenInMapsButton";

export const revalidate = 60;

const DAY_LABELS: Record<DayKey, string> = {
  mon: "Понедельник",
  tue: "Вторник",
  wed: "Среда",
  thu: "Четверг",
  fri: "Пятница",
  sat: "Суббота",
  sun: "Воскресенье",
};

const CLUB_TYPE_LABELS: Record<string, string> = {
  cash: "Кэш-игры",
  club: "Клуб",
  "mtt-series": "Турниры",
  "mafia-and-poker": "Мафия и покер",
  underground: "Подпольный",
};

function todayKey(): DayKey {
  const idx = new Date().getDay();
  const mapping: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return mapping[idx] ?? "mon";
}

function formatMoney(cents: number): string {
  return `${(cents / 100).toLocaleString("ru-RU")} ₽`;
}

function formatBuyIn(min: number | null | undefined, max: number | null | undefined): string {
  if (!min && !max) return "—";
  if (min && max) return `${formatMoney(min)} – ${formatMoney(max)}`;
  if (min) return `от ${formatMoney(min)}`;
  return `до ${formatMoney(max ?? 0)}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const club = await getClubBySlug(slug).catch(() => null);
  if (!club) return { title: "Клуб не найден — PokerMap" };
  return {
    title: `${club.name} — PokerMap`,
    description: club.address,
    openGraph: { title: club.name, description: club.address },
  };
}

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = await getClubBySlug(slug).catch(() => null);
  if (!club) notFound();

  const today = todayKey();
  const target = { lat: club.lat, lng: club.lng, name: club.name, address: club.address };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-6 md:pt-10">
      <Link href="/list" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← К списку клубов
      </Link>

      <Card className="mb-4">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="text-2xl">{club.name}</CardTitle>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline">{CLUB_TYPE_LABELS[club.clubType] ?? club.clubType}</Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{club.address}</p>
        </CardHeader>
        <CardContent>
          <OpenInMapsButton target={target} />
        </CardContent>
      </Card>

      {club.photoKeys.length > 0 ? (
        <Card className="mb-4">
          <CardContent className="p-3">
            <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1">
              {club.photoKeys.map((key) => (
                <div key={key} className="relative h-44 w-72 shrink-0 snap-start overflow-hidden rounded-lg bg-muted">
                  <Image
                    src={`/api/media/${encodeURI(key)}`}
                    alt={club.name}
                    fill
                    className="object-cover"
                    sizes="288px"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Контакты</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {club.phones.map((p) => (
            <a key={p} href={`tel:${p.replace(/\s+/g, "")}`} className="flex items-center gap-2 text-primary">
              <Phone className="h-4 w-4" aria-hidden /> {p}
            </a>
          ))}
          {club.website ? (
            <a href={club.website} target="_blank" rel="noopener" className="flex items-center gap-2 text-primary">
              <Globe className="h-4 w-4" aria-hidden /> {club.website.replace(/^https?:\/\//, "")}
            </a>
          ) : null}
          {club.telegramUrl ? (
            <a href={club.telegramUrl} target="_blank" rel="noopener" className="flex items-center gap-2 text-primary">
              <Send className="h-4 w-4" aria-hidden /> Telegram для связи
            </a>
          ) : null}
          {club.socialLinks?.telegramChannel ? (
            <a href={club.socialLinks.telegramChannel} target="_blank" rel="noopener" className="flex items-center gap-2 text-primary">
              <Send className="h-4 w-4" aria-hidden /> Telegram-канал
            </a>
          ) : null}
          {club.socialLinks?.vk ? (
            <a href={club.socialLinks.vk} target="_blank" rel="noopener" className="flex items-center gap-2 text-primary">
              VK
            </a>
          ) : null}
          {club.socialLinks?.instagram ? (
            <a href={club.socialLinks.instagram} target="_blank" rel="noopener" className="flex items-center gap-2 text-primary">
              <Instagram className="h-4 w-4" aria-hidden /> Instagram
            </a>
          ) : null}
          {club.socialLinks?.youtube ? (
            <a href={club.socialLinks.youtube} target="_blank" rel="noopener" className="flex items-center gap-2 text-primary">
              <Youtube className="h-4 w-4" aria-hidden /> YouTube
            </a>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Часы работы</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              {DAY_KEYS.map((d) => {
                const day = club.workingHours[d];
                const isToday = d === today;
                return (
                  <tr
                    key={d}
                    aria-current={isToday ? "date" : undefined}
                    className={isToday ? "bg-primary/10 font-medium" : ""}
                  >
                    <td className="py-1.5 pr-3">
                      {DAY_LABELS[d]}
                      {isToday ? <Badge className="ml-2" variant="secondary">Сегодня</Badge> : null}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {day.closed
                        ? "Закрыто"
                        : day.slots.map((s) => `${s.open}–${s.close}`).join(", ") || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Игра</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {club.games.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {club.games.map((g) => (
                <Badge key={g} variant="secondary">
                  {g}
                </Badge>
              ))}
            </div>
          ) : null}
          <div>
            <span className="text-muted-foreground">Бай-ин:</span>{" "}
            {formatBuyIn(club.minBuyInCents ?? null, club.maxBuyInCents ?? null)}
          </div>
          {club.entryFeeCents != null ? (
            <div>
              <span className="text-muted-foreground">Взнос:</span> {formatMoney(club.entryFeeCents)}
            </div>
          ) : null}
          {club.rakeDescription ? (
            <div>
              <span className="text-muted-foreground">Рейк:</span> {club.rakeDescription}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {club.description ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Описание</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm leading-6">{club.description}</CardContent>
        </Card>
      ) : null}
    </div>
  );
}
