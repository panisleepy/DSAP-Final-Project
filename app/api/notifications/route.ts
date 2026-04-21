import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMockNotifications } from "@/lib/mock-data";
import { markNotificationsRead } from "@/lib/notifications";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        actor: { select: { id: true, name: true, alias: true } },
      },
    });

    return NextResponse.json(
      notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        postId: notification.postId,
        commentId: notification.commentId,
        actor: notification.actor ?? null,
        commentPreview: notification.commentPreview,
        createdAt: notification.createdAt.toISOString(),
        read: Boolean(notification.readAt),
      })),
    );
  } catch (error) {
    console.error("[notifications:get]", error);

    try {
      const fallback = getMockNotifications?.() ?? [];
      return NextResponse.json(fallback);
    } catch {
      return NextResponse.json([]);
    }
  }
}

const markSchema = z.object({
  ids: z.array(z.string()).optional(),
  read: z.boolean().default(true),
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = markSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { ids, read } = parsed.data;

  await markNotificationsRead(session.user.id, ids, read);

  return NextResponse.json({ ok: true });
}
