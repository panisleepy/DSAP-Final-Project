import { notFound } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { PostSummary } from '@/components/post/PostCard';
import { ProfileView } from '@/components/profile/ProfileView';
import { Sidebar } from '@/components/sidebar/Sidebar';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="p-8 text-sm text-gray-500">Please sign in to view your profile 🌸</div>;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
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
      following: { select: { id: true } },
    },
  });

  if (!user) {
    notFound();
  }

  const [posts, reposts, likes, followersCount, followingCount] = await Promise.all([
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
    prisma.like.findMany({
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
  ]);

  const likedPostIds = new Set(likes.map((entry) => entry.postId));
  const userRepostIds = new Set(reposts.map((entry) => entry.postId));

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
    likedByMe: likedPostIds.has(post.id),
    repostedByMe: userRepostIds.has(post.id),
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
    likedByMe: likedPostIds.has(entry.postId),
    repostedByMe: true,
  }));

  const likedEntries: PostSummary[] = likes
    .filter((entry) => entry.post && !entry.post.deletedAt)
    .map((entry) => ({
      id: entry.post.id,
      content: entry.post.content,
      createdAt: entry.post.createdAt.toISOString(),
      imageUrl: entry.post.imageUrl ?? null,
      timelineId: `${entry.id}-liked`,
      timelineCreatedAt: entry.createdAt.toISOString(),
      author: entry.post.author,
      likeCount: entry.post._count.likes,
      commentCount: entry.post._count.comments,
      repostCount: entry.post._count.reposts,
      likedByMe: true,
      repostedByMe: userRepostIds.has(entry.postId),
    }));

  const summaries: PostSummary[] = [...postEntries, ...repostEntries].sort((a, b) =>
    (b.timelineCreatedAt ?? b.createdAt).localeCompare(a.timelineCreatedAt ?? a.createdAt),
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-start md:gap-10">
      <Sidebar />
      <div className="flex w-full flex-1 md:w-7/12 lg:w-2/3 xl:max-w-2xl">
      <ProfileView
        isCurrentUser
        viewerId={session.user.id}
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
        likedPosts={likedEntries}
      />
      </div>
    </div>
  );
}
