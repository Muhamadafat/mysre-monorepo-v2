import { redirect } from "next/navigation";

/** The research dashboard moved to /peneliti; keep old /admin links working. */
export default function OldAdminPage() {
  redirect("/peneliti");
}
