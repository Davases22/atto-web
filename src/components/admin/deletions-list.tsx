"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, Loader2, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatNumber, readError } from "@/lib/admin-plans";

export interface AccountDeletion {
  id: number;
  batchId: string;
  deletedUserId: number;
  username: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  isManagedAccount: boolean;
  representativeId?: number | null;
  inmateNumber?: string | null;
  accountCreatedAt?: string | null;
  via: "self_service" | "operator" | "backfill" | string;
  requestedBy: string;
  performedBy: string;
  reason: string;
  includedAsLinked: boolean;
  orphanedCreatorIds?: string;
  deletedAt: string;
}

interface DeletionList {
  deletions: AccountDeletion[];
  total: number;
}

const PAGINA = 50;

/** How the deletion happened, in the words the team uses. */
const VIA: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  self_service: { label: "From the app", variant: "secondary" },
  operator: { label: "Operator", variant: "default" },
  backfill: { label: "Rebuilt from telemetry", variant: "outline" },
};

type State =
  | { status: "loading"; data: DeletionList | null }
  | { status: "error"; message: string; data: DeletionList | null }
  | { status: "ready"; data: DeletionList };

/**
 * Every account that has been deleted, newest first, with who asked for it,
 * who ran it and why.
 *
 * Exists because on Oct 3 2026 nobody could say who had deleted the
 * representative arami two weeks earlier. A deletion that leaves managed
 * creators without their representative is flagged, since someone still
 * signs in to those creators.
 */
export function DeletionsList() {
  const [state, setState] = useState<State>({ status: "loading", data: null });
  const [search, setSearch] = useState("");
  const [buscado, setBuscado] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setBuscado(search.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const peticionRef = useRef(0);
  const load = useCallback(async () => {
    const mia = ++peticionRef.current;
    setState((prev) => ({ status: "loading", data: prev.data }));
    try {
      const params = new URLSearchParams({
        limit: String(PAGINA),
        offset: String(offset),
      });
      if (buscado) params.set("search", buscado);
      const res = await fetch(`/api/admin/deletions?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(await readError(res, `Request failed (${res.status})`));
      }
      const data = (await res.json()) as DeletionList;
      if (mia !== peticionRef.current) return;
      setState({ status: "ready", data });
    } catch (err) {
      if (mia !== peticionRef.current) return;
      setState((prev) => ({
        status: "error",
        message: err instanceof Error ? err.message : "Could not load deletions",
        data: prev.data,
      }));
    }
  }, [buscado, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const data = state.data;
  const loading = state.status === "loading";
  const rows = data?.deletions ?? [];
  const total = data?.total ?? 0;
  const desde = total === 0 ? 0 : offset + 1;
  const hasta = Math.min(offset + rows.length, total);

  return (
    <>
      <PageHeader
        title="Deleted accounts"
        description="Every deleted account, who asked for it, who ran it and why. Newest first."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
        }
      />

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username, name, email, user id or who asked"
          className="pl-9"
          aria-label="Search deleted accounts"
        />
      </div>

      {state.status === "error" ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.message}</span>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>How</TableHead>
                <TableHead>Asked by</TableHead>
                <TableHead>Run by</TableHead>
                <TableHead>Why</TableHead>
                <TableHead>Deleted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && rows.length === 0
                ? Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : null}
              {!loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-neutral-500">
                    {buscado ? "Nothing matches that." : "No deleted accounts."}
                  </TableCell>
                </TableRow>
              ) : null}
              {rows.map((d) => {
                const via = VIA[d.via] ?? { label: d.via, variant: "outline" as const };
                return (
                  <TableRow key={d.id} className="align-top">
                    <TableCell>
                      <div className="min-w-0 max-w-[16rem]">
                        <p className="truncate font-medium text-white">
                          @{d.username}{" "}
                          <span className="text-xs font-normal text-neutral-500 tabular-nums">
                            #{d.deletedUserId}
                          </span>
                        </p>
                        <p className="truncate text-xs text-neutral-500">
                          <span className="capitalize">{d.role}</span>
                          {d.isManagedAccount && d.representativeId
                            ? ` · managed by #${d.representativeId}`
                            : ""}
                          {d.email ? ` · ${d.email}` : ""}
                        </p>
                        {d.includedAsLinked ? (
                          <p className="text-xs text-neutral-500">Deleted with its linked account</p>
                        ) : null}
                        {d.orphanedCreatorIds ? (
                          <p className="mt-1 flex items-center gap-1 text-xs text-amber-400">
                            <AlertTriangle className="size-3.5 shrink-0" />
                            Left creator {d.orphanedCreatorIds.split(",").map((id) => `#${id}`).join(", ")} without a representative
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={via.variant} className="whitespace-nowrap">
                        {via.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[14rem] text-xs text-neutral-300">
                      {d.requestedBy}
                    </TableCell>
                    <TableCell className="max-w-[14rem] text-xs text-neutral-300">
                      {d.performedBy}
                    </TableCell>
                    <TableCell className="max-w-[22rem] text-xs text-neutral-400">
                      {d.reason || "Not recorded"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-neutral-400">
                      {formatDateTime(d.deletedAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-neutral-500 tabular-nums">
          {total === 0 ? "No results" : `${desde}–${hasta} of ${formatNumber(total)}`}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGINA))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={hasta >= total || loading}
            onClick={() => setOffset(offset + PAGINA)}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
