import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { ensureObjectId, getDb } from "@/lib/mongo";

const MAX_LENGTHS = {
  name: 60,
  bio: 280,
  location: 80,
  website: 120,
};

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id && !session?.user?.alias) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (trimmed.length > MAX_LENGTHS.name) {
      return NextResponse.json({ error: "Name is too long" }, { status: 400 });
    }
    updateData.name = trimmed;
  }

  if (typeof body.bio === "string") {
    if (body.bio.length > MAX_LENGTHS.bio) {
      return NextResponse.json({ error: "Bio is too long" }, { status: 400 });
    }
    updateData.bio = body.bio.trim() ? body.bio.trim() : null;
  }

  if (typeof body.location === "string") {
    if (body.location.length > MAX_LENGTHS.location) {
      return NextResponse.json({ error: "Location is too long" }, { status: 400 });
    }
    updateData.location = body.location.trim() ? body.location.trim() : null;
  }

  if (typeof body.website === "string") {
    if (body.website.length > MAX_LENGTHS.website) {
      return NextResponse.json({ error: "Website is too long" }, { status: 400 });
    }
    const trimmed = body.website.trim();
    updateData.website = trimmed ? trimmed : null;
  }

  if (typeof body.image === "string") {
    updateData.image = body.image.trim() || null;
  }

  if (typeof body.coverImage === "string") {
    updateData.coverImage = body.coverImage.trim() || null;
  }

  if (body.birthday === null) {
    updateData.birthday = null;
  } else if (typeof body.birthday === "string" && body.birthday.trim()) {
    const date = new Date(body.birthday);
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid birthday" }, { status: 400 });
    }
    updateData.birthday = date;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const db = await getDb();
  const actor = session.user!;
  const now = new Date();
  const projection = {
    name: 1,
    bio: 1,
    location: 1,
    website: 1,
    birthday: 1,
    image: 1,
    coverImage: 1,
    alias: 1,
  } as const;
  const updateDoc = {
    $set: {
      ...updateData,
      updatedAt: now,
    },
  };

  let filter: Record<string, unknown> | null = null;
  let matched = 0;

  if (actor.id) {
    try {
      filter = { _id: ensureObjectId(actor.id) };
      const result = await db.collection("User").updateOne(filter, updateDoc);
      matched = result.matchedCount ?? 0;
      if (!matched) {
        filter = null;
      }
    } catch {
      filter = null;
    }
  }

  if (!matched && actor.alias) {
    filter = { alias: actor.alias };
    const result = await db.collection("User").updateOne(filter, updateDoc);
    matched = result.matchedCount ?? 0;
  }

  if (!matched || !filter) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updated = await db.collection("User").findOne(filter, { projection });
  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    name: updated.name ?? "",
    bio: updated.bio ?? null,
    location: updated.location ?? null,
    website: updated.website ?? null,
    birthday: updated.birthday ? new Date(updated.birthday).toISOString() : null,
    image: updated.image ?? null,
    coverImage: updated.coverImage ?? null,
    alias: updated.alias ?? session.user?.alias ?? null,
  });
}
