import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { measureTweetLength } from "@/lib/text-counter";
import { ensureObjectId, getDb } from "@/lib/mongo";

const draftSchema = z.object({
  id: z.string().optional(),
  content: z.string().min(1).max(2000),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const drafts = await prisma.draft.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(drafts);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = draftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { id, content } = parsed.data;
  const { remaining } = measureTweetLength(content);
  if (remaining < 0) {
    return NextResponse.json({ error: "Draft exceeds 2000 character limit" }, { status: 422 });
  }

  try {
    const db = await getDb();
    const now = new Date();

    if (id) {
      const result = await db.collection("Draft").findOneAndUpdate(
        { _id: ensureObjectId(id), userId: ensureObjectId(session.user.id) },
        { $set: { content, updatedAt: now } },
        { returnDocument: "after" },
      );

      const draft = result?.value ?? null;
      if (!draft) {
        return NextResponse.json({ error: "Draft not found" }, { status: 404 });
      }

      return NextResponse.json({
        id: draft._id.toHexString(),
        content: draft.content,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
      });
    }

    const document = {
      content,
      userId: ensureObjectId(session.user.id),
      createdAt: now,
      updatedAt: now,
    };

    const { insertedId } = await db.collection("Draft").insertOne(document);

    return NextResponse.json({
      id: insertedId.toHexString(),
      content: document.content,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    });
  } catch (error) {
    console.error('[drafts:save]', error);
    return NextResponse.json({ error: 'Unable to save draft' }, { status: 500 });
  }
}
