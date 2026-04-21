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

  const existing = await db.collection("Repost").findOne({ postId: postObjectId, userId: userObjectId });

  if (!existing) {
    const now = new Date();
    await db.collection("Repost").insertOne({
      postId: postObjectId,
      userId: userObjectId,
      originalPostId: postObjectId,
      createdAt: now,
    });

    if (post.authorId !== userId) {
      const notification = await createNotification({
        userId: post.authorId,
        actorId: userId,
        postId,
        type: "repost",
      });

      await pusherServer
        .trigger(`user-${post.authorId}`, "notification:received", {
          notificationId: notification.id,
          type: "repost",
          postId,
          actor: session?.user
            ? {
                id: userId,
                alias: session.user.alias,
                name: session.user.name,
              }
            : undefined,
          createdAt: notification.createdAt.toISOString(),
        })
        .catch((error) => console.error("Failed to emit notification event", error));
    }
  }

  const count = await db.collection("Repost").countDocuments({ postId: postObjectId });

  await pusherServer
    .trigger(`post-${postId}`, "post:reposted", { postId, userId, count })
    .catch((error) => console.error("Failed to emit repost event", error));

  return NextResponse.json({ reposted: true, count });
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

  await db.collection("Repost").deleteMany({ postId: postObjectId, userId: userObjectId });
  const count = await db.collection("Repost").countDocuments({ postId: postObjectId });

  if (post.authorId !== userId) {
    await deleteNotifications({
      userId: post.authorId,
      actorId: userId,
      postId,
      type: "repost",
    });
  }

  await pusherServer
    .trigger(`post-${postId}`, "post:unreposted", { postId, userId, count })
    .catch((error) => console.error("Failed to emit unrepost event", error));

  return NextResponse.json({ reposted: false, count });
}
