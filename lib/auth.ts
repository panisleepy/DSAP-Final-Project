import NextAuth, { type NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { prisma } from "./prisma";
import { getServerSession } from "next-auth";

const generateAlias = (name?: string | null) => {
  const base = (name ?? "murmur").toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "murmur"}_${suffix}`;
};

const baseAdapter = PrismaAdapter(prisma);

type BaseCreateUser = NonNullable<typeof baseAdapter.createUser>;

const adapter: Adapter = {
  ...baseAdapter,
  async createUser(data: Parameters<BaseCreateUser>[0]) {
    let alias = generateAlias(data.name);

    while (await prisma.user.findUnique({ where: { alias } })) {
      alias = generateAlias(data.name);
    }

    const payload = {
      ...data,
      alias,
      userIdSet: false,
    } as AdapterUser;

    return baseAdapter.createUser!(payload);
  },
};

const baseAuthOptions: Omit<NextAuthOptions, "adapter"> = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_ID ?? "",
      clientSecret: process.env.GOOGLE_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    GitHub({
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.alias = (token.alias as string) ?? session.user.alias ?? "";
        session.user.userIdSet = Boolean(token.userIdSet);
        if (token.name) {
          session.user.name = token.name as string;
        }
        if (token.picture) {
          session.user.image = token.picture as string;
        }
      }
      return session;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        if (!user.alias) {
          const existing = await prisma.user.findUnique({
            where: { id: user.id },
            select: { alias: true, userIdSet: true },
          });

          token.alias = existing?.alias ?? generateAlias(user.name);

          if (!existing?.alias) {
            await prisma.user.update({
              where: { id: user.id },
              data: { alias: token.alias as string, userIdSet: false },
            });
          }

          token.userIdSet = existing?.userIdSet ?? false;
        } else {
          token.alias = user.alias;
          token.userIdSet = user.userIdSet ?? false;
        }
      }

      if (!token.alias && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { alias: true, userIdSet: true },
        });
        token.alias = dbUser?.alias ?? generateAlias();
        token.userIdSet = dbUser?.userIdSet ?? false;
      }

      if (trigger === "update" && session) {
        const updateData = session as Partial<{
          alias: string;
          userIdSet: boolean;
          user: { alias?: string; userIdSet?: boolean; name?: string | null; image?: string | null };
        }>;

        const updatedAlias = updateData.alias ?? updateData.user?.alias;
        const updatedUserIdSet = updateData.userIdSet ?? updateData.user?.userIdSet;
        const updatedName = updateData.user?.name ?? (session as any).name;
        const updatedImage = updateData.user?.image ?? (session as any).image;

        if (typeof updatedAlias === "string") {
          token.alias = updatedAlias;
        }
        if (typeof updatedUserIdSet === "boolean") {
          token.userIdSet = updatedUserIdSet;
        }
        if (typeof updatedName === "string") {
          token.name = updatedName;
        }
        if (typeof updatedImage === "string") {
          token.picture = updatedImage;
        }
      }

      return token;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.alias) {
        await prisma.user.update({
          where: { id: user.id },
          data: { alias: generateAlias(user.name), userIdSet: false },
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { userIdSet: false },
        });
      }
    },
  },
  pages: {
    signIn: "/signin",
  },
};

export const authOptions: NextAuthOptions = {
  ...baseAuthOptions,
  adapter,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

export const auth = () => getServerSession(authOptions);


