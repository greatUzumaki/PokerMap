import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminClub } from "@/lib/api/server";
import { archiveClub, transitionStatus, updateClub, type ActionState } from "@/app/actions";
import { ClubForm } from "../_form/ClubForm";
import { Button } from "@pokermap/ui/button";

export const dynamic = "force-dynamic";

export default async function EditClubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const club = await getAdminClub(id);
  if (!club) notFound();

  const update = async (state: ActionState | undefined, formData: FormData) => {
    "use server";
    return updateClub(id, state, formData);
  };
  const publish = async () => {
    "use server";
    await transitionStatus(id, "published");
  };
  const draft = async () => {
    "use server";
    await transitionStatus(id, "draft");
  };
  const archive = async () => {
    "use server";
    await archiveClub(id);
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{club.name}</h1>
          <p className="text-sm text-muted-foreground">{club.slug}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={draft}>
            <Button variant="outline" type="submit" disabled={club.status === "draft"}>
              В черновик
            </Button>
          </form>
          <form action={publish}>
            <Button type="submit" disabled={club.status === "published"}>
              Опубликовать
            </Button>
          </form>
          <form action={archive}>
            <Button variant="destructive" type="submit" disabled={club.status === "archived"}>
              В архив
            </Button>
          </form>
          <Button asChild variant="ghost">
            <Link href={`/clubs/${id}/history`}>История</Link>
          </Button>
        </div>
      </div>
      <ClubForm initial={club} action={update} />
    </section>
  );
}
