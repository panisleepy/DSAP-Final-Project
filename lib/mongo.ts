import { MongoClient, ObjectId, type Db } from "mongodb";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

function resolveDatabaseName(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/^\//, "");
    if (pathname) {
      const [dbName] = pathname.split("/");
      return dbName;
    }
  } catch (error) {
    console.error("Failed to parse DATABASE_URL", error);
  }
  return process.env.MONGODB_DB ?? "murmur";
}

const databaseName = resolveDatabaseName(databaseUrl);

const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>;
};

const mongoClientPromise = globalForMongo._mongoClientPromise ?? new MongoClient(databaseUrl).connect();

if (process.env.NODE_ENV !== "production") {
  globalForMongo._mongoClientPromise = mongoClientPromise;
}

export async function getMongoClient(): Promise<MongoClient> {
  return mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(databaseName);
}

export function toObjectId(id: string | ObjectId | null | undefined): ObjectId | null {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  try {
    return new ObjectId(id);
  } catch (error) {
    console.error("Invalid ObjectId", id, error);
    return null;
  }
}

export function ensureObjectId(id: string): ObjectId {
  const objectId = toObjectId(id);
  if (!objectId) {
    throw new Error(`Invalid ObjectId: ${id}`);
  }
  return objectId;
}

export { ObjectId };
