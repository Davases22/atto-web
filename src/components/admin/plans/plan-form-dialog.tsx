"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  BILLING_PERIODS,
  PLAN_KEY_PATTERN,
  defaultDurationDays,
  readError,
  slugify,
  type BillingPeriod,
  type PlanAdmin,
  type PlanInput,
} from "@/lib/admin-plans";

interface FormState {
  name: string;
  key: string;
  keyTouched: boolean;
  description: string;
  price: string;
  currency: string;
  billingPeriod: BillingPeriod;
  durationDays: string;
  durationTouched: boolean;
  stripePriceId: string;
  popular: boolean;
  active: boolean;
  sortOrder: string;
  features: string;
}

function initialState(plan: PlanAdmin | null): FormState {
  if (!plan) {
    return {
      name: "",
      key: "",
      keyTouched: false,
      description: "",
      price: "0.00",
      currency: "USD",
      billingPeriod: "year",
      durationDays: String(defaultDurationDays("year")),
      durationTouched: false,
      stripePriceId: "",
      popular: false,
      active: true,
      sortOrder: "0",
      features: "",
    };
  }
  return {
    name: plan.name,
    key: plan.key,
    keyTouched: true,
    description: plan.description ?? "",
    price: (plan.priceCents / 100).toFixed(2),
    currency: plan.currency || "USD",
    billingPeriod: plan.billingPeriod,
    durationDays: String(plan.durationDays ?? defaultDurationDays(plan.billingPeriod)),
    durationTouched: true,
    stripePriceId: plan.stripePriceId ?? "",
    popular: plan.popular,
    active: plan.active,
    sortOrder: String(plan.sortOrder ?? 0),
    features: (plan.features ?? []).join("\n"),
  };
}

function validate(form: FormState, creating: boolean, existingKeys: string[]): string | null {
  if (!form.name.trim()) return "Name is required";
  if (!form.key.trim()) return "Key is required";
  if (!PLAN_KEY_PATTERN.test(form.key)) {
    return "Key may only use lowercase letters, digits and single dashes between words";
  }
  if (creating && existingKeys.includes(form.key)) {
    return `A plan with key "${form.key}" already exists`;
  }
  const price = Number(form.price);
  if (!Number.isFinite(price) || price < 0) return "Price must be zero or more";
  if (!/^[A-Za-z]{3}$/.test(form.currency.trim())) {
    return "Currency must be a three letter code, for example USD";
  }
  const duration = Number(form.durationDays);
  if (!Number.isInteger(duration) || duration <= 0) {
    return "Duration must be a whole number of days above zero";
  }
  const sort = Number(form.sortOrder);
  if (!Number.isInteger(sort)) return "Sort order must be a whole number";
  return null;
}

function toPayload(form: FormState): PlanInput {
  return {
    key: form.key.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    priceCents: Math.round(Number(form.price) * 100),
    currency: form.currency.trim().toUpperCase(),
    billingPeriod: form.billingPeriod,
    durationDays: Number(form.durationDays),
    stripePriceId: form.stripePriceId.trim() || null,
    popular: form.popular,
    active: form.active,
    sortOrder: Number(form.sortOrder),
    features: form.features
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

export function PlanFormDialog({
  open,
  plan,
  existingKeys,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  plan: PlanAdmin | null;
  existingKeys: string[];
  onOpenChange: (open: boolean) => void;
  onSaved: (plan: PlanAdmin) => void;
}) {
  const creating = plan === null;
  const [form, setForm] = useState<FormState>(() => initialState(plan));
  const [saving, setSaving] = useState(false);

  const update = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const onNameChange = (name: string) => {
    if (creating && !form.keyTouched) update({ name, key: slugify(name) });
    else update({ name });
  };

  const onPeriodChange = (period: BillingPeriod) => {
    if (!form.durationTouched) {
      update({ billingPeriod: period, durationDays: String(defaultDurationDays(period)) });
    } else {
      update({ billingPeriod: period });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate(form, creating, existingKeys);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      const payload = toPayload(form);
      const url = creating
        ? "/api/admin/plans"
        : `/api/admin/plans/${encodeURIComponent(plan.key)}`;
      const body: Partial<PlanInput> = creating ? payload : { ...payload };
      if (!creating) delete body.key;
      const res = await fetch(url, {
        method: creating ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(await readError(res, `Save failed (${res.status})`));
      }
      const saved = (await res.json()) as PlanAdmin;
      toast.success(creating ? `Plan "${saved.name}" created` : "Plan saved");
      onSaved(saved);
    } catch (err) {
      toast.error(creating ? "Could not create plan" : "Could not save plan", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{creating ? "New plan" : `Edit ${plan.name}`}</DialogTitle>
            <DialogDescription>
              {creating
                ? "Prices are entered in dollars and stored in cents."
                : "The key cannot change after creation."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="plan-name">
              <Input
                id="plan-name"
                value={form.name}
                onChange={(e) => onNameChange(e.target.value)}
                autoFocus
                required
              />
            </Field>
            <Field label="Key" htmlFor="plan-key" hint="Lowercase, used in the app and Stripe">
              <Input
                id="plan-key"
                value={form.key}
                onChange={(e) => update({ key: e.target.value, keyTouched: true })}
                disabled={!creating}
                readOnly={!creating}
                className="font-mono"
                spellCheck={false}
                autoCapitalize="off"
                required
              />
            </Field>
            <Field label="Description" htmlFor="plan-description" className="sm:col-span-2">
              <Textarea
                id="plan-description"
                value={form.description}
                onChange={(e) => update({ description: e.target.value })}
                rows={2}
              />
            </Field>
            <Field label="Price" htmlFor="plan-price" hint="In dollars, two decimals">
              <Input
                id="plan-price"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => update({ price: e.target.value })}
                required
              />
            </Field>
            <Field label="Currency" htmlFor="plan-currency">
              <Input
                id="plan-currency"
                value={form.currency}
                onChange={(e) => update({ currency: e.target.value.toUpperCase() })}
                maxLength={3}
                className="font-mono uppercase"
                required
              />
            </Field>
            <Field label="Billing period" htmlFor="plan-period">
              <Select value={form.billingPeriod} onValueChange={(v) => onPeriodChange(v as BillingPeriod)}>
                <SelectTrigger id="plan-period" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Duration in days" htmlFor="plan-duration" hint="Filled from the period, editable">
              <Input
                id="plan-duration"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.durationDays}
                onChange={(e) => update({ durationDays: e.target.value, durationTouched: true })}
                required
              />
            </Field>
            <Field label="Stripe price id" htmlFor="plan-stripe" hint="Optional">
              <Input
                id="plan-stripe"
                value={form.stripePriceId}
                onChange={(e) => update({ stripePriceId: e.target.value })}
                className="font-mono"
                spellCheck={false}
                placeholder="price_..."
              />
            </Field>
            <Field label="Sort order" htmlFor="plan-sort" hint="Lower comes first">
              <Input
                id="plan-sort"
                type="number"
                inputMode="numeric"
                step={1}
                value={form.sortOrder}
                onChange={(e) => update({ sortOrder: e.target.value })}
              />
            </Field>
            <div className="flex items-center justify-between rounded-md border border-neutral-800 px-3 py-2.5">
              <Label htmlFor="plan-popular">Popular badge</Label>
              <Switch
                id="plan-popular"
                checked={form.popular}
                onCheckedChange={(v) => update({ popular: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-neutral-800 px-3 py-2.5">
              <Label htmlFor="plan-active">Active</Label>
              <Switch
                id="plan-active"
                checked={form.active}
                onCheckedChange={(v) => update({ active: v })}
              />
            </div>
            <Field
              label="Features"
              htmlFor="plan-features"
              hint="One line per feature, shown on the subscription screen"
              className="sm:col-span-2"
            >
              <Textarea
                id="plan-features"
                value={form.features}
                onChange={(e) => update({ features: e.target.value })}
                rows={5}
                className="font-mono text-sm"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {creating ? "Create plan" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5">
        {label}
      </Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}
