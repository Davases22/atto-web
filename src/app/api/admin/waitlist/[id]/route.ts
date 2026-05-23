import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.WEB_DATABASE_URL || process.env.DATABASE_URL,
  max: 3,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH — edit any field of a single signup
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string | null;
    platform?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Build a dynamic UPDATE with only the fields the admin actually sent.
  // Using a Map keeps the column → value pairing explicit and lets us derive
  // both the SET clause and the parameter list from the same source.
  const updates = new Map<string, unknown>();
  if (body.firstName !== undefined) {
    const v = body.firstName.trim();
    if (!v) return NextResponse.json({ error: "First name can't be empty" }, { status: 400 });
    updates.set("first_name", v);
  }
  if (body.lastName !== undefined) {
    const v = body.lastName.trim();
    if (!v) return NextResponse.json({ error: "Last name can't be empty" }, { status: 400 });
    updates.set("last_name", v);
  }
  if (body.email !== undefined) {
    const v = body.email.trim().toLowerCase();
    if (!v) return NextResponse.json({ error: "Email can't be empty" }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return NextResponse.json({ error: "That email doesn't look valid" }, { status: 400 });
    }
    updates.set("email", v);
  }
  if (body.phone !== undefined) {
    const v = (body.phone || "").trim();
    updates.set("phone_number", v === "" ? null : v);
  }
  if (body.platform !== undefined) {
    updates.set(
      "platform_preference",
      body.platform === "ios" || body.platform === "android" ? body.platform : null
    );
  }

  if (updates.size === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // App-level uniqueness on phone: another row (not this one) using the same
  // number is a 409. We can't enforce this in the DB because legacy data
  // already contains shared numbers.
  const phoneValue = updates.get("phone_number");
  if (typeof phoneValue === "string") {
    const dupe = await pool.query(
      "SELECT id FROM waitlist_signups WHERE phone_number = $1 AND id <> $2 LIMIT 1",
      [phoneValue, id]
    );
    if ((dupe.rowCount ?? 0) > 0) {
      return NextResponse.json(
        { error: "Another signup already uses that phone number" },
        { status: 409 }
      );
    }
  }

  const cols = [...updates.keys()];
  const values = [...updates.values()];
  const setSql = cols
    .map((col, i) => `${col} = $${i + 1}`)
    .concat([`updated_at = now()`])
    .join(", ");

  values.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE waitlist_signups
          SET ${setSql}
        WHERE id = $${values.length}
        RETURNING id, first_name, last_name, email, phone_number,
                  platform_preference, source, created_at, updated_at`,
      values
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ signup: rows[0] });
  } catch (err: unknown) {
    // Postgres unique-violation on email
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "Another signup already uses that email" },
        { status: 409 }
      );
    }
    console.error("[/api/admin/waitlist/:id] update failed:", err);
    return NextResponse.json({ error: "Couldn't save changes. Try again." }, { status: 500 });
  }
}

// DELETE — remove a signup. Related consent rows keep their data (FK is ON
// DELETE SET NULL), so we don't lose the audit trail required by 10DLC.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM waitlist_signups WHERE id = $1",
      [id]
    );
    if (rowCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/admin/waitlist/:id] delete failed:", err);
    return NextResponse.json({ error: "Couldn't delete signup. Try again." }, { status: 500 });
  }
}
