import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

/**
 * Admin CSV importer for the waitlist.
 *
 * Why this exists
 *   The Atto Railway DB is shared with another service whose migrations have
 *   twice now wiped `waitlist_signups` (and `sms_consent_records`) without
 *   warning. Until that's resolved upstream we need a 30-second recovery
 *   path: download the source-of-truth sheet as CSV, drop it into the admin,
 *   and the table is back. Same endpoint also handles ad-hoc bulk inserts
 *   without leaning on psql.
 *
 * Accepted CSV
 *   Two header layouts are supported (case-insensitive):
 *     1. The legacy Google Sheet:
 *        TIMESTAMP, NAME, LASTNAME, EMAIL, PHONE, OS
 *     2. The export format the admin offers:
 *        first_name, last_name, email, phone_number, platform_preference,
 *        created_at
 *   Rows without a timestamp/created_at are filtered out (per ops decision).
 *   Rows without an email are also dropped — email is the natural key.
 *   On conflict we DO NOTHING (existing rows win); the response counts both.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

type Row = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  platform: "ios" | "android" | null;
  createdAt: Date | null;
};

/**
 * Minimal RFC-4180 CSV parser. Avoids pulling in a dep for a one-screen task,
 * and is good enough for the export shapes we accept (quoted fields with
 * embedded commas and escaped quotes).
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      // Push any pending field, then commit the row if it contains anything.
      if (field !== "" || row.length > 0) {
        row.push(field);
        field = "";
      }
      if (row.length > 0) rows.push(row);
      row = [];
      // Swallow the second char of a CRLF
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Parse a D/M/YYYY H:MM:SS Google-Sheets timestamp, returning null if malformed. */
function parseSheetTimestamp(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) {
    // Fall through to ISO — the admin-export shape uses ISO 8601.
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, dd, mm, yyyy, hh, mi, ss] = m;
  const year = yyyy.length === 2 ? 2000 + Number(yyyy) : Number(yyyy);
  const d = new Date(Date.UTC(year, Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss)));
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizePlatform(v: string): "ios" | "android" | null {
  const x = v.trim().toLowerCase();
  return x === "ios" || x === "android" ? x : null;
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Attach a CSV file under the field name 'file'." },
      { status: 400 }
    );
  }
  const text = await file.text();
  const grid = parseCsv(text);
  if (grid.length < 2) {
    return NextResponse.json(
      { error: "CSV is empty or has no data rows." },
      { status: 400 }
    );
  }

  // Find columns by header name so column order is irrelevant.
  const headers = grid[0].map((h) => h.trim().toLowerCase());
  const idx = (...names: string[]) =>
    names.map((n) => headers.indexOf(n)).find((i) => i !== -1) ?? -1;
  const cols = {
    ts: idx("timestamp", "created_at", "createdat"),
    first: idx("name", "first_name", "firstname"),
    last: idx("lastname", "last_name"),
    email: idx("email"),
    phone: idx("phone", "phone_number", "phonenumber"),
    platform: idx("os", "platform", "platform_preference"),
  };
  if (cols.first === -1 || cols.last === -1 || cols.email === -1) {
    return NextResponse.json(
      { error: "CSV must include name, lastname and email columns." },
      { status: 400 }
    );
  }

  const rows: Row[] = [];
  let dropped = 0;
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const email = (r[cols.email] || "").trim().toLowerCase();
    const ts = cols.ts !== -1 ? (r[cols.ts] || "").trim() : "";
    if (!email || !ts) {
      dropped++;
      continue;
    }
    const phoneRaw = cols.phone !== -1 ? (r[cols.phone] || "").trim() : "";
    rows.push({
      firstName: (r[cols.first] || "").trim(),
      lastName: (r[cols.last] || "").trim(),
      email,
      phone: phoneRaw && phoneRaw !== "#ERROR!" ? phoneRaw : null,
      platform: cols.platform !== -1 ? normalizePlatform(r[cols.platform] || "") : null,
      createdAt: parseSheetTimestamp(ts),
    });
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No importable rows. Make sure each row has a timestamp and email.", dropped },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  try {
    await client.query("BEGIN");
    for (const row of rows) {
      const res = await client.query(
        `INSERT INTO waitlist_signups
           (first_name, last_name, email, phone_number, platform_preference,
            source, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,'sheet_migration',$6,$6)
         ON CONFLICT (email) DO NOTHING`,
        [
          row.firstName,
          row.lastName,
          row.email,
          row.phone,
          row.platform,
          row.createdAt,
        ]
      );
      if ((res.rowCount ?? 0) > 0) inserted++;
      else skipped++;
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[/api/admin/waitlist/import] failed:", err);
    return NextResponse.json(
      { error: "Import failed. Check the file and try again." },
      { status: 500 }
    );
  } finally {
    client.release();
  }

  const { rows: totalRows } = await pool.query(
    "SELECT COUNT(*)::int AS total FROM waitlist_signups"
  );

  return NextResponse.json({
    inserted,
    skipped,
    dropped,
    total: totalRows[0].total,
  });
}
