"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { FeatureMatrix, type Draft } from "@/components/admin/plans/feature-matrix";
import { PlanFormDialog } from "@/components/admin/plans/plan-form-dialog";
import { PlansTable } from "@/components/admin/plans/plans-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  computePaywall,
  readError,
  type PlanAdmin,
  type PlansResponse,
} from "@/lib/admin-plans";

type State =
  | { status: "loading"; data: PlansResponse | null }
  | { status: "error"; message: string; data: PlansResponse | null }
  | { status: "ready"; data: PlansResponse };

function sortPlans(plans: PlanAdmin[]): PlanAdmin[] {
  return [...plans].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
  );
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

export function PlansEditor() {
  const [state, setState] = useState<State>({ status: "loading", data: null });
  const [draft, setDraft] = useState<Draft>({});
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlanAdmin | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<PlanAdmin | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setState((prev) => ({ status: "loading", data: prev.data }));
    try {
      const res = await fetch("/api/admin/plans", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(await readError(res, `Request failed (${res.status})`));
      }
      const data = (await res.json()) as PlansResponse;
      setState({ status: "ready", data });
      setDraft({});
    } catch (err) {
      setState((prev) => ({
        status: "error",
        message: err instanceof Error ? err.message : "Could not load plans",
        data: prev.data,
      }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const data = state.data;
  const plans = useMemo(() => sortPlans(data?.plans ?? []), [data]);
  const entitlements = useMemo(() => data?.entitlements ?? [], [data]);
  const freePlanKey = data?.paywall.freePlan ?? "";

  const changedPlans = useMemo(
    () => plans.filter((p) => draft[p.key] && !sameSet(draft[p.key], p.entitlements)),
    [plans, draft]
  );

  /** Preview of the paywall after the unsaved matrix changes are applied. */
  const preview = useMemo(() => {
    if (!data || changedPlans.length === 0) return null;
    const merged = plans.map((p) => ({ ...p, entitlements: draft[p.key] ?? p.entitlements }));
    return computePaywall(merged, entitlements, freePlanKey);
  }, [data, changedPlans.length, plans, draft, entitlements, freePlanKey]);

  const updatePlanInState = (saved: PlanAdmin) => {
    setState((prev) => {
      if (!prev.data) return prev;
      const exists = prev.data.plans.some((p) => p.key === saved.key);
      const nextPlans = exists
        ? prev.data.plans.map((p) => (p.key === saved.key ? saved : p))
        : [...prev.data.plans, saved];
      return { status: "ready", data: { ...prev.data, plans: nextPlans } };
    });
  };

  const onToggle = (planKey: string, entKey: string, checked: boolean) => {
    const plan = plans.find((p) => p.key === planKey);
    if (!plan) return;
    setDraft((prev) => {
      const current = prev[planKey] ?? plan.entitlements;
      const next = checked
        ? Array.from(new Set([...current, entKey]))
        : current.filter((k) => k !== entKey);
      return { ...prev, [planKey]: next };
    });
  };

  const saveMatrix = async () => {
    if (changedPlans.length === 0) return;
    setSavingMatrix(true);
    try {
      const results = await Promise.allSettled(
        changedPlans.map(async (plan) => {
          const res = await fetch(
            `/api/admin/plans/${encodeURIComponent(plan.key)}/entitlements`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ entitlements: draft[plan.key] }),
            }
          );
          if (!res.ok) {
            throw new Error(await readError(res, `Request failed (${res.status})`));
          }
          return plan;
        })
      );
      results.forEach((result, i) => {
        const plan = changedPlans[i];
        if (result.status === "fulfilled") {
          toast.success(`Features saved for ${plan.name}`);
        } else {
          toast.error(`Could not save features for ${plan.name}`, {
            description:
              result.reason instanceof Error ? result.reason.message : undefined,
          });
        }
      });
    } finally {
      setSavingMatrix(false);
      // Always refetch so the paywall status reflects what the backend stored.
      await load();
    }
  };

  const toggleActive = async (plan: PlanAdmin, active: boolean) => {
    setTogglingKey(plan.key);
    try {
      const res = await fetch(`/api/admin/plans/${encodeURIComponent(plan.key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        throw new Error(await readError(res, `Request failed (${res.status})`));
      }
      const saved = (await res.json()) as PlanAdmin;
      updatePlanInState(saved);
      toast.success(`${saved.name} is now ${saved.active ? "active" : "inactive"}`);
    } catch (err) {
      toast.error(`Could not update ${plan.name}`, {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setTogglingKey(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/plans/${encodeURIComponent(deleteTarget.key)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          subscribers?: number;
        };
        const message = body.error || `Delete failed (${res.status})`;
        if (res.status === 409) {
          const count = typeof body.subscribers === "number" ? body.subscribers : null;
          const sentence = /[.!?]$/.test(message) ? message : `${message}.`;
          setDeleteError(
            count !== null
              ? `${sentence} This plan has ${count} subscriber${count === 1 ? "" : "s"}.`
              : message
          );
        } else {
          setDeleteError(message);
        }
        return;
      }
      toast.success(`Plan "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const loading = state.status === "loading";

  return (
    <>
      <PageHeader
        title="Plans and features"
        description="Subscription plans, their prices and which features each one unlocks."
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              {loading ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <RefreshCw aria-hidden />
              )}
              Refresh
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              disabled={!data}
            >
              <Plus aria-hidden />
              New plan
            </Button>
          </>
        }
      />

      {state.status === "error" ? (
        <Card className="mb-6 border-neutral-800">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-neutral-400" aria-hidden />
              <div>
                <p className="text-sm font-medium text-white">Could not load plans</p>
                <p className="mt-0.5 text-sm text-neutral-500">{state.message}</p>
              </div>
            </div>
            <Button variant="outline" onClick={load} className="sm:shrink-0">
              <RefreshCw aria-hidden />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <div className="space-y-6">
          <Card className="border-neutral-800">
            <CardHeader>
              <CardTitle className="text-base">Paywall rule</CardTitle>
              <CardDescription>
                The app shows the subscription screen during signup only while at
                least one feature requires a paid plan. Give every feature to the
                free plan and the screen disappears.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-neutral-400">Right now:</span>
                <Badge variant={data.paywall.required ? "default" : "outline"}>
                  {data.paywall.required
                    ? "Subscription screen is shown"
                    : "Subscription screen is hidden"}
                </Badge>
                {freePlanKey ? (
                  <span className="text-xs text-neutral-500">
                    Free plan: <span className="font-mono">{freePlanKey}</span>
                  </span>
                ) : null}
              </div>
              {data.paywall.paidFeatures.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-sm text-neutral-400">Paid features:</span>
                  {data.paywall.paidFeatures.map((f) => (
                    <Badge key={f} variant="outline" className="font-mono text-[11px]">
                      {f}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500">
                  Every feature is included in the free plan.
                </p>
              )}
              {preview ? (
                <p className="text-sm text-neutral-400">
                  After saving your changes the screen will be{" "}
                  <span className="font-medium text-white">
                    {preview.required ? "shown" : "hidden"}
                  </span>
                  {preview.paidFeatures.length > 0
                    ? ` with ${preview.paidFeatures.length} paid feature${
                        preview.paidFeatures.length === 1 ? "" : "s"
                      }.`
                    : "."}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <PlansTable
            plans={plans}
            freePlanKey={freePlanKey}
            togglingKey={togglingKey}
            onToggleActive={toggleActive}
            onEdit={(plan) => {
              setEditing(plan);
              setFormOpen(true);
            }}
            onDelete={(plan) => {
              setDeleteError(null);
              setDeleteTarget(plan);
            }}
          />

          <FeatureMatrix
            plans={plans}
            entitlements={entitlements}
            draft={draft}
            freePlanKey={freePlanKey}
            changedCount={changedPlans.length}
            saving={savingMatrix}
            onToggle={onToggle}
            onSave={saveMatrix}
            onDiscard={() => setDraft({})}
          />
        </div>
      ) : loading ? (
        <PlansSkeleton />
      ) : null}

      {formOpen ? (
        <PlanFormDialog
          key={editing?.key ?? "new"}
          open={formOpen}
          plan={editing}
          existingKeys={plans.map((p) => p.key)}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) setEditing(null);
          }}
          onSaved={(saved) => {
            updatePlanInState(saved);
            setFormOpen(false);
            setEditing(null);
            load();
          }}
        />
      ) : null}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget ? `"${deleteTarget.name}"` : "this plan"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The plan is removed from the subscription screen. The backend refuses
              when the plan still has subscribers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-red-200"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{deleteError}</span>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {deleting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Delete plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PlansSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading plans">
      <Card className="border-neutral-800">
        <CardHeader>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-1 h-3 w-full max-w-lg" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-5 w-48" />
        </CardContent>
      </Card>
      <Card className="border-neutral-800">
        <CardHeader>
          <Skeleton className="h-4 w-16" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
      <Card className="border-neutral-800">
        <CardHeader>
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
