import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server";
import { ensureObjectId, getDb } from "@/lib/mongo";

const POST_INCLUDE = {
  author: { select: { id: true, name: true, image: true, alias: true } },
  _count: { select: { likes: true, comments: true, reposts: true } },
} satisfies Prisma.PostInclude;

type PostWithCounts = Prisma.PostGetPayload<{ include: typeof POST_INCLUDE }>;

function mapPostSummary(
  post: PostWithCounts | null,
  likedIds: Set<string>,
  repostedIds: Set<string>,
) {
  if (!post) {
    return null;
  }
  return {
    id: post.id,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    imageUrl: post.imageUrl ?? null,
    author: post.author,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    repostCount: post._count.reposts,
    likedByMe: likedIds.has(post.id),
    repostedByMe: repostedIds.has(post.id),
    rootPostId: post.rootPostId,
    parentPostId: post.parentPostId ?? null,
  };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const viewerId = session?.user?.id;
  const { id } = await params;

  const post = await prisma.post.findFirst({
    where: { id, deletedAt: null },
    include: POST_INCLUDE,
  });

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const replies = await prisma.post.findMany({
    where: { parentPostId: post.id, deletedAt: null },
    include: POST_INCLUDE,
    orderBy: { createdAt: "asc" },
  });

  const ids = [post.id, ...replies.map((reply) => reply.id)];

  let likedIds = new Set<string>();
  let repostedIds = new Set<string>();
  if (viewerId && ids.length > 0) {
    const [liked, reposted] = await Promise.all([
      prisma.like.findMany({
        where: { userId: viewerId, postId: { in: ids } },
        select: { postId: true },
      }),
      prisma.repost.findMany({
        where: { userId: viewerId, postId: { in: ids } },
        select: { postId: true },
      }),
    ]);
    likedIds = new Set(liked.map((entry) => entry.postId));
    repostedIds = new Set(reposted.map((entry) => entry.postId));
  }

  return NextResponse.json({
    post: mapPostSummary(post, likedIds, repostedIds),
    replies: replies
      .map((reply) => mapPostSummary(reply, likedIds, repostedIds))
      .filter((reply): reply is NonNullable<typeof reply> => Boolean(reply)),
  });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true, rootPostId: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (post.authorId !== session.user.id || post.rootPostId) {
    return NextResponse.json({ error: "Cannot delete this post" }, { status: 403 });
  }

  const db = await getDb();
  await db.collection("Post").updateOne(
    { _id: ensureObjectId(id) },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } },
  );

  await Promise.all([
    pusherServer
      .trigger("feed", "post:deleted", { postId: id })
      .catch((error) => console.error("Failed to emit post deletion to feed", error)),
    pusherServer
      .trigger(`post-${id}`, "post:deleted", { postId: id })
      .catch((error) => console.error("Failed to emit post deletion to channel", error)),
  ]);

  return NextResponse.json({ success: true });
}
