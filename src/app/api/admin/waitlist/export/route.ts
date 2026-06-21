import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

/**
 * CSV export for the waitlist.
 *
 * Mirrors the filter logic of the list endpoint (search + platform) but
 * returns *every* matching row — no LIMIT/OFFSET — so the admin gets the full
 * dataset rather than just the page currently on screen. The column layout
 * (first_name, last_name, email, phone_number, platform_preference,
 * created_at) is exactly the "admin export" shape the importer accepts, so an
 * export can be re-imported as-is.
 *
 * Protected by the global Basic Auth middleware (see src/middleware.ts).
 */
const pool = new Pool({
  connectionString: process.env.WEB_DATABASE_URL || process.env.DATABASE_URL,
  max: 3,
});

/** RFC-4180 field escaping: quote when the value contains a comma, quote or newline. */
function csvField(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const search = (sp.get("search") || "").trim();
  const platformParam = sp.get("platform");
  const platform =
    platformParam === "ios" ||
    platformParam === "android" ||
    platformParam === "unknown"
      ? platformParam
      : "all";

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
    const { rows } = await pool.query(
      `SELECT first_name, last_name, email, phone_number,
              platform_preference, created_at
         FROM waitlist_signups
         ${whereSql}
         ORDER BY created_at DESC NULLS LAST, email ASC`,
      values
    );

    const header = [
      "first_name",
      "last_name",
      "email",
      "phone_number",
      "platform_preference",
      "created_at",
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.first_name,
          r.last_name,
          r.email,
          r.phone_number,
          r.platform_preference,
          r.created_at ? new Date(r.created_at).toISOString() : "",
        ]
          .map(csvField)
          .join(",")
      ),
    ];
    // Prepend a UTF-8 BOM so Excel opens accented names correctly.
    const csv = "﻿" + lines.join("\r\n");

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="waitlist-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[/api/admin/waitlist/export] failed:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
