#!/usr/bin/env node
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
const users = await prisma.user.findMany({
    select: { id: true, alias: true, name: true },
    orderBy: { alias: "asc" },
  });
  users.forEach((user) => {
    console.log(`${user.id} | ${user.alias} | ${user.name ?? ""}`);
  });
  await prisma.$disconnect();
})();

