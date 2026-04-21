'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { PostCard, type PostSummary } from '@/components/post/PostCard';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { getPusherClient } from '@/lib/pusher-client';
import { measureTweetLength } from '@/lib/text-counter';
import { useCompose } from '@/components/post/ComposeProvider';
import { ImageUploader } from '@/components/post/ImageUploader';

const FEED_SCOPE = ['all', 'following'] as const;
type FeedScope = (typeof FEED_SCOPE)[number];

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { subscribe } = useCompose();

  const [scope, setScope] = useState<FeedScope>('all');
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [incomingPosts, setIncomingPosts] = useState<PostSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const seenPostIds = useRef(new Set<string>());
  const counter = useMemo(() => measureTweetLength(content), [content]);

  const normalizePost = useCallback(
    (post: PostSummary): PostSummary => {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[normalizePost]", post.id, post.author.alias, post.author.id);
      }
      return {
        ...post,
        imageUrl: post.imageUrl ?? null,
        timelineId: post.timelineId ?? `${post.id}-post`,
        timelineCreatedAt: post.timelineCreatedAt ?? post.createdAt,
      };
    },
    [],
  );

  const loadTimeline = useCallback(
    async (nextScope: FeedScope) => {
      setIsFetching(true);
      setError(null);
      try {
        const response = await fetch(`/api/posts?scope=${nextScope}`);
        if (!response.ok) throw new Error('Failed to load feed');
        const data: PostSummary[] = await response.json();
        const normalized = data.map(normalizePost);
        setPosts(normalized);
        seenPostIds.current = new Set(normalized.map((item) => item.id));
        setIncomingPosts([]);
      } catch (err) {
        console.error(err);
        setError('Unable to load murmurs. Please try again.');
      } finally {
        setIsLoading(false);
        setIsFetching(false);
      }
    },
    [normalizePost],
  );

  useEffect(() => {
    loadTimeline(scope);
  }, [scope, loadTimeline]);

  useEffect(() => {
    const unsubscribe = subscribe((payload) => {
      const normalized = normalizePost(payload);
      setPosts((prev) => [normalized, ...prev.filter((post) => post.id !== normalized.id)]);
      setIncomingPosts((prev) =>
        prev.filter((incoming) => (incoming.timelineId ?? incoming.id) !== (normalized.timelineId ?? normalized.id)),
      );
      seenPostIds.current.add(normalized.id);
    });

    return unsubscribe;
  }, [normalizePost, subscribe]);

  useEffect(() => {
    const client = getPusherClient();
    if (!client) return;

    const channel = client.subscribe('feed');
    const handleNewPost = (payload: PostSummary) => {
      const normalized = normalizePost(payload);
      if (scope === 'following') {
        // When viewing following timeline, refetch to ensure accuracy
        loadTimeline('following');
        return;
      }

      if (session?.user?.id && payload.author.id === session.user.id) {
        return;
      }
      if (seenPostIds.current.has(payload.id)) return;
      setIncomingPosts((prev) => {
        if (prev.some((item) => (item.timelineId ?? item.id) === (normalized.timelineId ?? normalized.id))) {
          return prev;
        }
        return [normalized, ...prev];
      });
    };

    const handlePostDeleted = ({ postId }: { postId: string }) => {
      setPosts((prev) => prev.filter((post) => post.id !== postId));
      setIncomingPosts((prev) => prev.filter((post) => post.id !== postId));
      seenPostIds.current.delete(postId);
    };

    channel.bind('post:created', handleNewPost);
    channel.bind('post:deleted', handlePostDeleted);

    return () => {
      channel.unbind('post:created', handleNewPost);
      channel.unbind('post:deleted', handlePostDeleted);
      client.unsubscribe('feed');
    };
  }, [loadTimeline, normalizePost, scope, session?.user?.id]);

  const handleContentChange = (value: string) => {
    const metrics = measureTweetLength(value);
    if (metrics.remaining < 0) {
      return;
    }
    setContent(value);
  };

  const handlePublish = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!counter.isValid || !counter.length) return;

    try {
      setError(null);
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, imageUrl }),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? 'Unable to post');
      }

      const post: PostSummary = normalizePost(await response.json());
      setPosts((prev) => [post, ...prev.filter((existing) => existing.id !== post.id)]);
      seenPostIds.current.add(post.id);
      setIncomingPosts((prev) =>
        prev.filter((incoming) => (incoming.timelineId ?? incoming.id) !== (post.timelineId ?? post.id)),
      );
      setContent('');
      setImageUrl(null);
      setComposerExpanded(false);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const handleLike = async (postId: string, nextLiked: boolean) => {
    const response = await fetch(`/api/posts/${postId}/like`, { method: nextLiked ? 'POST' : 'DELETE' });
    if (!response.ok) {
      throw new Error('Failed to toggle like');
    }
    const body = (await response.json()) as { count: number; liked: boolean };

    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, likeCount: body.count, likedByMe: body.liked } : post,
      ),
    );
    setIncomingPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, likeCount: body.count, likedByMe: body.liked } : post,
      ),
    );

    return { count: body.count, liked: body.liked };
  };

  const handleRepost = async (postId: string, nextReposted: boolean) => {
    const response = await fetch(`/api/posts/${postId}/repost`, { method: nextReposted ? 'POST' : 'DELETE' });
    if (!response.ok) {
      throw new Error('Failed to toggle repost');
    }
    const body = (await response.json()) as { count: number; reposted: boolean };

    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, repostCount: body.count, repostedByMe: body.reposted } : post,
      ),
    );
    setIncomingPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, repostCount: body.count, repostedByMe: body.reposted } : post,
      ),
    );

    return { count: body.count, reposted: body.reposted };
  };

  const handleDelete = async (postId: string) => {
    const response = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error ?? 'Unable to delete');
    }

    setPosts((prev) => prev.filter((post) => post.id !== postId));
    setIncomingPosts((prev) => prev.filter((post) => post.id !== postId));
  };

  const mergeIncoming = () => {
    setPosts((prev) => {
      const incomingKeys = new Set(incomingPosts.map((post) => post.timelineId ?? post.id));
      const merged = [...incomingPosts, ...prev.filter((post) => !incomingKeys.has(post.timelineId ?? post.id))];
      merged.forEach((post) => seenPostIds.current.add(post.id));
      return merged;
    });
    setIncomingPosts([]);
  };

  const composerDisabled = status !== 'authenticated';

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-start md:gap-10">
      <Sidebar />

      <main className="flex w-full flex-1 flex-col gap-6 md:w-7/12 lg:w-2/3 xl:max-w-2xl">
        <header className="murmur-card space-y-5 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <nav className="flex w-full gap-2 rounded-2xl bg-white/70 p-1 text-sm font-semibold text-gray-500 sm:w-auto">
              {FEED_SCOPE.map((key) => (
                <button
                  key={key}
                  onClick={() => setScope(key)}
                  className={`flex-1 rounded-2xl px-4 py-2 transition sm:flex-none ${
                    scope === key
                      ? 'bg-gradient-to-r from-brandPink/60 via-white to-brandBlue/60 text-brandText shadow'
                      : 'hover:bg-brandPink/10'
                  }`}
                  disabled={scope === key || (key === 'following' && !session)}
                >
                  {key === 'all' ? 'All' : 'Following'}
                </button>
              ))}
            </nav>
            {status !== 'authenticated' && (
              <button className="murmur-button w-full px-4 py-2 sm:w-auto" onClick={() => router.push('/signin')}>
                Sign in
              </button>
            )}
          </div>

          <InlineComposer
            value={content}
            onChange={handleContentChange}
            counter={counter}
            disabled={composerDisabled}
            expanded={composerExpanded}
            onExpand={() => setComposerExpanded(true)}
            onCollapse={() => setComposerExpanded(false)}
            onSubmit={handlePublish}
            session={session}
            imageUrl={imageUrl}
            onImageChange={setImageUrl}
          />

          {error && <p className="text-sm text-red-500">{error}</p>}
          {isFetching && <p className="text-xs text-gray-400">Refreshing murmurs…</p>}
        </header>

        {incomingPosts.length > 0 && scope === 'all' && (
          <button onClick={mergeIncoming} className="murmur-button flex w-full items-center justify-center gap-2 py-2">
            {incomingPosts.length} new murmurs · tap to view
          </button>
        )}

        <div className="space-y-4">
          {isLoading ? (
            <SkeletonFeed />
          ) : posts.length ? (
            posts.map((post) => (
              <PostCard
                key={post.timelineId ?? post.id}
                post={post}
                currentUserId={session?.user?.id}
                currentUserAlias={session?.user?.alias}
                onToggleLike={handleLike}
                onToggleRepost={handleRepost}
                onDelete={handleDelete}
                clickable
              />
            ))
          ) : (
            <div className="murmur-card p-10 text-center text-sm text-gray-500">
              Be the first to murmur something lovely ✨
            </div>
          )}
        </div>
      </main>

    </div>
  );
}

interface InlineComposerProps {
  value: string;
  onChange: (value: string) => void;
  counter: ReturnType<typeof measureTweetLength>;
  disabled: boolean;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onSubmit: (event?: FormEvent) => void;
  session: ReturnType<typeof useSession>['data'];
  imageUrl: string | null;
  onImageChange: (url: string | null) => void;
}

function InlineComposer({
  value,
  onChange,
  counter,
  disabled,
  expanded,
  onExpand,
  onCollapse,
  onSubmit,
  session,
  imageUrl,
  onImageChange,
}: InlineComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (expanded) {
      textareaRef.current?.focus();
    }
  }, [expanded]);

  const showAvatar = session?.user?.image || session?.user?.alias;

  return (
    <form
      onSubmit={onSubmit}
      className={`rounded-3xl border border-white/60 bg-white/85 p-4 shadow-inner transition ${expanded ? 'pb-6' : ''}`}
    >
      <div className="flex gap-3">
        {showAvatar && (
          <span className="mt-1 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brandBlue/60 to-brandPink/60">
            {session?.user?.image ? (
              <Image src={session.user.image} alt={session.user.alias ?? 'avatar'} width={44} height={44} className="h-11 w-11 object-cover" />
            ) : (
              <span className="text-lg font-semibold text-brandText">
                {session?.user?.name?.slice(0, 1) ?? '?'}
              </span>
            )}
          </span>
        )}

        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={onExpand}
            placeholder={disabled ? 'Sign in to share your gentle murmur…' : "What’s happening?"}
            className={`w-full resize-none bg-transparent text-base text-brandText outline-none ${expanded ? 'h-32' : 'h-12'} transition`}
            disabled={disabled}
          />

          {expanded && (
            <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
              <span className={counter.remaining < 0 ? 'text-red-500' : ''}>{counter.remaining}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onCollapse();
                    onChange('');
              onImageChange(null);
                  }}
                  className="rounded-2xl border border-brandPink/30 px-4 py-1 text-xs text-gray-500 transition hover:bg-brandPink/10"
                >
                  Clear
                </button>
        {expanded && (
          <div className="mt-3">
            <ImageUploader value={imageUrl} onChange={onImageChange} disabled={disabled} />
          </div>
        )}

                <button
                  type="submit"
                  disabled={!counter.isValid || disabled}
                  className="rounded-2xl bg-gradient-to-r from-brandBlue to-brandPink px-4 py-1.5 text-white shadow transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Post
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}

const SkeletonFeed = () => (
  <div className="space-y-4">
    {Array.from({ length: 3 }).map((_, index) => (
      <div key={index} className="murmur-card h-40 w-full animate-pulse bg-white/60" />
    ))}
  </div>
);
