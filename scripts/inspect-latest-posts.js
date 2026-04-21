#!/usr/bin/env node
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const posts = await prisma.post.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      authorId: true,
      author: { select: { id: true, alias: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  posts.forEach((post) => {
    console.log(post.id, post.author.alias, post.author.id);
  });
  await prisma.$disconnect();
})();

