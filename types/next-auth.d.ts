import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id: string;
      alias: string;
      userIdSet: boolean;
    };
  }

  interface User {
    alias?: string;
    userIdSet?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    alias?: string;
    userIdSet?: boolean;
  }
}

