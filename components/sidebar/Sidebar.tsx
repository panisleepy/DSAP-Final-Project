'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Home, UserRound, PenSquare, Sparkles, LogOut, User } from 'lucide-react';
import { useCompose } from '@/components/post/ComposeProvider';

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Home',
    icon: Home,
    match: (pathname: string) => pathname === '/',
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: UserRound,
    match: (pathname: string) => pathname.startsWith('/profile') || pathname.startsWith('/u/'),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { open } = useCompose();

  const authenticated = Boolean(session?.user?.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between rounded-3xl bg-white/80 px-4 py-3 shadow-sm backdrop-blur md:hidden">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-brandText">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-brandPink via-white to-brandBlue shadow-sm">
            <Sparkles className="h-4 w-4 text-white drop-shadow" />
          </span>
          murmurland
        </Link>
        <div className="flex items-center gap-2">
          {NAV_ITEMS.map(({ href, icon: Icon, label, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-2xl border border-white/60 text-brandText transition',
                  active ? 'bg-white/90 shadow-sm' : 'bg-white/70 hover:bg-white'
                )}
                aria-label={label}
              >
                <Icon size={18} />
              </Link>
            );
          })}
          <button
            onClick={open}
            className="flex h-10 items-center justify-center rounded-2xl bg-gradient-to-r from-brandBlue to-brandPink px-4 text-sm font-semibold text-white shadow transition hover:brightness-105"
          >
            Post
          </button>
        </div>
      </div>

      <aside className="sticky top-6 hidden h-[90vh] min-w-[230px] flex-col justify-between rounded-3xl bg-white/85 p-6 shadow-sm backdrop-blur-xl md:flex">
        <div className="space-y-7">
          <Link href="/" className="flex items-center gap-3 text-2xl font-semibold text-brandText">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brandPink via-white to-brandBlue shadow-sm">
              <Sparkles className="h-5 w-5 text-white drop-shadow" />
            </span>
            murmurland
          </Link>

          <nav className="space-y-2 text-base font-medium">
            {NAV_ITEMS.map(({ href, icon: Icon, label, match }) => {
              const active = match(pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 transition',
                    active
                      ? 'bg-gradient-to-r from-brandPink/40 via-white to-brandBlue/40 text-brandText shadow-sm'
                      : 'text-brandText/60 hover:bg-brandPink/20 hover:text-brandText'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-2xl border border-white/60 text-brandText backdrop-blur-sm',
                      active ? 'bg-white/80' : 'bg-white/50'
                    )}
                  >
                    <Icon size={18} />
                  </span>
                  {label}
                </Link>
              );
            })}

            <button
              onClick={open}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brandBlue to-brandPink py-3 text-base font-semibold text-white shadow transition hover:brightness-105"
            >
              <PenSquare size={18} />
              Post
            </button>
          </nav>
        </div>

        <div ref={menuRef} className="relative">
          <button
            onClick={() => {
              if (!authenticated) {
                return;
              }
              setMenuOpen((prev) => !prev);
            }}
            className={cn(
              'flex w-full items-center gap-3 rounded-2xl border border-white/70 bg-white/90 px-4 py-3 text-left text-sm text-brandText shadow-sm transition',
              authenticated ? 'hover:bg-white cursor-pointer' : 'cursor-default opacity-90',
            )}
            aria-disabled={!authenticated}
          >
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brandBlue/60 to-brandPink/60">
              {session?.user?.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.alias ?? 'avatar'}
                  width={40}
                  height={40}
                  className="h-10 w-10 object-cover"
                />
              ) : (
                <span className="text-lg font-semibold text-brandText">
                  {session?.user?.name?.slice(0, 1) ?? '?'}
                </span>
              )}
            </span>
            <div className="flex flex-1 flex-col">
              <span className="font-semibold">{session?.user?.name ?? 'Guest'}</span>
              <span className="text-xs text-gray-500">
                {authenticated ? `@${session?.user?.alias ?? "murmur"}` : "Sign in to personalise"}
              </span>
            </div>
            <User className="h-4 w-4 text-gray-400" />
          </button>

          {menuOpen && authenticated && (
            <div className="absolute inset-x-0 bottom-[calc(100%+0.75rem)] rounded-2xl border border-white/70 bg-white/95 p-3 text-sm shadow-xl">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  signOut();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-red-500 transition hover:bg-brandPink/20"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
