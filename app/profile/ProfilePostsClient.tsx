'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

import { PostCard, type PostSummary } from '@/components/post/PostCard';
import { getPusherClient } from '@/lib/pusher-client';
import { useCompose } from '@/components/post/ComposeProvider';

interface ProfilePostsClientProps {
  initialPosts: PostSummary[];
  hidden?: boolean;
  emptyMessage?: string;
  mode?: 'posts' | 'likes';
  profileOwnerId?: string;
  onPostsChange?: (posts: PostSummary[]) => void;
}

export function ProfilePostsClient({
  initialPosts,
  hidden,
  emptyMessage = 'No murmurs yet.',
  mode = 'posts',
  profileOwnerId,
  onPostsChange,
}: ProfilePostsClientProps) {
  const { data: session } = useSession();
  const { subscribe } = useCompose();
  const [posts, setPosts] = useState(initialPosts);

  useEffect(() => {
    onPostsChange?.(posts);
  }, [posts, onPostsChange]);

  const updatePosts = useCallback((updater: (prev: PostSummary[]) => PostSummary[]) => {
    setPosts((prev) => updater(prev));
  }, []);

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  useEffect(() => {
    if (mode !== 'posts' || !profileOwnerId) return;
    const unsubscribe = subscribe((payload) => {
      if (payload.author.id !== profileOwnerId) return;
      updatePosts((prev) => {
        const exists = prev.some((post) => post.id === payload.id);
        if (exists) {
          return prev;
        }
        return [payload, ...prev];
      });
    });

    return unsubscribe;
  }, [mode, profileOwnerId, subscribe, updatePosts]);

  useEffect(() => {
    const client = getPusherClient();
    if (!client) return;

    const channel = client.subscribe('feed');
    const handleDeleted = ({ postId }: { postId: string }) => {
      updatePosts((prev) => prev.filter((post) => post.id !== postId));
    };

    const handleCreated = (payload: PostSummary) => {
      if (mode !== 'posts') return;
      if (payload.author.id !== profileOwnerId) return;

      const normalized: PostSummary = {
        ...payload,
        createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : new Date(payload.createdAt).toISOString(),
        timelineCreatedAt:
          payload.timelineCreatedAt && typeof payload.timelineCreatedAt === 'string'
            ? payload.timelineCreatedAt
            : new Date(payload.createdAt).toISOString(),
        imageUrl: payload.imageUrl ?? null,
      };

      updatePosts((prev) => {
        if (prev.some((post) => post.id === normalized.id)) {
          return prev;
        }
        return [normalized, ...prev];
      });
    };

    channel.bind('post:deleted', handleDeleted);
    channel.bind('post:created', handleCreated);

    return () => {
      channel.unbind('post:deleted', handleDeleted);
      channel.unbind('post:created', handleCreated);
    };
  }, [mode, profileOwnerId, updatePosts]);

  const handleToggleLike = useCallback(
    async (postId: string, nextLiked: boolean) => {
      const response = await fetch(`/api/posts/${postId}/like`, { method: nextLiked ? 'POST' : 'DELETE' });
      if (!response.ok) {
        throw new Error('Failed to toggle like');
      }
      const body = (await response.json()) as { count: number; liked: boolean };

      updatePosts((prev) => {
        const next = prev.map((post) =>
          post.id === postId ? { ...post, likeCount: body.count, likedByMe: body.liked } : post,
        );
        if (mode === 'likes' && !body.liked) {
          return next.filter((post) => post.id !== postId);
        }
        return next;
      });

      return { count: body.count, liked: body.liked };
    },
    [mode, updatePosts],
  );

  const handleToggleRepost = useCallback(
    async (postId: string, nextReposted: boolean) => {
      const response = await fetch(`/api/posts/${postId}/repost`, { method: nextReposted ? 'POST' : 'DELETE' });
      if (!response.ok) {
        throw new Error('Failed to toggle repost');
      }
      const body = (await response.json()) as { count: number; reposted: boolean };

      updatePosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, repostCount: body.count, repostedByMe: body.reposted } : post,
        ),
      );

      return { count: body.count, reposted: body.reposted };
    },
    [updatePosts],
  );

  const handleDelete = useCallback(
    async (postId: string) => {
      const response = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? 'Unable to delete');
      }

      updatePosts((prev) => prev.filter((post) => post.id !== postId));
    },
    [updatePosts],
  );

  const content = useMemo(() => {
    if (posts.length === 0) {
      return <div className="text-sm text-gray-500">{emptyMessage}</div>;
    }

    return posts.map((post) => (
      <PostCard
        key={post.timelineId ?? post.id}
        post={post}
        currentUserId={session?.user?.id}
        currentUserAlias={session?.user?.alias}
        onToggleLike={handleToggleLike}
        onToggleRepost={handleToggleRepost}
        onDelete={handleDelete}
        clickable
      />
    ));
  }, [emptyMessage, handleDelete, handleToggleLike, handleToggleRepost, posts, session?.user?.alias, session?.user?.id]);

  return <div className={hidden ? 'hidden' : 'space-y-4'}>{content}</div>;
}
