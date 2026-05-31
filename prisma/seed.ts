import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { ObjectId } from "mongodb";

import {
  BENCHMARK_COMMENT_TARGET,
  BENCHMARK_POST_ID,
  BENCHMARK_POST_SLUG,
  BENCHMARK_ROOT_COMMENT_COUNT,
} from "../lib/benchmark";
import { ensureObjectId, getDb } from "../lib/mongo";

const prisma = new PrismaClient();

const BATCH_SIZE = 500;

async function ensureBenchmarkAuthor() {
  const existing = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.user.create({
    data: {
      alias: "benchmark_bot",
      name: "Benchmark Bot",
      email: "benchmark@murmurland.local",
      userIdSet: true,
    },
    select: { id: true },
  });

  return created.id;
}

async function seedBenchmarkPost(authorId: string) {
  const postObjectId = ensureObjectId(BENCHMARK_POST_ID);
  const authorObjectId = ensureObjectId(authorId);
  const db = await getDb();
  const now = new Date();

  await db.collection("Comment").deleteMany({ postId: postObjectId });
  await db.collection("Post").deleteOne({ _id: postObjectId });

  await db.collection("Post").insertOne({
    _id: postObjectId,
    content: `[${BENCHMARK_POST_SLUG}] DSA 留言樹壓力測試貼文 — 用於 Baseline vs Map+DFS 效能對照實驗。`,
    authorId: authorObjectId,
    parentPostId: null,
    rootPostId: null,
    imageUrl: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Created benchmark post _id=${BENCHMARK_POST_ID} (slug: ${BENCHMARK_POST_SLUG})`);
}

async function seedBenchmarkComments(authorId: string) {
  const postObjectId = ensureObjectId(BENCHMARK_POST_ID);
  const authorObjectId = ensureObjectId(authorId);
  const db = await getDb();
  const baseTime = Date.now();

  const allCommentIds: ObjectId[] = [];
  const documents: Array<Record<string, unknown>> = [];

  const pushComment = (parentCommentId: ObjectId | null, index: number) => {
    const commentId = new ObjectId();
    allCommentIds.push(commentId);
    documents.push({
      _id: commentId,
      content: `[benchmark] tree node #${index}`,
      authorId: authorObjectId,
      postId: postObjectId,
      parentCommentId,
      rootPostId: postObjectId,
      deletedAt: null,
      createdAt: new Date(baseTime + index),
      updatedAt: new Date(baseTime + index),
    });
  };

  for (let index = 0; index < BENCHMARK_ROOT_COMMENT_COUNT; index += 1) {
    pushComment(null, index);
  }

  const remaining = BENCHMARK_COMMENT_TARGET - BENCHMARK_ROOT_COMMENT_COUNT;
  for (let index = 0; index < remaining; index += 1) {
    const parentIndex = Math.floor(Math.random() * allCommentIds.length);
    const parentCommentId = allCommentIds[parentIndex];
    pushComment(parentCommentId, BENCHMARK_ROOT_COMMENT_COUNT + index);
  }

  for (let offset = 0; offset < documents.length; offset += BATCH_SIZE) {
    const batch = documents.slice(offset, offset + BATCH_SIZE);
    await db.collection("Comment").insertMany(batch, { ordered: false });
    console.log(`Inserted comments ${Math.min(offset + BATCH_SIZE, documents.length)} / ${documents.length}`);
  }

  console.log(`Benchmark comment tree ready: ${documents.length} nodes under post ${BENCHMARK_POST_ID}`);
}

async function main() {
  console.log("Starting Murmurland benchmark seed...");
  const authorId = await ensureBenchmarkAuthor();
  await seedBenchmarkPost(authorId);
  await seedBenchmarkComments(authorId);
  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
