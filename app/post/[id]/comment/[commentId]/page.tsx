"use client";

import React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useSession } from "next-auth/react";

import { PostCard, type PostSummary } from "@/components/post/PostCard";
import { formatRelativeTime } from "@/lib/time";
import { getPusherClient } from "@/lib/pusher-client";

interface ThreadResponse {
  post: PostSummary & { rootPostId?: string | null; parentPostId?: string | null };
}

interface CommentEntry {
  id: string;
  content: string;
  createdAt: string;
  postId: string;
  rootPostId: string;
  parentCommentId: string | null;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    alias: string;
  };
}

interface CommentThreadResponse {
  comment: CommentEntry;
  parent: { type: "post"; data: PostSummary } | { type: "comment"; data: CommentEntry };
  replies: CommentEntry[];
}

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((res) => {
    if (!res.ok) {
      throw new Error("Failed to load");
    }
    return res.json();
  });

export default function CommentThreadPage({
  params,
}: {
  params: Promise<{ id: string; commentId: string }>;
}) {
  const unwrapped = React.use(params);
  const postId = unwrapped.id;
  const commentId = unwrapped.commentId;

  const router = useRouter();
  const { data: session } = useSession();

  const {
    data: postThread,
    mutate: mutatePostThread,
  } = useSWR<ThreadResponse>(`/api/posts/${postId}`, fetcher);

  const {
    data: commentThread,
    error,
    isLoading,
    mutate: mutateCommentThread,
  } = useSWR<CommentThreadResponse>(`/api/posts/${postId}/comments/${commentId}`, fetcher);

  const [replyText, setReplyText] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isReplying, setIsReplying] = useState(false);

  const canReply = Boolean(session?.user?.id);

  const renderContent = useCallback(
    (content: string) => {
      const currentAliasLower = session?.user?.alias?.toLowerCase();
      return content.split(/([@#][\w]+)/g).map((part, index) => {
        if (part.startsWith("@")) {
          const alias = part.slice(1);
          const aliasLower = alias.toLowerCase();
          const href =
            currentAliasLower && aliasLower === currentAliasLower
              ? "/profile"
              : `/u/${encodeURIComponent(alias)}`;
          return (
            <Link
              key={`${part}-${index}`}
              href={href}
              className="font-semibold text-[#2563eb] hover:text-[#1d4ed8] hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {part}
            </Link>
          );
        }

        if (part.startsWith("#")) {
          const tag = part.slice(1);
          const href = `/tag/${encodeURIComponent(tag.toLowerCase())}`;
          return (
            <Link
              key={`${part}-${index}`}
              href={href}
              className="font-semibold text-[#ff7f50] hover:text-[#ff6633] hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {part}
            </Link>
          );
        }

        return <span key={`${part}-${index}`}>{part}</span>;
      });
    },
    [session?.user?.alias],
  );

  const mainComment = commentThread?.comment ?? null;
  const parentEntry = commentThread?.parent ?? null;
  const replies = commentThread?.replies ?? [];

  const mainPost = useMemo<PostSummary | null>(() => {
    if (!postThread?.post) return null;
    return {
      ...postThread.post,
      timelineId: postThread.post.timelineId ?? `${postThread.post.id}-thread`,
      timelineCreatedAt: postThread.post.timelineCreatedAt ?? postThread.post.createdAt,
    };
  }, [postThread?.post]);

  const handleToggleLike = useCallback(
    async (targetId: string, nextLiked: boolean) => {
      const response = await fetch(`/api/posts/${targetId}/like`, {
        method: nextLiked ? "POST" : "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to toggle like");
      }
      const body = (await response.json()) as { count: number; liked: boolean };
      await mutatePostThread();
      return body;
    },
    [mutatePostThread],
  );

  const handleToggleRepost = useCallback(
    async (targetId: string, nextReposted: boolean) => {
      const response = await fetch(`/api/posts/${targetId}/repost`, {
        method: nextReposted ? "POST" : "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to toggle repost");
      }
      const body = (await response.json()) as { count: number; reposted: boolean };
      await mutatePostThread();
      return body;
    },
    [mutatePostThread],
  );

  const handleDelete = useCallback(
    async (targetId: string) => {
      const response = await fetch(`/api/posts/${targetId}`, { method: "DELETE" });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error ?? "Unable to delete post");
      }
      router.push("/");
    },
    [router],
  );

  useEffect(() => {
    const client = getPusherClient();
    if (!client) return;

    const channel = client.subscribe(`post-${postId}`);
    const handleCommentCreated = () => {
      mutateCommentThread();
      mutatePostThread();
    };

    channel.bind("comment:created", handleCommentCreated);

    return () => {
      channel.unbind("comment:created", handleCommentCreated);
      client.unsubscribe(`post-${postId}`);
    };
  }, [postId, mutateCommentThread, mutatePostThread]);

  const handleReply = useCallback(async () => {
    if (!mainComment || !replyText.trim() || !canReply) {
      return;
    }
    setIsReplying(true);
    setReplyError(null);
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText.trim(), parentCommentId: mainComment.id }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error ?? "Unable to publish reply");
      }
      setReplyText("");
      await Promise.all([mutateCommentThread(), mutatePostThread()]);
    } catch (caught) {
      console.error(caught);
      setReplyError(caught instanceof Error ? caught.message : "Unable to publish reply");
    } finally {
      setIsReplying(false);
    }
  }, [mainComment, replyText, canReply, postId, mutateCommentThread, mutatePostThread]);

  if (isLoading) {
    return <div className="py-8 text-center text-neutral-500">Loading...</div>;
  }

  if (error || !mainComment) {
    return <div className="py-8 text-center text-red-500">Failed to load comment.</div>;
  }

  const parentComment = parentEntry && parentEntry.type === "comment" ? parentEntry.data : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-sm font-semibold text-brandBlue hover:underline"
      >
        ← Back
      </button>

      {mainPost && (
        <PostCard
          post={mainPost}
          currentUserId={session?.user?.id}
          currentUserAlias={session?.user?.alias}
          onToggleLike={handleToggleLike}
          onToggleRepost={handleToggleRepost}
          onDelete={handleDelete}
        />
      )}

      {parentComment && (
        <div className="rounded-3xl border border-brandBlue/30 bg-white/80 p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase text-brandBlue">Replying to</p>
          <button
            type="button"
            className="w-full rounded-2xl border border-white/60 bg-white/90 p-4 text-left transition hover:bg-white"
            onClick={() => router.push(`/post/${postId}/comment/${parentComment.id}`)}
          >
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Link
                href={
                  session?.user?.id === parentComment.author.id
                    ? "/profile"
                    : `/u/${parentComment.author.alias}`
                }
                className="font-semibold text-brandText hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {parentComment.author.name ?? parentComment.author.alias}
              </Link>
              <span>@{parentComment.author.alias}</span>
              <time>{formatRelativeTime(parentComment.createdAt)}</time>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-brandText">
              {renderContent(parentComment.content)}
            </p>
          </button>
        </div>
      )}

      <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Link
            href={session?.user?.id === mainComment.author.id ? "/profile" : `/u/${mainComment.author.alias}`}
            className="font-semibold text-brandText hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {mainComment.author.name ?? mainComment.author.alias}
          </Link>
          <span>@{mainComment.author.alias}</span>
          <time>{formatRelativeTime(mainComment.createdAt)}</time>
        </div>
        <p className="mt-3 whitespace-pre-line text-sm text-brandText">
          {renderContent(mainComment.content)}
        </p>
      </div>

      <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-inner backdrop-blur">
        <textarea
          value={replyText}
          onChange={(event) => setReplyText(event.target.value)}
          placeholder={canReply ? "Whisper a reply…" : "Sign in to reply"}
          className="h-24 w-full resize-none rounded-2xl border border-brandPink/30 bg-white/90 p-3 text-sm text-brandText focus:outline-none focus:ring-2 focus:ring-brandPink/40"
          disabled={!canReply || isReplying}
        />
        {replyError && <p className="mt-2 text-xs text-red-500">{replyError}</p>}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleReply}
            disabled={!canReply || isReplying || !replyText.trim()}
            className="rounded-2xl bg-gradient-to-r from-brandBlue to-brandPink px-4 py-2 text-sm font-semibold text-white shadow transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isReplying ? "Replying…" : "Reply"}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        {replies.length === 0 ? (
          <div className="py-6 text-center text-neutral-400 italic">
            No replies yet. Continue the conversation ✨
          </div>
        ) : (
          replies.map((reply) => {
            const href =
              session?.user?.id === reply.author.id ? "/profile" : `/u/${reply.author.alias}`;
            return (
              <div
                key={reply.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/post/${postId}/comment/${reply.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/post/${postId}/comment/${reply.id}`);
                  }
                }}
                className="rounded-3xl border border-white/70 bg-white/85 p-4 shadow-sm transition hover:bg-white/95 focus:outline-none focus:ring-2 focus:ring-brandBlue/40"
              >
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Link
                    href={href}
                    className="font-semibold text-brandText hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {reply.author.name ?? reply.author.alias}
                  </Link>
                  <span>@{reply.author.alias}</span>
                  <time>{formatRelativeTime(reply.createdAt)}</time>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-brandText">
                  {renderContent(reply.content)}
                </p>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}


