'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

import { ProfileHeader } from './ProfileHeader';
import { ProfileEditModal } from './ProfileEditModal';
import { ProfilePostsClient } from '@/app/profile/ProfilePostsClient';
import type { PostSummary } from '@/components/post/PostCard';

interface ProfileViewProps {
  isCurrentUser: boolean;
  viewerId?: string;
  profile: {
    id: string;
    name: string;
    alias: string;
    bio?: string | null;
    location?: string | null;
    website?: string | null;
    birthday?: string | null;
    image?: string | null;
    coverImage?: string | null;
    stats: {
      posts: number;
      followers: number;
      following: number;
    };
  };
  initialPosts: PostSummary[];
  likedPosts?: PostSummary[];
  isFollowing?: boolean;
}

export function ProfileView({
  isCurrentUser,
  viewerId,
  profile,
  initialPosts,
  likedPosts = [],
  isFollowing = false,
}: ProfileViewProps) {
  const { status } = useSession();
  const [activeTab, setActiveTab] = useState<'posts' | 'likes'>('posts');
  const [profileState, setProfileState] = useState(profile);
  const [editOpen, setEditOpen] = useState(false);
  const [following, setFollowing] = useState(isFollowing);
  const [postsCount, setPostsCount] = useState(initialPosts.length);
  const [followersCount, setFollowersCount] = useState(profile.stats.followers);
  const [followingCount] = useState(profile.stats.following);

  const canFollow = useMemo(() => status === 'authenticated' && !isCurrentUser, [isCurrentUser, status]);

  const handleFollowToggle = useCallback(async () => {
    if (!viewerId) return;
    const method = following ? 'DELETE' : 'POST';
    const response = await fetch(`/api/users/${profile.alias}/follow`, { method });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? 'Unable to update follow state');
    }
    const body = (await response.json()) as { following: boolean; followers: number };
    setFollowing(body.following);
    setFollowersCount(body.followers);
  }, [following, profile.alias, viewerId]);

  const handleProfileSaved = (payload: {
    name: string;
    bio?: string | null;
    location?: string | null;
    website?: string | null;
    birthday?: string | null;
    image?: string | null;
    coverImage?: string | null;
  }) => {
    setProfileState((prev) => ({
      ...prev,
      name: payload.name,
      bio: payload.bio?.trim() ? payload.bio : null,
      location: payload.location?.trim() ? payload.location : null,
      website: payload.website?.trim() ? payload.website : null,
      birthday: payload.birthday && payload.birthday.length > 0 ? payload.birthday : null,
      image: payload.image?.trim() ? payload.image : null,
      coverImage: payload.coverImage?.trim() ? payload.coverImage : null,
    }));
  };

  return (
    <section className="flex w-full flex-1 flex-col gap-6">
      <ProfileHeader
        isCurrentUser={isCurrentUser}
        name={profileState.name}
        alias={profileState.alias}
        avatarUrl={profileState.image}
        coverImage={profileState.coverImage}
        bio={profileState.bio}
        location={profileState.location}
        website={profileState.website}
        birthday={profileState.birthday}
        stats={{ posts: postsCount, followers: followersCount, following: followingCount }}
        activeTab={activeTab}
        showLikesTab={isCurrentUser}
        isFollowing={following}
        canFollow={canFollow}
        onTabChange={setActiveTab}
        onEdit={() => setEditOpen(true)}
        onToggleFollow={canFollow ? handleFollowToggle : undefined}
      />

      <ProfilePostsClient
        initialPosts={initialPosts}
        hidden={activeTab !== 'posts'}
        profileOwnerId={profile.id}
        onPostsChange={(next) => {
          setPostsCount(next.length);
        }}
      />

      {isCurrentUser && (
        <ProfilePostsClient
          initialPosts={likedPosts}
          hidden={activeTab !== 'likes'}
          mode="likes"
          profileOwnerId={profile.id}
          emptyMessage="Posts you like will appear here."
        />
      )}

      {editOpen && (
        <ProfileEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          initialValues={{
            name: profileState.name,
            bio: profileState.bio,
            location: profileState.location,
            website: profileState.website,
            birthday: profileState.birthday,
            image: profileState.image,
            coverImage: profileState.coverImage,
          }}
          onSaved={handleProfileSaved}
        />
      )}
    </section>
  );
}
