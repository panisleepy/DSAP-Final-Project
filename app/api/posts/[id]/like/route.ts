import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server";
import { createNotification, deleteNotifications } from "@/lib/notifications";
import { ensureObjectId, getDb } from "@/lib/mongo";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId } = await params;
  const post = await prisma.post.findUnique({
    where: { id: postId, deletedAt: null },
    select: { id: true, authorId: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const db = await getDb();
  const postObjectId = ensureObjectId(postId);
  const userObjectId = ensureObjectId(userId);

  const existing = await db.collection("Like").findOne({ postId: postObjectId, userId: userObjectId });

  let notificationId: string | undefined;
  let notificationCreatedAt: Date | undefined;

  if (!existing) {
    const now = new Date();
    await db.collection("Like").insertOne({
      postId: postObjectId,
      userId: userObjectId,
      createdAt: now,
    });

    if (post.authorId !== userId) {
      const notification = await createNotification({
        userId: post.authorId,
        actorId: userId,
        postId,
        type: "like",
      });
      notificationId = notification.id;
      notificationCreatedAt = notification.createdAt;
    }
  }

  const count = await db.collection("Like").countDocuments({ postId: postObjectId });

  await pusherServer
    .trigger(`post-${postId}`, "post:liked", { postId, userId, count })
    .catch((error) => console.error("Failed to emit like event", error));

  if (post.authorId !== userId && notificationId) {
    await pusherServer
      .trigger(`user-${post.authorId}`, "notification:received", {
        notificationId,
        type: "like",
        postId,
        actor: session?.user
          ? {
              id: userId,
              alias: session.user.alias,
              name: session.user.name,
            }
          : undefined,
        count,
        createdAt: notificationCreatedAt?.toISOString(),
      })
      .catch((error) => console.error("Failed to emit notification event", error));
  }

  return NextResponse.json({ liked: true, count });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId } = await params;
  const post = await prisma.post.findUnique({
    where: { id: postId, deletedAt: null },
    select: { id: true, authorId: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const db = await getDb();
  const postObjectId = ensureObjectId(postId);
  const userObjectId = ensureObjectId(userId);

  await db.collection("Like").deleteMany({ postId: postObjectId, userId: userObjectId });
  const count = await db.collection("Like").countDocuments({ postId: postObjectId });

  if (post.authorId !== userId) {
    await deleteNotifications({
      userId: post.authorId,
      actorId: userId,
      postId,
      type: "like",
    });
  }

  await pusherServer
    .trigger(`post-${postId}`, "post:unliked", { postId, userId, count })
    .catch((error) => console.error("Failed to emit unlike event", error));

  return NextResponse.json({ liked: false, count });
}
