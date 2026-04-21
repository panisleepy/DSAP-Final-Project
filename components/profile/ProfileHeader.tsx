'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Calendar, Edit3, Link as LinkIcon, MapPin } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ProfileHeaderProps {
  isCurrentUser: boolean;
  backHref?: string;
  name: string;
  alias: string;
  avatarUrl?: string | null;
  coverImage?: string | null;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  birthday?: string | null;
  stats: {
    posts: number;
    followers: number;
    following: number;
  };
  activeTab: 'posts' | 'likes';
  showLikesTab?: boolean;
  isFollowing?: boolean;
  canFollow?: boolean;
  onTabChange: (tab: 'posts' | 'likes') => void;
  onEdit?: () => void;
  onToggleFollow?: () => void;
}

export function ProfileHeader({
  isCurrentUser,
  backHref = '/',
  name,
  alias,
  avatarUrl,
  coverImage,
  bio,
  location,
  website,
  birthday,
  stats,
  activeTab,
  showLikesTab,
  isFollowing,
  canFollow = false,
  onTabChange,
  onEdit,
  onToggleFollow,
}: ProfileHeaderProps) {
  const formattedBirthday = birthday ? new Date(birthday).toLocaleDateString() : null;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="relative">
        <div
          className={cn('h-40 w-full bg-gradient-to-r from-brandBlue/40 via-white to-brandPink/40', coverImage && 'bg-cover bg-center')}
          style={coverImage ? { backgroundImage: `url(${coverImage})` } : undefined}
        />
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <Link
            href={backHref}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-brandText shadow hover:bg-white"
          >
            <ArrowLeft size={18} />
          </Link>
        </div>
        <div className="absolute left-6 bottom-[-56px] h-28 w-28 overflow-hidden rounded-[2.5rem] border-4 border-white bg-white shadow-xl">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={alias} width={112} height={112} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brandBlue to-brandPink text-4xl font-semibold text-white">
              {alias.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="absolute right-6 bottom-[-20px] flex items-center gap-3">
          {isCurrentUser ? (
            <button
              onClick={onEdit}
              className="flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2 text-sm font-semibold text-brandText shadow hover:bg-white"
            >
              <Edit3 size={16} /> Edit profile
            </button>
          ) : (
            <button
              onClick={onToggleFollow}
              disabled={!canFollow}
              className={cn(
                'rounded-2xl px-5 py-2 text-sm font-semibold shadow transition',
                isFollowing
                  ? 'bg-white text-brandText hover:bg-white/90'
                  : 'bg-gradient-to-r from-brandBlue to-brandPink text-white hover:brightness-105',
                !canFollow && 'cursor-not-allowed',
              )}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </div>

      <div className="px-6 pb-6 pt-20">
        <div className="flex flex-col gap-6 pl-[7.5rem]">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-brandText">{name}</h1>
              <p className="text-sm text-gray-500">@{alias}</p>
            </div>
          </div>

          {bio && <p className="max-w-2xl text-sm leading-relaxed text-gray-600">{bio}</p>}

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <Stat label="Posts" value={stats.posts} />
            <Stat label="Followers" value={stats.followers} />
            <Stat label="Following" value={stats.following} />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            {location && (
              <span className="flex items-center gap-2">
                <MapPin size={14} className="text-brandPink" /> {location}
              </span>
            )}
            {website && (
              <a
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-brandBlue hover:underline"
              >
                <LinkIcon size={14} /> {website.replace(/^https?:\/\//, '')}
              </a>
            )}
            {formattedBirthday && (
              <span className="flex items-center gap-2">
                <Calendar size={14} className="text-brandBlue" /> Born {formattedBirthday}
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-4 border-b border-white/70 pb-2 text-sm font-semibold">
          <button
            onClick={() => onTabChange('posts')}
            className={cn(
              'rounded-2xl px-4 py-2 transition',
              activeTab === 'posts'
                ? 'bg-gradient-to-r from-brandPink/50 via-white to-brandBlue/50 text-brandText'
                : 'text-gray-500 hover:bg-brandPink/20 hover:text-brandText',
            )}
          >
            Posts
          </button>
          {showLikesTab && (
            <button
              onClick={() => onTabChange('likes')}
              className={cn(
                'rounded-2xl px-4 py-2 transition',
                activeTab === 'likes'
                  ? 'bg-gradient-to-r from-brandPink/50 via-white to-brandBlue/50 text-brandText'
                  : 'text-gray-500 hover:bg-brandPink/20 hover:text-brandText',
              )}
            >
              Likes
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-2xl bg-brandPink/15 px-3 py-1 text-brandText">
      <span className="font-semibold">{value}</span> {label}
    </span>
  );
}
