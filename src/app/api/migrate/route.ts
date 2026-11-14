import { NextRequest, NextResponse } from "next/server";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

export const maxDuration = 60;

// One-time (and idempotent/re-runnable) migration runner.
//
// Neon's connection string is injected into this function at request time by
// Vercel even when the env var is marked "Sensitive" (write-only — it can
// never be read back via the CLI or dashboard once set), so this route is how
// schema changes get applied: there is no way to run `drizzle-kit push`
// against the real database from a local shell.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  return req.nextUrl.searchParams.get("secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 500 });
  }

  try {
    const db = drizzle(neon(connectionString));
    await migrate(db, { migrationsFolder: "./drizzle" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
