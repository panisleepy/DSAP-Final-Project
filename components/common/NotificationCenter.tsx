"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Bell, Check, X } from "lucide-react";
import Link from "next/link";

import { getPusherClient } from "@/lib/pusher-client";

type NotificationType = "like" | "repost" | "comment" | "mention";

interface NotificationPayload {
  notificationId?: string;
  type: NotificationType;
  postId: string;
  actor?: {
    id?: string;
    alias?: string | null;
    name?: string | null;
  };
  comment?: {
    content: string;
  };
  commentPreview?: string | null;
  excerpt?: string;
  createdAt?: string;
}

interface NotificationItem {
  id: string;
  type: NotificationType;
  postId: string;
  actorAlias?: string | null;
  actorName?: string | null;
  commentContent?: string;
  excerpt?: string;
  createdAt: number;
  read: boolean;
}

export function NotificationCenter() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) {
      setItems([]);
      setLoaded(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/notifications");
        const text = await response.text();
        if (!response.ok) {
          const detail = text ? (() => { try { return JSON.parse(text).detail; } catch { return text; } })() : null;
          throw new Error(detail ? String(detail) : "Failed to load notifications");
        }
        const data = text
          ? (JSON.parse(text) as Array<{
              id: string;
              type: NotificationType;
              postId: string;
              actor: { alias?: string | null; name?: string | null } | null;
              commentPreview?: string | null;
              createdAt: string;
              read: boolean;
            }> )
          : [];

        if (cancelled) return;

        setItems(
          data.map((notification) => ({
            id: notification.id,
            type: notification.type,
            postId: notification.postId,
            actorAlias: notification.actor?.alias ?? null,
            actorName: notification.actor?.name ?? null,
            commentContent:
              notification.type === "comment" ? notification.commentPreview ?? undefined : undefined,
            excerpt:
              notification.type === "mention" ? notification.commentPreview ?? undefined : undefined,
            createdAt: new Date(notification.createdAt).getTime(),
            read: notification.read,
          })),
        );
        setLoaded(true);
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const client = getPusherClient();
    if (!client) return;

    const channelName = `user-${session.user.id}`;
    const channel = client.subscribe(channelName);

    const handler = (payload: NotificationPayload) => {
      const id = payload.notificationId ?? `${payload.postId}-${payload.actor?.id ?? Math.random()}`;
      const createdAt = payload.createdAt ? new Date(payload.createdAt).getTime() : Date.now();
      setItems((prev) => {
        const withoutExisting = prev.filter((item) => item.id !== id);
        return [
          {
            id,
            type: payload.type,
            postId: payload.postId,
            actorAlias: payload.actor?.alias ?? null,
            actorName: payload.actor?.name ?? null,
            commentContent:
              payload.type === "comment"
                ? payload.comment?.content ?? payload.commentPreview ?? undefined
                : undefined,
            excerpt:
              payload.type === "mention"
                ? payload.comment?.content ?? payload.commentPreview ?? payload.excerpt
                : undefined,
            createdAt,
            read: false,
          },
          ...withoutExisting,
        ];
      });
    };

    channel.bind("notification:received", handler);

    return () => {
      channel.unbind("notification:received", handler);
      client.unsubscribe(channelName);
    };
  }, [session?.user?.id]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const markRead = async (ids?: string[]) => {
    if (!session?.user?.id) return;
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids && ids.length > 0 ? { ids } : {}),
    }).catch((error) => console.error("Failed to mark notifications", error));
  };

  const dismissNotification = async (id: string) => {
    setItems((prev) => prev.filter((notification) => notification.id !== id));
    await fetch(`/api/notifications/${id}`, { method: "DELETE" }).catch((error) =>
      console.error("Failed to delete notification", error),
    );
  };

  const handleMarkAllRead = async () => {
    const ids = items.filter((item) => !item.read).map((item) => item.id);
    if (ids.length === 0) return;
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    await markRead(ids);
  };

  const handleMarkRead = async (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    await markRead([id]);
  };

  if (!session?.user?.id) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col items-end gap-2">
      <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 shadow-sm backdrop-blur transition hover:bg-white/90"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-brandText" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[1.5rem] rounded-full bg-brandPink px-1.5 py-0.5 text-xs font-semibold text-brandText shadow">
            {unreadCount}
          </span>
        )}
      </button>
      </div>

      {open && (
        <div className="w-80 rounded-3xl bg-white/95 p-3 shadow-xl ring-1 ring-brandPink/30">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-brandText">Notifications</p>
            {items.length > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-brandBlue hover:underline"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          {loading && !loaded ? (
            <p className="rounded-2xl bg-brandPink/10 p-4 text-xs text-gray-500">
              Loading notifications…
            </p>
          ) : items.length === 0 ? (
            <p className="rounded-2xl bg-brandPink/10 p-4 text-xs text-gray-500">
              You’re all caught up. Enjoy the quiet murmurs ✨
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-2xl border bg-white/90 p-3 text-sm shadow-sm transition ${
                    item.read ? "border-white/70 text-gray-500" : "border-brandPink/50 text-brandText"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {item.actorName ?? item.actorAlias ?? "Someone"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.type === "like" && "liked your murmur"}
                        {item.type === "repost" && "reposted your murmur"}
                        {item.type === "comment" && "replied to your murmur"}
                        {item.type === "mention" && "mentioned you"}
                      </p>
                      {item.commentContent && (
                        <p className="mt-2 rounded-xl bg-brandPink/20 p-2 text-xs">
                          “{item.commentContent}”
                        </p>
                      )}
                      {item.type === "mention" && item.excerpt && (
                        <p className="mt-2 rounded-xl bg-brandPink/20 p-2 text-xs">
                          “{item.excerpt}”
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissNotification(item.id)}
                      className="text-gray-300 hover:text-gray-500"
                      aria-label="Dismiss notification"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                    <time>
                      {new Date(item.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    <Link
                      href={`/#post-${item.postId}`}
                      onClick={() => handleMarkRead(item.id)}
                      className="text-brandBlue hover:underline"
                    >
                      View
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
