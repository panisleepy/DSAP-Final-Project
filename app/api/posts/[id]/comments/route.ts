import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server";
import { measureTweetLength } from "@/lib/text-counter";
import { extractMentions } from "@/lib/mentions";
import { createNotification, dispatchMentionNotifications } from "@/lib/notifications";
import { ensureObjectId, getDb } from "@/lib/mongo";

const commentSchema = z.object({
  content: z.string().min(1).max(2000),
  parentCommentId: z.string().optional(),
});

const mapComment = (comment: {
  id: string;
  content: string;
  createdAt: Date;
  parentCommentId: string | null;
  postId: string;
  rootPostId: string;
  author: { id: string; name: string | null; image: string | null; alias: string };
}) => ({
  id: comment.id,
  content: comment.content,
  createdAt: comment.createdAt.toISOString(),
  parentCommentId: comment.parentCommentId,
  postId: comment.postId,
  rootPostId: comment.rootPostId,
  author: comment.author,
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = await params;
  const comments = await prisma.comment.findMany({
    where: { postId, deletedAt: null },
    include: {
      author: { select: { id: true, name: true, image: true, alias: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(comments.map(mapComment));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = session.user!;

  const { id: postId } = await params;

  const post = await prisma.post.findUnique({
    where: { id: postId, deletedAt: null },
    select: { id: true, authorId: true, rootPostId: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { content, parentCommentId } = parsed.data;
  const { isValid } = measureTweetLength(content);
  if (!isValid) {
    return NextResponse.json({ error: "Content exceeds 2000 character limit" }, { status: 422 });
  }

  const db = await getDb();
  const now = new Date();
  const postObjectId = ensureObjectId(postId);
  const parentObjectId = parentCommentId ? ensureObjectId(parentCommentId) : null;
  const rootObjectId = ensureObjectId(post.rootPostId ?? post.id);

  const insertResult = await db.collection("Comment").insertOne({
    content,
    authorId: ensureObjectId(userId),
    postId: postObjectId,
    parentCommentId: parentObjectId,
    rootPostId: rootObjectId,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("Post").updateOne({ _id: postObjectId }, { $set: { updatedAt: now } });

  const comment = await prisma.comment.findUnique({
    where: { id: insertResult.insertedId.toHexString() },
    include: {
      author: { select: { id: true, name: true, image: true, alias: true } },
    },
  });

  if (!comment) {
    return NextResponse.json({ error: "Failed to load created comment" }, { status: 500 });
  }

  const count = await db.collection("Comment").countDocuments({ postId: postObjectId, deletedAt: null });
  const commentPayload = mapComment(comment);

  let notificationId: string | undefined;
  let notificationCreatedAt: Date | undefined;

  if (post.authorId !== userId) {
    const notification = await createNotification({
      userId: post.authorId,
      actorId: userId,
      postId,
      commentId: comment.id,
      type: "comment",
      commentPreview: comment.content.slice(0, 140),
    });
    notificationId = notification.id;
    notificationCreatedAt = notification.createdAt;
  }

  await pusherServer
    .trigger(`post-${postId}`, "comment:created", {
      postId,
      comment: commentPayload,
      count,
    })
    .catch((error) => console.error("Failed to emit comment event", error));

  if (post.authorId !== userId && notificationId) {
    await pusherServer
      .trigger(`user-${post.authorId}`, "notification:received", {
        notificationId,
        type: "comment",
        postId,
        actor: {
          id: actor.id,
          alias: actor.alias,
          name: actor.name,
        },
        comment: commentPayload,
        count,
        createdAt: notificationCreatedAt?.toISOString(),
      })
      .catch((error) => console.error("Failed to emit notification event", error));
  }

  const mentionAliases = extractMentions(content);
  if (mentionAliases.length > 0) {
    const mentionUsers = await prisma.user.findMany({
      where: {
        OR: mentionAliases.map((alias) => ({ alias: { equals: alias, mode: "insensitive" as const } })),
      },
      select: { id: true, alias: true, name: true },
    });

    const uniqueMentions = new Map<string, (typeof mentionUsers)[number]>();
    mentionUsers.forEach((mentioned) => {
      if (mentioned.id !== userId) {
        uniqueMentions.set(mentioned.id, mentioned);
      }
    });

    const mentionPayloads = Array.from(uniqueMentions.values()).map((mentioned) => ({
        postId,
        commentId: comment.id,
      actorId: actor.id,
        targetUserId: mentioned.id,
        preview: comment.content.slice(0, 140),
      }));

    if (mentionPayloads.length > 0) {
      const saved = await dispatchMentionNotifications(mentionPayloads);
      await Promise.all(
        saved.map((notification) => {
          const mentioned = mentionUsers.find((user) => user.id === notification.targetUserId);
          const preview = mentionPayloads.find((payload) => payload.targetUserId === notification.targetUserId)?.preview;
          if (!mentioned) return Promise.resolve();
          return pusherServer
            .trigger(`user-${mentioned.id}`, "notification:received", {
              notificationId: notification.id,
              type: "mention",
              postId,
              actor: {
                id: actor.id,
                alias: actor.alias,
                name: actor.name,
              },
              commentPreview: preview,
              createdAt: notification.createdAt.toISOString(),
            })
            .catch((error) => console.error("Failed to emit mention notification", error));
        }),
      );
    }
  }

  return NextResponse.json({ ok: true, comment: commentPayload, count });
}
