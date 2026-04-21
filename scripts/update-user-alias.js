#!/usr/bin/env node

const { PrismaClient } = require("@prisma/client");

async function main() {
  const [oldAlias, newAlias] = process.argv.slice(2);

  if (!oldAlias || !newAlias) {
    console.error("Usage: node scripts/update-user-alias.js <oldAlias> <newAlias>");
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const target = await prisma.user.findUnique({ where: { alias: oldAlias } });
    if (!target) {
      console.error(`User with alias "${oldAlias}" not found.`);
      process.exit(1);
    }

    const existing = await prisma.user.findUnique({ where: { alias: newAlias } });
    if (existing) {
      console.error(`Alias "${newAlias}" is already in use.`);
      process.exit(1);
    }

    const updated = await prisma.user.update({
      where: { alias: oldAlias },
      data: { alias: newAlias },
      select: { id: true, alias: true, name: true },
    });

    console.log("Alias updated:", updated);
  } catch (error) {
    console.error("Failed to update alias:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

