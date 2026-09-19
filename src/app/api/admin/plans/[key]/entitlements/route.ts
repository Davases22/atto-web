import { NextRequest, NextResponse } from "next/server";
import { proxyToBackend, readJson } from "@/lib/admin-backend";

type Params = { params: Promise<{ key: string }> };

/** Replace the full entitlement set of one plan. */
export async function PUT(req: NextRequest, { params }: Params) {
  const { key } = await params;
  const body = await readJson<{ entitlements?: unknown }>(req);
  if (body instanceof NextResponse) return body;
  if (
    !Array.isArray(body.entitlements) ||
    body.entitlements.some((e) => typeof e !== "string")
  ) {
    return NextResponse.json(
      { error: "entitlements must be a list of strings" },
      { status: 400 }
    );
  }
  return proxyToBackend(
    `/admin/plans/${encodeURIComponent(key)}/entitlements`,
    { method: "PUT", body: { entitlements: body.entitlements } }
  );
}
