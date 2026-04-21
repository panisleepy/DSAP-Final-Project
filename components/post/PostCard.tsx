'use client';

import { FormEvent, useEffect, useMemo, useState, startTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, MessageCircle, MoreHorizontal, Repeat2 } from 'lucide-react';

import { getPusherClient } from '@/lib/pusher-client';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/time';

export interface PostSummary {
  id: string;
  content: string;
  createdAt: string;
  imageUrl?: string | null;
  timelineId?: string;
  timelineCreatedAt?: string;
  timelineContext?: {
    type: 'repost';
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
  rootPostId?: string | null;
  parentPostId?: string | null;
}

interface CommentSummary {
  id: string;
  content: string;
  createdAt: string;
  parentCommentId?: string | null;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    alias: string;
  };
}

interface PostCardProps {
  post: PostSummary;
  currentUserId?: string;
  currentUserAlias?: string;
  onToggleLike: (postId: string, nextLiked: boolean) => Promise<{ count: number; liked: boolean }>;
  onToggleRepost: (
    postId: string,
    nextReposted: boolean,
  ) => Promise<{ count: number; reposted: boolean }>;
  onDelete: (postId: string) => Promise<void> | void;
  clickable?: boolean;
}

export function PostCard({
  post,
  currentUserId,
  currentUserAlias,
  onToggleLike,
  onToggleRepost,
  onDelete,
  clickable = false,
}: PostCardProps) {
  const router = useRouter();
  const isAuthenticated = Boolean(currentUserId);
  const [likes, setLikes] = useState(post.likeCount ?? 0);
  const [comments, setComments] = useState(post.commentCount ?? 0);
  const [reposts, setReposts] = useState(post.repostCount ?? 0);
  const [liked, setLiked] = useState(Boolean(post.likedByMe));
  const [reposted, setReposted] = useState(Boolean(post.repostedByMe));
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentList, setCommentList] = useState<CommentSummary[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    const client = getPusherClient();
    if (!client) return;

    const channelName = `post-${post.id}`;
    const channel = client.subscribe(channelName);

    const handleLiked = (payload: { count: number }) => {
      setLikes(payload.count);
    };

    const handleCommentCreated = (payload: { count: number; comment?: CommentSummary }) => {
      setComments(payload.count);
      if (payload.comment) {
        setCommentList((prev) => {
          if (prev.some((comment) => comment.id === payload.comment!.id)) {
            return prev;
          }
          return [...prev, payload.comment!];
        });
      }
    };

    const handleReposted = (payload: { count: number }) => {
      setReposts(payload.count);
    };

    channel.bind('post:liked', handleLiked);
    channel.bind('post:unliked', handleLiked);
    channel.bind('comment:created', handleCommentCreated);
    channel.bind('post:reposted', handleReposted);
    channel.bind('post:unreposted', handleReposted);

    return () => {
      channel.unbind('post:liked', handleLiked);
      channel.unbind('post:unliked', handleLiked);
      channel.unbind('comment:created', handleCommentCreated);
      channel.unbind('post:reposted', handleReposted);
      channel.unbind('post:unreposted', handleReposted);
      client.unsubscribe(channelName);
    };
  }, [post.id]);

  useEffect(() => {
    const nextLikes = post.likeCount ?? 0;
    if (likes !== nextLikes) {
      startTransition(() => setLikes(nextLikes));
    }

    const nextComments = post.commentCount ?? 0;
    if (comments !== nextComments) {
      startTransition(() => setComments(nextComments));
    }

    const nextReposts = post.repostCount ?? 0;
    if (reposts !== nextReposts) {
      startTransition(() => setReposts(nextReposts));
    }

    const nextLiked = Boolean(post.likedByMe);
    if (liked !== nextLiked) {
      startTransition(() => setLiked(nextLiked));
    }

    const nextReposted = Boolean(post.repostedByMe);
    if (reposted !== nextReposted) {
      startTransition(() => setReposted(nextReposted));
    }
  }, [
    post.likeCount,
    post.commentCount,
    post.repostCount,
    post.likedByMe,
    post.repostedByMe,
    likes,
    comments,
    reposts,
    liked,
    reposted,
  ]);

  const formatted = useMemo(() => highlightMentions(post.content, currentUserAlias), [post.content, currentUserAlias]);

  const canDelete = currentUserId === post.author.id;
  const currentAliasLower = currentUserAlias?.toLowerCase();
  const isOwnProfile = currentUserId ? post.author.id === currentUserId : false;
  const profileHref = `/u/${encodeURIComponent(post.author.alias)}`;

  const handleLinkClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const handleArticleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!clickable) return;
    if (event.defaultPrevented) return;
    router.push(`/post/${post.id}`);
  };

  const handleArticleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!clickable) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      router.push(`/post/${post.id}`);
    }
  };

  const fetchComments = async () => {
    setIsLoadingComments(true);
    setCommentError(null);
    try {
      const response = await fetch(`/api/posts/${post.id}/comments`);
      if (!response.ok) {
        throw new Error('Failed to load comments');
      }
      const data = (await response.json()) as CommentSummary[];
      setCommentList(data);
    } catch (error) {
      console.error(error);
      setCommentError('Unable to load comments right now.');
    } finally {
      setIsLoadingComments(false);
    }
  };

  const toggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next) {
      await fetchComments();
    }
  };

  const handleSubmitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!commentInput.trim()) return;
    setIsSubmittingComment(true);
    setCommentError(null);

    const payload = { content: commentInput.trim() };
    try {
      const response = await fetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to send comment');
      }

      const body = (await response.json()) as { comment?: CommentSummary; count: number };
      setCommentInput('');
      setComments(body.count);
      if (body.comment) {
        setCommentList((prev) => {
          if (prev.some((comment) => comment.id === body.comment!.id)) {
            return prev;
          }
          return [...prev, body.comment!];
        });
      }
    } catch (error) {
      console.error(error);
      setCommentError(error instanceof Error ? error.message : 'Failed to send comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <article
      id={`post-${post.id}`}
      className={cn(
        'murmur-card relative overflow-hidden p-5 transition hover:shadow-md',
        clickable && 'cursor-pointer',
      )}
      onClick={handleArticleClick}
      onKeyDown={handleArticleKeyDown}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {canDelete && (
        <div className="absolute right-4 top-4">
          <button
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setShowMenu((prev) => !prev);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-gray-500 hover:text-red-500"
          >
            <MoreHorizontal size={18} />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-2 w-36 rounded-2xl border border-brandPink/40 bg-white/95 p-2 shadow-lg">
              <button
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setShowMenu(false);
                  onDelete(post.id);
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-sm text-red-500 hover:bg-brandPink/30"
              >
                Delete post
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4">
        <Link href={profileHref} className="flex-shrink-0" onClick={handleLinkClick}>
          <AuthorAvatar alias={post.author.alias} image={post.author.image} />
        </Link>
        <div className="flex-1 space-y-3">
          {post.timelineContext?.type === 'repost' && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Repeat2 size={14} className="text-brandBlue" />
              {post.timelineContext.actorAlias ? (
                <Link
                  href={
                    currentAliasLower && post.timelineContext.actorAlias?.toLowerCase() === currentAliasLower
                      ? '/profile'
                      : `/u/${post.timelineContext.actorAlias}`
                  }
                  className="font-semibold hover:underline"
                  onClick={handleLinkClick}
                >
                  {post.timelineContext.actorName ??
                    (post.timelineContext.actorAlias
                      ? `@${post.timelineContext.actorAlias}`
                      : 'Someone')}
                </Link>
              ) : (
                <span>
                  {post.timelineContext.actorName ?? 'Someone'}
                </span>
              )}
              <span>
                {' '}
                reposted
              </span>
              <time>
                {new Date(
                  post.timelineContext.createdAt ??
                    post.timelineCreatedAt ??
                    post.createdAt,
                ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          )}
          <header className="flex items-center gap-2 text-sm">
            <Link href={profileHref} className="font-semibold text-brandText hover:underline" onClick={handleLinkClick}>
              {post.author.name ?? post.author.alias}
            </Link>
            <span className="text-xs text-gray-500">@{post.author.alias}</span>
            <Link
              href={`/post/${post.id}`}
              className="text-xs text-gray-400 hover:underline"
              title={new Date(post.createdAt).toLocaleString()}
              onClick={handleLinkClick}
            >
              {formatRelativeTime(post.timelineCreatedAt ?? post.createdAt)}
            </Link>
          </header>
          <p className="text-base leading-relaxed text-brandText">{formatted}</p>
          {post.imageUrl && (
            <div className="relative mt-3 overflow-hidden rounded-3xl border border-white/70 bg-white/60">
              <Image
                src={post.imageUrl}
                alt="Post media"
                width={800}
                height={600}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <footer className="flex items-center gap-6 text-sm text-gray-500">
            <button
              onClick={async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const nextLiked = !liked;
                setLiked(nextLiked);
                setLikes((prev) => (nextLiked ? prev + 1 : Math.max(prev - 1, 0)));
                try {
                  const result = await onToggleLike(post.id, nextLiked);
                  setLikes(result.count);
                  setLiked(result.liked);
                } catch (error) {
                  console.error(error);
                  setLiked(!nextLiked);
                  setLikes((prev) => (!nextLiked ? prev + 1 : Math.max(prev - 1, 0)));
                }
              }}
              className={cn(
                'flex items-center gap-2 rounded-2xl px-3 py-2 transition',
                liked ? 'bg-brandPink/40 text-brandText' : 'hover:bg-brandPink/30 hover:text-brandText',
              )}
            >
              <Heart size={18} className={liked ? 'fill-brandPink text-brandPink' : undefined} />
              <span>{likes}</span>
            </button>
            <button
              onClick={async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await toggleComments();
              }}
              className="flex items-center gap-2 rounded-2xl px-3 py-2 transition hover:bg-brandBlue/30 hover:text-brandText"
            >
              <MessageCircle size={18} />
              <span>{comments}</span>
            </button>
            <button
              onClick={async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const nextReposted = !reposted;
                setReposted(nextReposted);
                setReposts((prev) => (nextReposted ? prev + 1 : Math.max(prev - 1, 0)));
                try {
                  const result = await onToggleRepost(post.id, nextReposted);
                  setReposts(result.count);
                  setReposted(result.reposted);
                } catch (error) {
                  console.error(error);
                  setReposted(!nextReposted);
                  setReposts((prev) => (!nextReposted ? prev + 1 : Math.max(prev - 1, 0)));
                }
              }}
              className={cn(
                'flex items-center gap-2 rounded-2xl px-3 py-2 transition',
                reposted ? 'bg-brandBlue/40 text-brandText' : 'hover:bg-brandBlue/30 hover:text-brandText',
              )}
            >
              <Repeat2 size={18} className={reposted ? 'text-brandBlue' : undefined} />
              <span>{reposts}</span>
            </button>
          </footer>

          {showComments && (
            <div className="space-y-3 rounded-2xl border border-white/70 bg-white/60 p-4" onClick={(event) => event.stopPropagation()}>
              <form onSubmit={handleSubmitComment} className="space-y-2">
                <textarea
                  value={commentInput}
                  onChange={(event) => setCommentInput(event.target.value)}
                  placeholder={isAuthenticated ? 'Whisper a reply…' : 'Sign in to reply'}
                  className="h-20 w-full resize-none rounded-xl border border-brandBlue/40 bg-white/80 p-3 text-sm"
                  disabled={!isAuthenticated || isSubmittingComment}
                  onClick={(event) => event.stopPropagation()}
                />
                {commentError && <p className="text-xs text-red-500">{commentError}</p>}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!isAuthenticated || isSubmittingComment || !commentInput.trim()}
                    className="murmur-button px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reply
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {isLoadingComments ? (
                  <div className="text-xs text-gray-500">Loading gentle replies…</div>
                ) : commentList.length === 0 ? (
                  <div className="text-xs text-gray-400">No replies yet. Be the first to murmur back!</div>
                ) : (
                  [...commentList]
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map((comment) => (
                      <div key={comment.id} className="rounded-2xl bg-white/80 p-3 text-sm text-brandText">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Link href={`/u/${comment.author.alias}`} className="font-semibold hover:underline" onClick={handleLinkClick}>
                            {comment.author.name ?? comment.author.alias}
                          </Link>
                          <span>@{comment.author.alias}</span>
                          <time>
                            {new Date(comment.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </div>
                        <p className="mt-1 text-brandText">{comment.content}</p>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function highlightMentions(content: string, currentUserAlias?: string | null) {
  const currentAliasLower = currentUserAlias?.toLowerCase();
  const parts = content.split(/([@#][\w]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      const alias = part.slice(1);
      const aliasLower = alias.toLowerCase();
      const href =
        currentAliasLower && aliasLower === currentAliasLower
          ? '/profile'
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

    if (part.startsWith('#')) {
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
}

function AuthorAvatar({ image, alias }: { image: string | null; alias: string }) {
  if (!image) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-br from-brandBlue to-brandPink text-lg font-semibold text-brandText">
        {alias.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="relative h-12 w-12 overflow-hidden rounded-3xl">
      <Image src={image} alt={alias} fill className="object-cover" sizes="48px" />
    </div>
  );
}
