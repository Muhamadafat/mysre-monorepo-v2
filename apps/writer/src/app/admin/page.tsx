import { redirect } from "next/navigation";

/** The research dashboard moved to /penelitian; keep old /admin links working. */
export default function OldAdminPage() {
  redirect("/penelitian");
}
