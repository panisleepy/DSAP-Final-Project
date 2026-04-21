import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureObjectId, getDb } from '@/lib/mongo';

type RouteContext = {
  params: Promise<{ alias: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { alias } = await context.params;
  const target = await prisma.user.findUnique({ where: { alias }, select: { id: true } });
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (target.id === session.user.id) {
    return NextResponse.json({ error: 'You cannot follow yourself' }, { status: 400 });
  }

  const db = await getDb();
  try {
    await db.collection('Follow').insertOne({
      followerId: ensureObjectId(session.user.id),
      followingId: ensureObjectId(target.id),
      createdAt: new Date(),
    });
  } catch (error) {
    // Ignore duplicate key errors (already following)
    if (!(error as { code?: number }).code || (error as { code?: number }).code !== 11000) {
      throw error;
    }
  }

  const followers = await prisma.follow.count({ where: { followingId: target.id } });

  return NextResponse.json({ following: true, followers });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { alias } = await context.params;
  const target = await prisma.user.findUnique({ where: { alias }, select: { id: true } });
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const db = await getDb();
  await db.collection('Follow').deleteMany({
    followerId: ensureObjectId(session.user.id),
    followingId: ensureObjectId(target.id),
  });

  const followers = await prisma.follow.count({ where: { followingId: target.id } });

  return NextResponse.json({ following: false, followers });
}
