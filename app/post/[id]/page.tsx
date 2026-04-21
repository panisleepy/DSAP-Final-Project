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

interface CommentSummary {
  id: string;
  content: string;
  createdAt: string;
  parentCommentId: string | null;
  postId: string;
  rootPostId: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    alias: string;
  };
}

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((res) => {
    if (!res.ok) {
      throw new Error("Failed to load");
    }
    return res.json();
  });

export default function PostThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrapped = React.use(params);
  const postId = unwrapped.id;

  const router = useRouter();
  const { data: session } = useSession();

  const {
    data: thread,
    error,
    isLoading,
    mutate: mutateThread,
  } = useSWR<ThreadResponse>(`/api/posts/${postId}`, fetcher);

  const {
    data: commentData,
    mutate: mutateComments,
  } = useSWR<CommentSummary[]>(`/api/posts/${postId}/comments`, fetcher);

  const [replyText, setReplyText] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isReplying, setIsReplying] = useState(false);

  const commentList = commentData ?? [];
  const canReply = Boolean(session?.user?.id);

  const renderCommentContent = useCallback(
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

  const mainPost = useMemo<PostSummary | null>(() => {
    if (!thread?.post) return null;
    return {
      ...thread.post,
      timelineId: thread.post.timelineId ?? `${thread.post.id}-thread`,
      timelineCreatedAt: thread.post.timelineCreatedAt ?? thread.post.createdAt,
    };
  }, [thread?.post]);

  useEffect(() => {
    const client = getPusherClient();
    if (!client) return;

    const channel = client.subscribe(`post-${postId}`);
    const handleCommentCreated = () => {
      mutateComments();
      mutateThread();
    };

    channel.bind("comment:created", handleCommentCreated);

    return () => {
      channel.unbind("comment:created", handleCommentCreated);
      client.unsubscribe(`post-${postId}`);
    };
  }, [postId, mutateComments, mutateThread]);

  const handleToggleLike = useCallback(
    async (targetId: string, nextLiked: boolean) => {
      const response = await fetch(`/api/posts/${targetId}/like`, {
        method: nextLiked ? "POST" : "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to toggle like");
      }
      const body = (await response.json()) as { count: number; liked: boolean };
      await mutateThread();
      return body;
    },
    [mutateThread],
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
      await mutateThread();
      return body;
    },
    [mutateThread],
  );

  const handleDelete = useCallback(
    async (targetId: string) => {
      const response = await fetch(`/api/posts/${targetId}`, { method: "DELETE" });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error ?? "Unable to delete post");
      }
      if (targetId === thread?.post?.id) {
        router.back();
      } else {
        await mutateThread();
      }
    },
    [mutateThread, router, thread?.post?.id],
  );

  const handleReply = useCallback(async () => {
    if (!replyText.trim() || !canReply) {
      return;
    }
    setIsReplying(true);
    setReplyError(null);
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText.trim() }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error ?? "Unable to publish reply");
      }
      setReplyText("");
      await Promise.all([mutateComments(), mutateThread()]);
    } catch (caught) {
      console.error(caught);
      setReplyError(caught instanceof Error ? caught.message : "Unable to publish reply");
    } finally {
      setIsReplying(false);
    }
  }, [replyText, canReply, postId, mutateComments, mutateThread]);

  if (isLoading) {
    return <div className="py-8 text-center text-neutral-500">Loading...</div>;
  }

  if (error || !mainPost) {
    return <div className="py-8 text-center text-red-500">Error loading post.</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-sm font-semibold text-brandBlue hover:underline"
      >
        ← Post
      </button>

      <PostCard
        post={mainPost}
        currentUserId={session?.user?.id}
        currentUserAlias={session?.user?.alias}
        onToggleLike={handleToggleLike}
        onToggleRepost={handleToggleRepost}
        onDelete={handleDelete}
      />

      <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-inner backdrop-blur">
        <textarea
          value={replyText}
          onChange={(event) => setReplyText(event.target.value)}
          placeholder={canReply ? "Share your gentle murmur…" : "Sign in to reply"}
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
        {commentList.length === 0 ? (
          <div className="py-6 text-center text-neutral-400 italic">
            No replies yet. Be the first to reply 🌸
          </div>
        ) : (
          commentList.map((comment) => {
            const href =
              session?.user?.id === comment.author.id ? "/profile" : `/u/${comment.author.alias}`;
            return (
              <div
                key={comment.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/post/${postId}/comment/${comment.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/post/${postId}/comment/${comment.id}`);
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
                    {comment.author.name ?? comment.author.alias}
                  </Link>
                  <span>@{comment.author.alias}</span>
                  <time>{formatRelativeTime(comment.createdAt)}</time>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-brandText">
                  {renderCommentContent(comment.content)}
                </p>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
