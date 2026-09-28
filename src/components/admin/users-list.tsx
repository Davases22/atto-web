"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, Search, Users } from "lucide-react";
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

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  creatorName?: string | null;
  avatar?: string | null;
  location?: string | null;
  profileVerified: boolean;
  isManagedAccount: boolean;
  representativeId?: number | null;
  followersCount: number;
  postsCount: number;
  createdAt: string;
}

interface UserList {
  users: AdminUser[];
  total: number;
  limit: number;
  offset: number;
  byRole: Record<string, number>;
}

const PAGINA = 50;

/** Los roles tal y como los guarda el servicio, con el nombre que ve el equipo. */
const ROLES: { value: string; label: string }[] = [
  { value: "", label: "Everyone" },
  { value: "creator", label: "Creators" },
  { value: "representative", label: "Representatives" },
  { value: "listener", label: "Listeners" },
];

type State =
  | { status: "loading"; data: UserList | null }
  | { status: "error"; message: string; data: UserList | null }
  | { status: "ready"; data: UserList };

/**
 * Quién se ha registrado en el app.
 *
 * Paginada en el servidor y no en el navegador: la lista crece sola y traerse
 * cada cuenta para enseñar cincuenta sería gastar la primera carga en datos
 * que nadie mira. La búsqueda también va al servidor por lo mismo, con un
 * respiro de 300 ms para no pedir una consulta por tecla.
 */
export function UsersList() {
  const [state, setState] = useState<State>({ status: "loading", data: null });
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [offset, setOffset] = useState(0);
  // Lo que de verdad se ha pedido, para que el contador no parpadee mientras
  // se escribe.
  const [buscado, setBuscado] = useState("");

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
      if (role) params.set("role", role);
      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(await readError(res, `Request failed (${res.status})`));
      }
      const data = (await res.json()) as UserList;
      // Una respuesta vieja no puede pisar a una nueva.
      if (mia !== peticionRef.current) return;
      setState({ status: "ready", data });
    } catch (err) {
      if (mia !== peticionRef.current) return;
      setState((prev) => ({
        status: "error",
        message: err instanceof Error ? err.message : "Could not load users",
        data: prev.data,
      }));
    }
  }, [buscado, role, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const data = state.data;
  const loading = state.status === "loading";
  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const desde = total === 0 ? 0 : offset + 1;
  const hasta = Math.min(offset + users.length, total);

  const resumen = useMemo(() => {
    const porRol = data?.byRole ?? {};
    return ROLES.filter((r) => r.value).map((r) => ({
      label: r.label,
      count: porRol[r.value] ?? 0,
    }));
  }, [data?.byRole]);

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone registered in the app, newest first."
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

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Users className="size-5 shrink-0 text-neutral-500" />
            <div className="min-w-0">
              <p className="text-xs text-neutral-500">Total</p>
              <p className="text-lg font-semibold text-white tabular-nums">
                {loading && !data ? <Skeleton className="h-6 w-14" /> : formatNumber(total)}
              </p>
            </div>
          </CardContent>
        </Card>
        {resumen.map((r) => (
          <Card key={r.label}>
            <CardContent className="py-4">
              <p className="text-xs text-neutral-500">{r.label}</p>
              <p className="text-lg font-semibold text-white tabular-nums">
                {loading && !data ? (
                  <Skeleton className="h-6 w-14" />
                ) : (
                  formatNumber(r.count)
                )}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username, name, email, phone or creator name"
            className="pl-9"
            aria-label="Search users"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <Button
              key={r.value || "all"}
              variant={role === r.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setRole(r.value);
                setOffset(0);
              }}
            >
              {r.label}
            </Button>
          ))}
        </div>
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
                <TableHead>User</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Followers</TableHead>
                <TableHead className="text-right">Posts</TableHead>
                <TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && users.length === 0
                ? Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : null}
              {!loading && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-neutral-500">
                    {buscado || role
                      ? "Nobody matches that."
                      : "No registered users yet."}
                  </TableCell>
                </TableRow>
              ) : null}
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">
                        @{u.username}
                        {u.profileVerified ? (
                          <Badge variant="secondary" className="ml-2 align-middle">
                            Verified
                          </Badge>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-neutral-500">
                        {u.creatorName || u.displayName}
                        {u.location ? ` · ${u.location}` : ""}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-neutral-400">
                    <p className="truncate text-xs">{u.email || "—"}</p>
                    <p className="truncate text-xs">{u.phone || "—"}</p>
                  </TableCell>
                  <TableCell>
                    <span className="capitalize text-neutral-300">{u.role}</span>
                    {u.isManagedAccount ? (
                      <p className="text-xs text-neutral-500">
                        managed{u.representativeId ? ` by ${u.representativeId}` : ""}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-neutral-300">
                    {formatNumber(u.followersCount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-neutral-300">
                    {formatNumber(u.postsCount)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-neutral-400">
                    {formatDateTime(u.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
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
