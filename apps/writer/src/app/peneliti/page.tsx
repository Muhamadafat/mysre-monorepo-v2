import { redirect } from "next/navigation";

/** The research dashboard is now /penelitian; keep old /peneliti links working. */
export default function PenelitiRedirect() {
  redirect("/penelitian");
}
