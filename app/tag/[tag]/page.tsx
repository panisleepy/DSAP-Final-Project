import { notFound } from 'next/navigation';

import { auth } from '@/lib/auth';
import { buildTimeline, serializeTimelineEntry } from '@/lib/timeline';
import { ProfilePostsClient } from '@/app/profile/ProfilePostsClient';
import { getMockTimeline } from '@/lib/mock-data';

interface TagPageProps {
  params: Promise<{ tag: string }>;
}

export default async function TagPage({ params }: TagPageProps) {
  const session = await auth();
  const { tag } = await params;
  const decoded = decodeURIComponent(tag || '').trim();

  if (!decoded) {
    notFound();
  }

  const normalized = decoded.toLowerCase();
  let initialPosts;
  try {
    const timeline = await buildTimeline({ viewerId: session?.user?.id, scope: 'all', hashtag: normalized });
    initialPosts = timeline.map(serializeTimelineEntry);
  } catch (error) {
    console.error('[tag-page]', error);
    initialPosts = getMockTimeline('all', normalized).map(serializeTimelineEntry);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="murmur-card space-y-2 p-6">
        <h1 className="text-2xl font-semibold text-brandText">#{decoded}</h1>
        <p className="text-sm text-gray-500">
          {initialPosts.length === 1
            ? '1 murmur shares this hashtag'
            : `${initialPosts.length} murmurs share this hashtag`}
        </p>
      </header>

      <ProfilePostsClient
        initialPosts={initialPosts}
        hidden={false}
        emptyMessage={`No murmurs found for #${decoded}`}
      />
    </div>
  );
}
