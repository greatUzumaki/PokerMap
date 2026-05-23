import { ClubForm } from "../_form/ClubForm";
import { createClub } from "@/app/actions";

export default function NewClubPage() {
  return (
    <section>
      <h1 className="mb-4 text-lg font-semibold">Новый клуб</h1>
      <ClubForm initial={null} action={createClub} />
    </section>
  );
}
