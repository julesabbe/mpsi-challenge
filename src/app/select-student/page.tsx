import { redirect } from "next/navigation";

export const metadata = { title: "Inscription — MPSI Challenge" };

/** Ancien flux anonyme remplacé par /register. */
export default function SelectStudentPage() {
  redirect("/register");
}
