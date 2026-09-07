import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getServerSession } from "@sre-monorepo/lib/server";
import { resolveScreenshotPath } from "@/lib/storage";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { path: pathSegments } = await params;
  if (!pathSegments || pathSegments.some((segment) => segment.includes(".."))) {
    return NextResponse.json({ message: "Invalid path" }, { status: 400 });
  }

  const relativePath = pathSegments.join("/");

  try {
    const buffer = await readFile(resolveScreenshotPath(relativePath));
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return NextResponse.json({ message: "Screenshot not found" }, { status: 404 });
  }
}
