import { redirect } from "next/navigation";

/* Founder directive: the platform root goes STRAIGHT to sign-in — no hub stop.
   The consolidated /login carries the brand billboard; each account lands where
   its roles point after sign-in (ADR-028). */
export default function Home() {
  redirect("/login");
}
