"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatMoney,
  formatNumber,
  periodLabel,
  type PlanAdmin,
} from "@/lib/admin-plans";

export function PlansTable({
  plans,
  freePlanKey,
  togglingKey,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  plans: PlanAdmin[];
  freePlanKey: string;
  togglingKey: string | null;
  onToggleActive: (plan: PlanAdmin, active: boolean) => void;
  onEdit: (plan: PlanAdmin) => void;
  onDelete: (plan: PlanAdmin) => void;
}) {
  return (
    <Card className="border-neutral-800">
      <CardHeader>
        <CardTitle className="text-base">Plans</CardTitle>
        <CardDescription>
          {plans.length === 0
            ? "No plans yet."
            : `${plans.length} plan${plans.length === 1 ? "" : "s"}, sorted by sort order.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {plans.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Use the New plan button to create the first one.
          </p>
        ) : (
          <div className="rounded-md border border-neutral-800">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className="text-neutral-400">Name</TableHead>
                  <TableHead scope="col" className="text-neutral-400">Key</TableHead>
                  <TableHead scope="col" className="text-neutral-400">Price</TableHead>
                  <TableHead scope="col" className="text-right text-neutral-400">Features</TableHead>
                  <TableHead scope="col" className="text-right text-neutral-400">Subscribers</TableHead>
                  <TableHead scope="col" className="text-neutral-400">Active</TableHead>
                  <TableHead scope="col" className="text-right text-neutral-400">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => {
                  const free = plan.key === freePlanKey;
                  const toggling = togglingKey === plan.key;
                  return (
                    <TableRow key={plan.key}>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-white">{plan.name}</span>
                            {plan.popular ? <Badge>Popular</Badge> : null}
                            {free ? <Badge variant="outline">Free</Badge> : null}
                          </div>
                          {plan.description ? (
                            <span className="max-w-xs text-xs whitespace-normal text-neutral-500">
                              {plan.description}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-top font-mono text-xs text-neutral-400">
                        {plan.key}
                      </TableCell>
                      <TableCell className="align-top tabular-nums">
                        <span className="text-white">
                          {formatMoney(plan.priceCents, plan.currency)}
                        </span>
                        <span className="ml-1 text-xs text-neutral-500">
                          {periodLabel(plan.billingPeriod)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right align-top tabular-nums">
                        {formatNumber(plan.features?.length ?? 0)}
                      </TableCell>
                      <TableCell className="text-right align-top tabular-nums">
                        {formatNumber(plan.subscribers ?? 0)}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={plan.active}
                            disabled={toggling}
                            onCheckedChange={(v) => onToggleActive(plan, v)}
                            aria-label={`${plan.name} is ${plan.active ? "active" : "inactive"}`}
                          />
                          {toggling ? (
                            <Loader2 className="size-3.5 animate-spin text-neutral-500" aria-hidden />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onEdit(plan)}
                            aria-label={`Edit ${plan.name}`}
                          >
                            <Pencil aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-neutral-400 hover:bg-destructive/20 hover:text-red-300"
                            onClick={() => onDelete(plan)}
                            aria-label={`Delete ${plan.name}`}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
