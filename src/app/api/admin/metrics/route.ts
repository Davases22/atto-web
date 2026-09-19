import { proxyToBackend } from "@/lib/admin-backend";

/** Overview numbers for the admin dashboard. */
export async function GET() {
  return proxyToBackend("/admin/metrics");
}
