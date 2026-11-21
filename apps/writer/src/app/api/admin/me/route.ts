import { NextResponse } from "next/server";
import { adminUsername, isAdmin } from "@/lib/adminAuth";

export async function GET() {
  return NextResponse.json({ loggedIn: await isAdmin(), username: (await isAdmin()) ? adminUsername() : null });
}
