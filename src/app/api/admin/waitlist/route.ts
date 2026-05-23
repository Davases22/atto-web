import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

/**
 * Admin-only CRUD for the waitlist. This route is protected by the global
 * Basic Auth middleware (see src/middleware.ts) which matches /api/admin/*.
 *
 * The public signup form lives at /api/waitlist and runs the full Zod +
 * libphonenumber + consent-record flow. Here we intentionally trust the
 * admin's input more (no consent record is written), since this endpoint
 * exists for ops corrections and bulk fixes, not for end-user signups.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

interface ListParams {
  search: string;
  platform: "ios" | "android" | "unknown" | "all";
  limit: number;
  offset: number;
}

function parseListParams(req: NextRequest): ListParams {
  const sp = new URL(req.url).searchParams;
  const platform = sp.get("platform");
  return {
    search: (sp.get("search") || "").trim(),
    platform:
      platform === "ios" || platform === "android" || platform === "unknown"
        ? platform
        : "all",
    limit: Math.min(Math.max(Number(sp.get("limit")) || 50, 1), 200),
    offset: Math.max(Number(sp.get("offset")) || 0, 0),
  };
}

// GET — list signups with optional search + platform filter
export async function GET(req: NextRequest) {
  const { search, platform, limit, offset } = parseListParams(req);

  const where: string[] = [];
  const values: unknown[] = [];

  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    const i = values.length;
    where.push(
      `(LOWER(first_name) LIKE $${i} OR LOWER(last_name) LIKE $${i} OR LOWER(email) LIKE $${i} OR phone_number LIKE $${i})`
    );
  }
  if (platform === "unknown") {
    where.push("platform_preference IS NULL");
  } else if (platform === "ios" || platform === "android") {
    values.push(platform);
    where.push(`platform_preference = $${values.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `SELECT id, first_name, last_name, email, phone_number,
                platform_preference, source, created_at, updated_at
           FROM waitlist_signups
           ${whereSql}
           ORDER BY created_at DESC NULLS LAST, email ASC
           LIMIT ${limit} OFFSET ${offset}`,
        values
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM waitlist_signups ${whereSql}`,
        values
      ),
    ]);

    return NextResponse.json({
      signups: rows,
      total: countRows[0].total,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[/api/admin/waitlist] list failed:", err);
    return NextResponse.json({ error: "Failed to list" }, { status: 500 });
  }
}

// POST — create a signup manually from the admin
export async function POST(req: NextRequest) {
  let body: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    platform?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const firstName = (body.firstName || "").trim();
  const lastName = (body.lastName || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const phone = (body.phone || "").trim() || null;
  const platform =
    body.platform === "ios" || body.platform === "android"
      ? body.platform
      : null;

  // Per-field validation so the UI can surface a specific message rather than
  // a single "all required" blob. The order matches the on-screen field order.
  const missing: string[] = [];
  if (!firstName) missing.push("First name");
  if (!lastName) missing.push("Last name");
  if (!email) missing.push("Email");
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required` },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "That email doesn't look valid" },
      { status: 400 }
    );
  }

  try {
    // We enforce phone uniqueness in application code because legacy rows
    // already share phone numbers across accounts and a DB-level constraint
    // would refuse to apply. This SELECT is cheap (no index needed for the
    // size of this table; can add one later if it grows).
    if (phone) {
      const phoneDupe = await pool.query(
        "SELECT id FROM waitlist_signups WHERE phone_number = $1 LIMIT 1",
        [phone]
      );
      if ((phoneDupe.rowCount ?? 0) > 0) {
        return NextResponse.json(
          { error: "Another signup already uses that phone number" },
          { status: 409 }
        );
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO waitlist_signups
         (first_name, last_name, email, phone_number, platform_preference, source)
       VALUES ($1,$2,$3,$4,$5,'admin')
       ON CONFLICT (email) DO NOTHING
       RETURNING id, first_name, last_name, email, phone_number,
                 platform_preference, source, created_at, updated_at`,
      [firstName, lastName, email, phone, platform]
    );
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "A signup with this email already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ signup: rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[/api/admin/waitlist] create failed:", err);
    return NextResponse.json({ error: "Couldn't create signup. Try again." }, { status: 500 });
  }
}
