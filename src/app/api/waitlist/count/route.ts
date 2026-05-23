import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

// Public counter for the home page. Cached for 10s at the edge so the
// odometer's 10-second polling can't hammer Postgres if traffic spikes.
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
  } catch {
    return NextResponse.json({ count: null }, { status: 500 });
  }
}
