-- =============================================================================
-- READ-ONLY REFERENCE — DO NOT RUN AGAINST MONGODB
-- This app uses Prisma + MongoDB (see schema.prisma). MongoDB has collections,
-- not SQL tables; empty data is fine — collections appear on first write.
--
-- To rebuild indexes / sync Prisma schema with your MongoDB:
--   npx prisma generate
--   npx prisma db push
--
-- Ensure .env has DATABASE_URL (Mongo connection string).
-- =============================================================================

-- Logical collection names in MongoDB match Prisma model names:
-- User, Post, Comment, Like, Repost, Follow, Draft, Notification,
-- Account, Session, VerificationToken

CREATE TABLE "User" (
  id              TEXT PRIMARY KEY,
  name            TEXT,
  email           TEXT UNIQUE,
  "emailVerified" TIMESTAMPTZ,
  image           TEXT,
  "coverImage"    TEXT,
  alias           TEXT NOT NULL UNIQUE,
  bio             TEXT,
  website         TEXT,
  location        TEXT,
  birthday        TIMESTAMPTZ,
  "userIdSet"     BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Post" (
  id              TEXT PRIMARY KEY,
  content         TEXT NOT NULL,
  "imageUrl"      TEXT,
  "authorId"      TEXT NOT NULL REFERENCES "User"(id),
  "parentPostId"  TEXT REFERENCES "Post"(id),
  "rootPostId"    TEXT REFERENCES "Post"(id),
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt"     TIMESTAMPTZ
);

CREATE TABLE "Comment" (
  id                TEXT PRIMARY KEY,
  content           TEXT NOT NULL,
  "authorId"        TEXT NOT NULL REFERENCES "User"(id),
  "postId"          TEXT NOT NULL REFERENCES "Post"(id),
  "parentCommentId" TEXT REFERENCES "Comment"(id),
  "rootPostId"      TEXT NOT NULL REFERENCES "Post"(id),
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt"       TIMESTAMPTZ
);

CREATE TABLE "Like" (
  id          TEXT PRIMARY KEY,
  "postId"    TEXT NOT NULL REFERENCES "Post"(id),
  "userId"    TEXT NOT NULL REFERENCES "User"(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("postId", "userId")
);

CREATE TABLE "Repost" (
  id               TEXT PRIMARY KEY,
  "userId"         TEXT NOT NULL REFERENCES "User"(id),
  "postId"         TEXT NOT NULL REFERENCES "Post"(id),
  "originalPostId" TEXT REFERENCES "Post"(id),
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("postId", "userId")
);

CREATE TABLE "Follow" (
  id            TEXT PRIMARY KEY,
  "followerId"  TEXT NOT NULL REFERENCES "User"(id),
  "followingId" TEXT NOT NULL REFERENCES "User"(id),
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("followerId", "followingId")
);

CREATE TABLE "Draft" (
  id          TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "User"(id),
  content     TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Notification" (
  id               TEXT PRIMARY KEY,
  "userId"         TEXT NOT NULL REFERENCES "User"(id),
  "actorId"        TEXT REFERENCES "User"(id),
  "postId"         TEXT,
  "commentId"      TEXT,
  type             TEXT NOT NULL,
  "commentPreview" TEXT,
  "readAt"         TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "Notification_userId_readAt_idx" ON "Notification" ("userId", "readAt");

CREATE TABLE "Account" (
  id                  TEXT PRIMARY KEY,
  "userId"            TEXT NOT NULL REFERENCES "User"(id),
  type                TEXT NOT NULL,
  provider            TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  refresh_token       TEXT,
  access_token        TEXT,
  expires_at          INTEGER,
  token_type          TEXT,
  scope               TEXT,
  id_token            TEXT,
  session_state       TEXT,
  oauth_token_secret  TEXT,
  oauth_token         TEXT,
  UNIQUE (provider, "providerAccountId")
);

CREATE TABLE "Session" (
  id            TEXT PRIMARY KEY,
  "sessionToken" TEXT NOT NULL UNIQUE,
  "userId"      TEXT NOT NULL REFERENCES "User"(id),
  expires       TIMESTAMPTZ NOT NULL
);

CREATE TABLE "VerificationToken" (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  expires    TIMESTAMPTZ NOT NULL,
  UNIQUE (identifier, token)
);
