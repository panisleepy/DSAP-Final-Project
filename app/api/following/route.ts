import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const following = await prisma.follow.findMany({
    where: { followerId: session.user.id },
    select: {
      following: { select: { id: true, alias: true, name: true } },
    },
  });

  return NextResponse.json(
    following
      .filter((entry) => entry.following)
      .map((entry) => ({
        id: entry.following!.id,
        alias: entry.following!.alias,
        name: entry.following!.name,
      }))
  );
}
