import { redirect } from "next/navigation";

/* ADR-028 — one consolidated sign-in for the whole platform. */
export default function Page() {
  redirect("/login");
}
