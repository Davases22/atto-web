import { NextRequest, NextResponse } from "next/server";
import { proxyToBackend, readJson } from "@/lib/admin-backend";

/** Plans, entitlements catalog and paywall status, straight from the backend. */
export async function GET() {
  return proxyToBackend("/admin/plans");
}

/** Create a plan. The backend answers 409 when the key already exists. */
export async function POST(req: NextRequest) {
  const body = await readJson<Record<string, unknown>>(req);
  if (body instanceof NextResponse) return body;
  return proxyToBackend("/admin/plans", { method: "POST", body });
}
