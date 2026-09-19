import type { Metadata } from "next";
import { PlansEditor } from "@/components/admin/plans/plans-editor";

export const metadata: Metadata = { title: "Plans and features" };

export default function AdminPlansPage() {
  return <PlansEditor />;
}
