import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { ensureObjectId, getDb } from "@/lib/mongo";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const db = await getDb();
  await db.collection("Notification").deleteOne({
    _id: ensureObjectId(id),
    userId: ensureObjectId(session.user.id),
  });

  return NextResponse.json({ ok: true });
}
