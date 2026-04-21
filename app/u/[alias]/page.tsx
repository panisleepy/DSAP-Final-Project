import { notFound } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { PostSummary } from '@/components/post/PostCard';
import { ProfileView } from '@/components/profile/ProfileView';
import { Sidebar } from '@/components/sidebar/Sidebar';

type UserPublicPageProps = {
  params: Promise<{ alias: string }>;
};

export default async function UserPublicPage({ params }: UserPublicPageProps) {
  const { alias } = await params;
  const session = await auth();
  const viewerId = session?.user?.id;

  const user = await prisma.user.findFirst({
    where: { alias },
    select: {
      id: true,
      name: true,
      alias: true,
      bio: true,
      image: true,
      coverImage: true,
      location: true,
      website: true,
      birthday: true,
    },
  });

  if (!user) {
    notFound();
  }

  const [posts, reposts, followersCount, followingCount, viewerFollow] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: user.id, deletedAt: null },
      include: {
        author: { select: { id: true, name: true, image: true, alias: true } },
        _count: { select: { likes: true, comments: true, reposts: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.repost.findMany({
      where: { userId: user.id },
      include: {
        post: {
          include: {
            author: { select: { id: true, name: true, image: true, alias: true } },
            _count: { select: { likes: true, comments: true, reposts: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    viewerId
      ? prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: viewerId,
              followingId: user.id,
            },
          },
          select: { id: true },
        })
      : null,
  ]);

  const allPostIds = Array.from(new Set([...posts.map((post) => post.id), ...reposts.map((entry) => entry.postId)]));

  const viewerLikes = viewerId
    ? await prisma.like.findMany({
        where: { userId: viewerId, postId: { in: allPostIds } },
        select: { postId: true },
      })
    : [];
  const viewerLikedIds = new Set(viewerLikes.map((entry) => entry.postId));

  const viewerReposts = viewerId
    ? await prisma.repost.findMany({ where: { userId: viewerId, postId: { in: allPostIds } }, select: { postId: true } })
    : [];
  const viewerRepostedIds = new Set(viewerReposts.map((entry) => entry.postId));

  const postEntries: PostSummary[] = posts.map((post) => ({
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
    likedByMe: viewerLikedIds.has(post.id),
    repostedByMe: viewerRepostedIds.has(post.id),
  }));

  const repostEntries: PostSummary[] = reposts.map((entry) => ({
    id: entry.post.id,
    content: entry.post.content,
    createdAt: entry.post.createdAt.toISOString(),
    imageUrl: entry.post.imageUrl ?? null,
    timelineId: `${entry.id}-repost`,
    timelineCreatedAt: entry.createdAt.toISOString(),
    timelineContext: {
      type: 'repost',
      actorAlias: user.alias,
      actorName: user.name,
      createdAt: entry.createdAt.toISOString(),
    },
    author: entry.post.author,
    likeCount: entry.post._count.likes,
    commentCount: entry.post._count.comments,
    repostCount: entry.post._count.reposts,
    likedByMe: viewerLikedIds.has(entry.postId),
    repostedByMe: viewerRepostedIds.has(entry.postId),
  }));

  const summaries: PostSummary[] = [...postEntries, ...repostEntries].sort((a, b) =>
    (b.timelineCreatedAt ?? b.createdAt).localeCompare(a.timelineCreatedAt ?? a.createdAt),
  );

  const isCurrentUser = viewerId === user.id;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-start md:gap-10">
      <Sidebar />
      <div className="flex w-full flex-1 md:w-7/12 lg:w-2/3 xl:max-w-2xl">
        <ProfileView
          isCurrentUser={isCurrentUser}
          viewerId={viewerId ?? undefined}
          profile={{
            id: user.id,
            name: user.name ?? 'Murmur friend',
            alias: user.alias,
            bio: user.bio,
            image: user.image,
            coverImage: user.coverImage,
            location: user.location,
            website: user.website,
            birthday: user.birthday?.toISOString() ?? null,
            stats: {
              posts: summaries.length,
              followers: followersCount,
              following: followingCount,
            },
          }}
          initialPosts={summaries}
          isFollowing={Boolean(viewerFollow)}
        />
      </div>
    </div>
  );
}
