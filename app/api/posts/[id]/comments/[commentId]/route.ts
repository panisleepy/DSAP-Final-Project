import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const commentSelect = {
  id: true,
  content: true,
  createdAt: true,
  parentCommentId: true,
  postId: true,
  rootPostId: true,
};
const authorSelect = { id: true, name: true, image: true, alias: true };

type CommentModel = {
  id: string;
  content: string;
  createdAt: Date;
  parentCommentId: string | null;
  postId: string;
  rootPostId: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    alias: string;
  };
};

function mapComment(comment: CommentModel | null) {
  if (!comment) return null;
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    parentCommentId: comment.parentCommentId,
    postId: comment.postId,
    rootPostId: comment.rootPostId,
    author: comment.author,
  };
}

function mapPost(post: {
  id: string;
  content: string;
  createdAt: Date;
  author: CommentModel["author"];
  _count: { likes: number; comments: number; reposts: number };
}) {
  return {
    id: post.id,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    timelineId: `${post.id}-thread`,
    timelineCreatedAt: post.createdAt.toISOString(),
    author: post.author,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    repostCount: post._count.reposts,
    likedByMe: false,
    repostedByMe: false,
  };
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const { id: postId, commentId } = await params;

  const comment = await prisma.comment.findFirst({
    where: { id: commentId, postId, deletedAt: null },
    select: {
      ...commentSelect,
      author: { select: authorSelect },
      parentCommentId: true,
      post: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: { select: authorSelect },
          _count: { select: { likes: true, comments: true, reposts: true } },
        },
      },
    },
  });

  if (!comment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const baseComment = mapComment({
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    parentCommentId: comment.parentCommentId,
    postId: comment.postId,
    rootPostId: comment.rootPostId,
    author: comment.author,
  });

  let parent: { type: "post" | "comment"; data: unknown } | null = null;

  if (comment.parentCommentId) {
    const parentComment = await prisma.comment.findFirst({
      where: { id: comment.parentCommentId, deletedAt: null },
      select: {
        ...commentSelect,
        author: { select: authorSelect },
      },
    });

    if (parentComment) {
      parent = {
        type: "comment",
        data: mapComment(parentComment),
      };
    }
  }

  if (!parent) {
    parent = {
      type: "post",
      data: mapPost(comment.post),
    };
  }

  const replies = await prisma.comment.findMany({
    where: { parentCommentId: commentId, deletedAt: null },
    select: {
      ...commentSelect,
      author: { select: authorSelect },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    comment: baseComment,
    parent,
    replies: replies
      .map((entry) =>
        mapComment({
          id: entry.id,
          content: entry.content,
          createdAt: entry.createdAt,
          parentCommentId: entry.parentCommentId,
          postId: entry.postId,
          rootPostId: entry.rootPostId,
          author: entry.author,
        }),
      )
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
  });
}


