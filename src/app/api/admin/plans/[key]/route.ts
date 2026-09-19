import { NextRequest, NextResponse } from "next/server";
import { proxyToBackend, readJson } from "@/lib/admin-backend";

type Params = { params: Promise<{ key: string }> };

/** Update any subset of a plan's fields. */
export async function PUT(req: NextRequest, { params }: Params) {
  const { key } = await params;
  const body = await readJson<Record<string, unknown>>(req);
  if (body instanceof NextResponse) return body;
  return proxyToBackend(`/admin/plans/${encodeURIComponent(key)}`, {
    method: "PUT",
    body,
  });
}

/** Delete a plan. The backend answers 409 with a subscriber count when it refuses. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { key } = await params;
  return proxyToBackend(`/admin/plans/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
}
