/**
 * Types and small pure helpers shared by the admin dashboard pages and the
 * proxy routes. Everything here mirrors the payment service contract.
 */

export type BillingPeriod = "year" | "month" | "forever";

export interface PlanAdmin {
  key: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  billingPeriod: BillingPeriod;
  durationDays: number;
  stripePriceId: string | null;
  popular: boolean;
  active: boolean;
  sortOrder: number;
  features: string[];
  entitlements: string[];
  subscribers: number;
  createdAt: string;
  updatedAt: string;
}

export interface EntitlementDef {
  key: string;
  label: string;
  description: string;
}

export interface PaywallStatus {
  required: boolean;
  paidFeatures: string[];
  freePlan: string;
}

export interface PlansResponse {
  plans: PlanAdmin[];
  entitlements: EntitlementDef[];
  paywall: PaywallStatus;
}

export interface PlanInput {
  key: string;
  name: string;
  description?: string;
  priceCents: number;
  currency?: string;
  billingPeriod: BillingPeriod;
  durationDays?: number;
  stripePriceId?: string | null;
  popular?: boolean;
  active?: boolean;
  sortOrder?: number;
  features?: string[];
  entitlements?: string[];
}

export interface DayCount {
  date: string;
  count: number;
}

export interface DayCents {
  date: string;
  cents: number;
}

export interface MetricsResponse {
  users: {
    total: number;
    creators: number;
    representatives: number;
    listeners: number;
    newLast7d: number;
    newLast30d: number;
  };
  signupsByDay: DayCount[];
  subscriptions: {
    activeByPlan: { plan: string; name: string; count: number }[];
    mrrCents: number;
    arrCents: number;
  };
  revenue: {
    last30dCents: number;
    byDay: DayCents[];
  };
  calls: {
    last7d: number;
    last30d: number;
    byDay: DayCount[];
    avgDurationSec: number;
  };
  numbers: {
    real: number;
    placeholder: number;
    estMonthlyCostCents: number;
  };
  paywall: {
    required: boolean;
    paidFeatures: string[];
  };
  generatedAt: string;
}

export const BILLING_PERIODS: { value: BillingPeriod; label: string }[] = [
  { value: "year", label: "Yearly" },
  { value: "month", label: "Monthly" },
  { value: "forever", label: "One time, forever" },
];

/** Default duration per billing period, editable in the form. */
export function defaultDurationDays(period: BillingPeriod): number {
  switch (period) {
    case "year":
      return 365;
    case "month":
      return 30;
    case "forever":
      return 36500;
  }
}

export function periodLabel(period: BillingPeriod): string {
  switch (period) {
    case "year":
      return "per year";
    case "month":
      return "per month";
    case "forever":
      return "one time";
  }
}

/** Money from integer cents, two decimals, in the user's locale. */
export function formatMoney(cents: number, currency = "USD"): string {
  const amount = (Number.isFinite(cents) ? cents : 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined).format(Number.isFinite(value) ? value : 0);
}

/** "YYYY MM DD" style dates from the backend are calendar days, not instants. */
export function parseDay(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(date);
}

export function formatDay(date: string): string {
  const d = parseDay(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDayLong(date: string): string {
  const d = parseDay(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/** Plan key from a name: lowercase, ascii letters and digits, one dash between words. */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const PLAN_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Same rule as the app: the subscription screen shows while at least one
 * feature is missing from the free plan. Used to preview the effect of
 * unsaved matrix changes; the saved status always comes from the backend.
 */
export function computePaywall(
  plans: PlanAdmin[],
  entitlements: EntitlementDef[],
  freePlanKey: string
): { required: boolean; paidFeatures: string[] } {
  const free = plans.find((p) => p.key === freePlanKey);
  const freeSet = new Set(free?.entitlements ?? []);
  const paidFeatures = entitlements
    .map((e) => e.key)
    .filter((key) => !freeSet.has(key));
  return { required: paidFeatures.length > 0, paidFeatures };
}

/** Read the error message out of a proxy route response body. */
export async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: unknown };
  return typeof body.error === "string" && body.error ? body.error : fallback;
}
