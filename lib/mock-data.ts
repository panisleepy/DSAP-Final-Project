import type { TimelineEntry, TimelineScope } from './timeline';
import type { MentionNotificationRecord } from './notifications';

const MOCK_USERS = [
  {
    id: 'mock-user-1',
    alias: 'aurora',
    name: 'Aurora',
    image: null,
  },
  {
    id: 'mock-user-2',
    alias: 'mammoth',
    name: 'Mammoth',
    image: null,
  },
];

const now = new Date();

const MOCK_TIMELINE: TimelineEntry[] = [
  {
    id: 'mock-post-1',
    content: 'Welcome to murmur! @mammoth #launch',
    createdAt: new Date(now.getTime() - 1000 * 60 * 5).toISOString(),
    timelineId: 'mock-post-1-post',
    timelineCreatedAt: new Date(now.getTime() - 1000 * 60 * 5).toISOString(),
    author: MOCK_USERS[0],
    likeCount: 2,
    commentCount: 1,
    repostCount: 0,
  },
  {
    id: 'mock-post-2',
    content: 'murmur supports hashtags like #launch and mentions like @aurora',
    createdAt: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
    timelineId: 'mock-post-2-post',
    timelineCreatedAt: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
    author: MOCK_USERS[1],
    likeCount: 1,
    commentCount: 0,
    repostCount: 1,
  },
];

const MOCK_NOTIFICATIONS = [
  {
    id: 'mock-notif-1',
    type: 'like' as const,
    postId: 'mock-post-1',
    commentId: null,
    actor: { alias: 'mammoth', name: 'Mammoth' },
    commentPreview: null,
    createdAt: new Date(now.getTime() - 1000 * 60 * 2).toISOString(),
    read: false,
  },
  {
    id: 'mock-notif-2',
    type: 'mention' as const,
    postId: 'mock-post-2',
    commentId: null,
    actor: { alias: 'aurora', name: 'Aurora' },
    commentPreview: 'Welcome to murmur!',
    createdAt: new Date(now.getTime() - 1000 * 120).toISOString(),
    read: true,
  },
];

export function getMockTimeline(scope: TimelineScope, hashtag?: string | null): TimelineEntry[] {
  const tag = hashtag?.toLowerCase();
  const filtered = tag
    ? MOCK_TIMELINE.filter((entry) => entry.content.toLowerCase().includes(`#${tag}`))
    : MOCK_TIMELINE;

  if (scope === 'following') {
    return filtered.filter((entry) => entry.author.alias === 'aurora');
  }

  return filtered;
}

export function getMockNotifications() {
  return MOCK_NOTIFICATIONS;
}

export const MOCK_MENTION_RECORD: MentionNotificationRecord = {
  id: 'mock-mention',
  createdAt: now,
  targetUserId: 'mock-user-1',
};
