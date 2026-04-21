import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type TimelineScope = "all" | "following";

export interface TimelineOptions {
  viewerId?: string;
  scope: TimelineScope;
  hashtag?: string;
}

export interface TimelineEntry {
  id: string;
  content: string;
  createdAt: string;
  imageUrl?: string | null;
  timelineId: string;
  timelineCreatedAt: string;
  timelineContext?: {
    type: "repost";
    actorAlias?: string | null;
    actorName?: string | null;
    createdAt: string;
  };
  author: {
    id: string;
    name: string | null;
    image: string | null;
    alias: string;
  };
  likeCount: number;
  commentCount: number;
  repostCount: number;
  likedByMe?: boolean;
  repostedByMe?: boolean;
}

export async function buildTimeline({ viewerId, scope, hashtag }: TimelineOptions): Promise<TimelineEntry[]> {
  let followingIds: string[] = [];
  if (viewerId && scope === "following") {
    try {
    const following = await prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    followingIds = following.map((entry) => entry.followingId);
    if (!followingIds.includes(viewerId)) {
      followingIds.push(viewerId);
    }
    if (followingIds.length === 0) {
        return [];
      }
    } catch (error) {
      console.error("[timeline:following]", error);
      return [];
    }
  }

  const normalizedTag = hashtag ? hashtag.trim().toLowerCase() : null;

  const postWhere = {
    deletedAt: null,
    rootPostId: null,
    ...(scope === "following" && followingIds.length > 0
      ? {
          authorId: { in: followingIds },
        }
      : {}),
    ...(normalizedTag
      ? {
          content: {
            contains: `#${normalizedTag}`,
            mode: "insensitive" as const,
          },
        }
      : {}),
  } as const;

  const POST_INCLUDE = {
        author: { select: { id: true, name: true, image: true, alias: true } },
        _count: { select: { likes: true, comments: true, reposts: true } },
  } satisfies Prisma.PostInclude;

  const REPOST_INCLUDE = {
    user: { select: { id: true, name: true, alias: true } },
    post: {
      include: POST_INCLUDE,
    },
  } satisfies Prisma.RepostInclude;

  type PostWithRelations = Prisma.PostGetPayload<{ include: typeof POST_INCLUDE }>;
  type RepostWithRelations = Prisma.RepostGetPayload<{ include: typeof REPOST_INCLUDE }>;

  let posts: PostWithRelations[] = [];
  let reposts: RepostWithRelations[] = [];

  try {
    [posts, reposts] = await Promise.all([
      prisma.post.findMany({
        where: postWhere,
        include: POST_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.repost.findMany({
      where: {
        post: {
          deletedAt: null,
          rootPostId: null,
          ...(normalizedTag
            ? {
                content: {
                  contains: `#${normalizedTag}`,
                  mode: "insensitive" as const,
                },
              }
            : {}),
        },
        ...(scope === "following" && followingIds.length > 0
          ? {
              userId: { in: followingIds },
            }
          : {}),
      },
        include: REPOST_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
  ]);
  } catch (error) {
    console.error("[timeline:posts]", error);
    return [];
  }

  const postSummaries = posts.map<TimelineEntry>((post) => ({
    id: post.id,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    imageUrl: post.imageUrl ?? null,
    timelineId: `${post.id}-post`,
    timelineCreatedAt: post.createdAt.toISOString(),
    author: post.author,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    repostCount: post._count.reposts,
  }));

  const repostSummaries = reposts
    .filter((entry) => entry.post)
    .map<TimelineEntry>((entry) => ({
      id: entry.post!.id,
      content: entry.post!.content,
      createdAt: entry.post!.createdAt.toISOString(),
    imageUrl: entry.post!.imageUrl ?? null,
      timelineId: `${entry.id}-repost`,
      timelineCreatedAt: entry.createdAt.toISOString(),
      timelineContext: {
        type: "repost",
        actorAlias: entry.user?.alias,
        actorName: entry.user?.name,
        createdAt: entry.createdAt.toISOString(),
      },
      author: entry.post!.author,
      likeCount: entry.post!._count.likes,
      commentCount: entry.post!._count.comments,
      repostCount: entry.post!._count.reposts,
    }));

  const combined = [...postSummaries, ...repostSummaries];
  combined.sort((a, b) => (b.timelineCreatedAt ?? b.createdAt).localeCompare(a.timelineCreatedAt ?? a.createdAt));
  const limited = combined.slice(0, 80);

  if (!viewerId || limited.length === 0) {
    return limited;
  }

  const postIds = Array.from(new Set(limited.map((entry) => entry.id)));
  let likedIds = new Set<string>();
  let repostedIds = new Set<string>();
  try {
  const [liked, reposted] = await Promise.all([
    prisma.like.findMany({ where: { userId: viewerId, postId: { in: postIds } }, select: { postId: true } }),
    prisma.repost.findMany({ where: { userId: viewerId, postId: { in: postIds } }, select: { postId: true } }),
  ]);
    likedIds = new Set(liked.map((entry) => entry.postId));
    repostedIds = new Set(reposted.map((entry) => entry.postId));
  } catch (error) {
    console.error("[timeline:viewerFlags]", error);
  }

  return limited.map((entry) => ({
    ...entry,
    likedByMe: likedIds.has(entry.id),
    repostedByMe: repostedIds.has(entry.id),
  }));
}

export function serializeTimelineEntry(entry: TimelineEntry) {
  return {
    id: entry.id,
    content: entry.content,
    createdAt: entry.createdAt,
    imageUrl: entry.imageUrl ?? null,
    timelineId: entry.timelineId,
    timelineCreatedAt: entry.timelineCreatedAt,
    timelineContext: entry.timelineContext,
    author: entry.author,
    likeCount: entry.likeCount,
    commentCount: entry.commentCount,
    repostCount: entry.repostCount,
    likedByMe: entry.likedByMe ?? false,
    repostedByMe: entry.repostedByMe ?? false,
  };
}
