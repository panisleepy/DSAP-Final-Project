import { NextResponse } from "next/server";
import { z } from "zod";
import type { Session } from "next-auth";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server";
import { measureTweetLength } from "@/lib/text-counter";
import { buildTimeline, serializeTimelineEntry, TimelineScope } from "@/lib/timeline";
import { ensureObjectId, getDb, toObjectId } from "@/lib/mongo";
import { extractMentions } from "@/lib/mentions";
import { dispatchMentionNotifications } from "@/lib/notifications";

if (process.env.DATABASE_URL) {
  console.log("[posts] DATABASE_URL flags", {
    retryWrites: /retryWrites=([^&]+)/i.exec(process.env.DATABASE_URL)?.[1] ?? "missing",
    w: /[?&]w=([^&]+)/i.exec(process.env.DATABASE_URL)?.[1] ?? "missing",
  });
}

const createPostSchema = z.object({
  content: z
    .string()
    .min(1)
    .max(2000)
    .refine((value) => value.trim().length > 0, {
      message: "Post cannot be empty",
    }),
  rootPostId: z.string().optional().nullable(),
  parentPostId: z.string().optional().nullable(),
  imageUrl: z
    .string()
    .url()
    .optional()
    .nullable(),
});

export async function GET(request: Request) {
  const session = (await auth()) as Session | null;
  const url = new URL(request.url);
  const scopeParam = (url.searchParams.get("scope") ?? "all").toLowerCase();
  const scope: TimelineScope = scopeParam === "following" ? "following" : "all";
  const hashtag = url.searchParams.get("hashtag") ?? undefined;

  if (scope === "following" && !session?.user?.id) {
    return NextResponse.json({ error: "Authentication required for following timeline" }, { status: 401 });
  }

  try {
    const timeline = await buildTimeline({ viewerId: session?.user?.id, scope, hashtag });
    return NextResponse.json(timeline.map(serializeTimelineEntry));
  } catch (error) {
    console.error("[posts:get]", error);
    return NextResponse.json(
      { error: "Failed to load", detail: String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = (await auth()) as Session | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = session.user;

    const body = await request.json();
    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { content, rootPostId, parentPostId, imageUrl } = parsed.data;
    const normalizedContent = content.trim();
    const { isValid, remaining } = measureTweetLength(normalizedContent);
    if (!isValid) {
      return NextResponse.json(
        { error: "Content exceeds 2000 character limit", remaining },
        { status: 422 },
      );
    }

    const authorObjectId = ensureObjectId(actor.id);
    const parentObjectId = parentPostId ? ensureObjectId(parentPostId) : null;
    const db = await getDb();
    const now = new Date();
    let rootObjectId = rootPostId ? ensureObjectId(rootPostId) : null;
    if (!rootObjectId && parentObjectId) {
      const parent = await db.collection("Post").findOne(
        { _id: parentObjectId },
        { projection: { rootPostId: 1 } },
      );
      if (!parent) {
        return NextResponse.json({ error: "Parent post not found" }, { status: 404 });
      }
      const parentRootObjectId = toObjectId(parent.rootPostId);
      rootObjectId = parentRootObjectId ?? parentObjectId;
    }

    const insertResult = await db.collection("Post").insertOne({
      content: normalizedContent,
      authorId: authorObjectId,
      rootPostId: rootObjectId,
      parentPostId: parentObjectId,
      imageUrl: imageUrl ?? null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const createdId = insertResult.insertedId.toHexString();

    const hydrated = await prisma.post.findUnique({
      where: { id: createdId },
      include: {
        author: { select: { id: true, name: true, image: true, alias: true } },
        _count: { select: { likes: true, comments: true, reposts: true } },
      },
    });

    if (!hydrated) {
      return NextResponse.json({ error: "Failed to load created post" }, { status: 500 });
    }

    const hydratedImageUrl = (hydrated as { imageUrl?: string | null }).imageUrl ?? null;

    const payload = serializeTimelineEntry({
      id: hydrated.id,
      content: hydrated.content,
      createdAt: hydrated.createdAt.toISOString(),
      timelineId: `${hydrated.id}-post`,
      timelineCreatedAt: hydrated.createdAt.toISOString(),
      author: hydrated.author,
      imageUrl: hydratedImageUrl,
      likeCount: hydrated._count.likes,
      commentCount: hydrated._count.comments,
      repostCount: hydrated._count.reposts,
      likedByMe: false,
      repostedByMe: false,
    });

    const mentionAliases = extractMentions(normalizedContent);
    if (mentionAliases.length > 0) {
      const mentionUsers = await prisma.user.findMany({
        where: {
          OR: mentionAliases.map((alias) => ({ alias: { equals: alias, mode: "insensitive" as const } })),
        },
        select: { id: true, alias: true, name: true },
      });

      const uniqueMentions = new Map<string, (typeof mentionUsers)[number]>();
      mentionUsers.forEach((user) => {
        if (user.id !== actor.id) {
          uniqueMentions.set(user.id, user);
        }
      });

      const mentionPayloads = Array.from(uniqueMentions.values()).map((user) => ({
          postId: hydrated.id,
        actorId: actor.id,
          targetUserId: user.id,
          preview: content.slice(0, 140),
        }));

      if (mentionPayloads.length > 0) {
        const saved = await dispatchMentionNotifications(mentionPayloads);
        await Promise.all(
          saved.map((notification) => {
            const mentioned = mentionUsers.find((user) => user.id === notification.targetUserId);
            const preview = mentionPayloads.find((item) => item.targetUserId === notification.targetUserId)?.preview;
            if (!mentioned) return Promise.resolve();
            return pusherServer
              .trigger(`user-${mentioned.id}`, "notification:received", {
                notificationId: notification.id,
                type: "mention",
                postId: hydrated.id,
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

    await pusherServer
      .trigger("feed", "post:created", payload)
      .catch((error) => console.error("Failed to publish feed event", error));

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    console.error("[posts:post]", error);
    return NextResponse.json({ error: "Failed to load", detail: String(error) }, { status: 500 });
  }
}
