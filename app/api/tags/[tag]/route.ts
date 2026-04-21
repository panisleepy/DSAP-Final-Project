import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { buildTimeline, serializeTimelineEntry } from "@/lib/timeline";

export async function GET(request: Request, { params }: { params: Promise<{ tag: string }> }) {
  const session = await auth();
  const { tag } = await params;
  const normalized = decodeURIComponent(tag).toLowerCase();

  if (!normalized) {
    return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  }

  const timeline = await buildTimeline({ viewerId: session?.user?.id, scope: 'all', hashtag: normalized });
  return NextResponse.json(timeline.map(serializeTimelineEntry));
}
