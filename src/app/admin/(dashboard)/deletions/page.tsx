import type { Metadata } from "next";
import { DeletionsList } from "@/components/admin/deletions-list";

export const metadata: Metadata = { title: "Deleted accounts" };

export default function AdminDeletionsPage() {
  return <DeletionsList />;
}
