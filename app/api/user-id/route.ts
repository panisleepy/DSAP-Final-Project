import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { ensureObjectId, getDb } from "@/lib/mongo";

const schema = z.object({
  userId: z
    .string()
    .min(3, "User ID must be at least 3 characters")
    .max(20, "User ID must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "User ID can only contain letters, numbers, and underscores"),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid user ID" }, { status: 400 });
  }

  const { userId } = parsed.data;

  const db = await getDb();

  const existing = await db.collection("User").findOne({ alias: userId }, { projection: { _id: 1 } });

  if (existing && existing._id.toHexString() !== session.user.id) {
    return NextResponse.json({ error: "This user ID is already taken" }, { status: 409 });
  }

  const updateDoc = {
    $set: {
      alias: userId,
      userIdSet: true,
      updatedAt: new Date(),
    },
  };

  let filter: Record<string, unknown> | null = null;
  let matched = 0;

  try {
    filter = { _id: ensureObjectId(session.user.id) };
    const result = await db.collection("User").updateOne(filter, updateDoc);
    matched = result.matchedCount ?? 0;
    if (!matched) {
      filter = null;
    }
  } catch {
    filter = null;
  }

  if (!matched && session.user.alias) {
    filter = { alias: session.user.alias };
    const result = await db.collection("User").updateOne(filter, updateDoc);
    matched = result.matchedCount ?? 0;
  }

  if (!matched || !filter) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updated = await db.collection("User").findOne(filter, { projection: { alias: 1 } });

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, userId: updated.alias ?? userId });
}


