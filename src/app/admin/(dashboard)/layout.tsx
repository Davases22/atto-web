import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: {
    default: "Admin | ATTO SOUND",
    template: "%s | ATTO SOUND admin",
  },
  robots: { index: false, follow: false },
};

/**
 * Shared chrome for every admin page except the login form. The middleware
 * already guarantees a valid session before anything here renders.
 */
export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
