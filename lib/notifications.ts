import { ensureObjectId, getDb } from "@/lib/mongo";

export type NotificationType = "like" | "repost" | "comment" | "mention";

export interface CreateNotificationInput {
  userId: string;
  actorId: string;
  type: NotificationType;
  postId?: string | null;
  commentId?: string | null;
  commentPreview?: string | null;
}

export interface CreatedNotification {
  id: string;
  createdAt: Date;
}

export async function createNotification(input: CreateNotificationInput): Promise<CreatedNotification> {
  const db = await getDb();
  const now = new Date();
  const document = {
    userId: ensureObjectId(input.userId),
    actorId: ensureObjectId(input.actorId),
    type: input.type,
    postId: input.postId ? ensureObjectId(input.postId) : null,
    commentId: input.commentId ? ensureObjectId(input.commentId) : null,
    commentPreview: input.commentPreview ?? null,
    readAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const { insertedId } = await db.collection("Notification").insertOne(document);
  return { id: insertedId.toHexString(), createdAt: now };
}

interface MentionNotificationOptions {
  postId: string;
  commentId?: string;
  actorId: string;
  targetUserId: string;
  preview?: string | null;
}

export interface MentionNotificationRecord {
  id: string;
  createdAt: Date;
  targetUserId: string;
}

export async function dispatchMentionNotifications(
  options: MentionNotificationOptions[],
): Promise<MentionNotificationRecord[]> {
  if (options.length === 0) {
    return [];
  }

  const db = await getDb();
  const now = new Date();

  const documents = options.map(({ postId, commentId, actorId, targetUserId, preview }) => ({
    userId: ensureObjectId(targetUserId),
    actorId: ensureObjectId(actorId),
    type: "mention" as const,
    postId: ensureObjectId(postId),
    commentId: commentId ? ensureObjectId(commentId) : null,
    commentPreview: preview ?? null,
    readAt: null,
    createdAt: now,
    updatedAt: now,
  }));

  const { insertedIds } = await db.collection("Notification").insertMany(documents);
  const ids = Object.values(insertedIds) as unknown as import("mongodb").ObjectId[];

  return documents.map((doc, index) => ({
    id: ids[index]!.toHexString(),
    createdAt: doc.createdAt,
    targetUserId: options[index]!.targetUserId,
  }));
}

export async function deleteNotifications(criteria: {
  userId: string;
  actorId?: string;
  type?: NotificationType;
  postId?: string;
  commentId?: string;
}): Promise<number> {
  const db = await getDb();
  const filter: Record<string, unknown> = {
    userId: ensureObjectId(criteria.userId),
  };

  if (criteria.actorId) {
    filter.actorId = ensureObjectId(criteria.actorId);
  }
  if (criteria.type) {
    filter.type = criteria.type;
  }
  if (criteria.postId) {
    filter.postId = ensureObjectId(criteria.postId);
  }
  if (criteria.commentId) {
    filter.commentId = ensureObjectId(criteria.commentId);
  }

  const result = await db.collection("Notification").deleteMany(filter);
  return result.deletedCount ?? 0;
}

export async function markNotificationsRead(userId: string, ids?: string[], read = true): Promise<void> {
  const db = await getDb();
  const filter: Record<string, unknown> = {
    userId: ensureObjectId(userId),
  };
  if (ids?.length) {
    filter._id = { $in: ids.map((id) => ensureObjectId(id)) };
  }

  await db.collection("Notification").updateMany(filter, {
    $set: { readAt: read ? new Date() : null, updatedAt: new Date() },
  });
}
