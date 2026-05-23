import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

// Public counter for the home page. Cached for 10s at the edge so the
// odometer's 10-second polling can't hammer Postgres if traffic spikes.
//
// On DB failure we deliberately return { count: 0 } with a 200 (not a 500
// with null) because the front-end odometer free-rolls forever when it
// receives a non-number — better to settle on a temporary 0 and try again
// on the next 10-second poll than to leave the hero spinning indefinitely.
export async function GET() {
  try {
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM waitlist_signups"
    );
    return NextResponse.json(
      { count: rows[0].count },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=10, stale-while-revalidate=30",
        },
      }
    );
  } catch (err) {
    console.error("[/api/waitlist/count] query failed:", err);
    return NextResponse.json({ count: 0 });
  }
}
