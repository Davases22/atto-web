"use client";

import { Eraser, Loader2, Save, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EntitlementDef, PlanAdmin } from "@/lib/admin-plans";
import { cn } from "@/lib/utils";

export type Draft = Record<string, string[]>;

export function FeatureMatrix({
  plans,
  entitlements,
  draft,
  freePlanKey,
  changedCount,
  saving,
  onToggle,
  onSetPlan,
  onClearAll,
  onSave,
  onDiscard,
}: {
  plans: PlanAdmin[];
  entitlements: EntitlementDef[];
  draft: Draft;
  freePlanKey: string;
  changedCount: number;
  saving: boolean;
  onToggle: (planKey: string, entitlementKey: string, checked: boolean) => void;
  onSetPlan: (planKey: string, all: boolean) => void;
  onClearAll: () => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const dirty = changedCount > 0;
  const anyChecked = plans.some((plan) => (draft[plan.key] ?? plan.entitlements).length > 0);

  return (
    <Card className="border-neutral-800">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Feature matrix</CardTitle>
          <CardDescription>
            Tick a box to include that feature in a plan. Changes apply when you save.
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearAll}
            disabled={!anyChecked || saving}
            title="Untick every box in every plan"
          >
            <Eraser aria-hidden />
            Clear all
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDiscard}
            disabled={!dirty || saving}
          >
            <Undo2 aria-hidden />
            Discard
          </Button>
          <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            {dirty ? `Save features (${changedCount})` : "Save features"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {entitlements.length === 0 ? (
          <p className="text-sm text-neutral-500">The backend has no entitlements yet.</p>
        ) : plans.length === 0 ? (
          <p className="text-sm text-neutral-500">Create a plan to start assigning features.</p>
        ) : (
          <div className="rounded-md border border-neutral-800">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    scope="col"
                    className="sticky left-0 z-10 min-w-56 bg-card text-neutral-400"
                  >
                    Feature
                  </TableHead>
                  {plans.map((plan) => {
                    const free = plan.key === freePlanKey;
                    return (
                      <TableHead
                        key={plan.key}
                        scope="col"
                        className={cn(
                          "min-w-28 text-center align-top",
                          free && "bg-neutral-900/60"
                        )}
                      >
                        <div className="flex flex-col items-center gap-1 py-1">
                          <span className="text-white">{plan.name}</span>
                          {free ? (
                            <Badge variant="outline" className="text-[10px]">
                              Free
                            </Badge>
                          ) : !plan.active ? (
                            <Badge variant="outline" className="text-[10px] text-neutral-500">
                              Inactive
                            </Badge>
                          ) : null}
                          <div className="mt-1 flex items-center gap-1 text-[11px] font-normal">
                            <button
                              type="button"
                              onClick={() => onSetPlan(plan.key, true)}
                              disabled={saving}
                              className="rounded px-1 text-neutral-400 underline-offset-2 hover:text-white hover:underline disabled:opacity-50"
                            >
                              All
                            </button>
                            <span className="text-neutral-700">/</span>
                            <button
                              type="button"
                              onClick={() => onSetPlan(plan.key, false)}
                              disabled={saving}
                              className="rounded px-1 text-neutral-400 underline-offset-2 hover:text-white hover:underline disabled:opacity-50"
                            >
                              None
                            </button>
                          </div>
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entitlements.map((ent) => (
                  <TableRow key={ent.key}>
                    <TableCell className="sticky left-0 z-10 bg-card align-top">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-white">{ent.label}</span>
                        <span className="font-mono text-[11px] text-neutral-500">{ent.key}</span>
                        {ent.description ? (
                          <span className="max-w-72 text-xs whitespace-normal text-neutral-500">
                            {ent.description}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    {plans.map((plan) => {
                      const free = plan.key === freePlanKey;
                      const current = draft[plan.key] ?? plan.entitlements;
                      const checked = current.includes(ent.key);
                      const changed = checked !== plan.entitlements.includes(ent.key);
                      return (
                        <TableCell
                          key={plan.key}
                          className={cn("text-center align-middle", free && "bg-neutral-900/60")}
                        >
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={checked}
                              disabled={saving}
                              onCheckedChange={(v) => onToggle(plan.key, ent.key, v === true)}
                              aria-label={`${ent.label} for ${plan.name}`}
                              className={cn(
                                "size-5",
                                changed && "ring-2 ring-white/60 ring-offset-2 ring-offset-black"
                              )}
                            />
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
