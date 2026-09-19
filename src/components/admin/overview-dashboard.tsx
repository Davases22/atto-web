"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDateTime,
  formatDay,
  formatDayLong,
  formatDuration,
  formatMoney,
  formatNumber,
  readError,
  type MetricsResponse,
} from "@/lib/admin-plans";

const BAR_FILL = "oklch(1 0 0)";
const GRID_STROKE = "oklch(1 0 0 / 12%)";

const countConfig: ChartConfig = {
  count: { label: "Count", color: BAR_FILL },
};
const revenueConfig: ChartConfig = {
  amount: { label: "Revenue", color: BAR_FILL },
};

type State =
  | { status: "loading"; data: MetricsResponse | null }
  | { status: "error"; message: string; data: MetricsResponse | null }
  | { status: "ready"; data: MetricsResponse };

export function OverviewDashboard() {
  const [state, setState] = useState<State>({ status: "loading", data: null });

  const load = useCallback(async () => {
    setState((prev) => ({ status: "loading", data: prev.data }));
    try {
      const res = await fetch("/api/admin/metrics", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(await readError(res, `Request failed (${res.status})`));
      }
      const data = (await res.json()) as MetricsResponse;
      setState({ status: "ready", data });
    } catch (err) {
      setState((prev) => ({
        status: "error",
        message: err instanceof Error ? err.message : "Could not load metrics",
        data: prev.data,
      }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loading = state.status === "loading";
  const data = state.data;

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          data?.generatedAt
            ? `Updated ${formatDateTime(data.generatedAt)}`
            : "Live numbers from the backend."
        }
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <RefreshCw aria-hidden />
            )}
            Refresh
          </Button>
        }
      />

      {state.status === "error" ? (
        <Card className="mb-6 border-neutral-800">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-neutral-400" aria-hidden />
              <div>
                <p className="text-sm font-medium text-white">Could not load metrics</p>
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
        <Metrics data={data} />
      ) : loading ? (
        <OverviewSkeleton />
      ) : null}
    </>
  );
}

function Metrics({ data }: { data: MetricsResponse }) {
  const activeSubs = useMemo(
    () => data.subscriptions.activeByPlan.reduce((sum, p) => sum + p.count, 0),
    [data.subscriptions.activeByPlan]
  );

  const signups = useMemo(
    () => data.signupsByDay.map((d) => ({ date: d.date, count: d.count })),
    [data.signupsByDay]
  );
  const calls = useMemo(
    () => data.calls.byDay.map((d) => ({ date: d.date, count: d.count })),
    [data.calls.byDay]
  );
  const revenue = useMemo(
    () => data.revenue.byDay.map((d) => ({ date: d.date, amount: d.cents / 100 })),
    [data.revenue.byDay]
  );

  return (
    <div className="space-y-6">
      <section
        aria-label="Key numbers"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatTile
          label="Total users"
          value={formatNumber(data.users.total)}
          lines={[
            `${formatNumber(data.users.creators)} creators`,
            `${formatNumber(data.users.representatives)} representatives`,
            `${formatNumber(data.users.listeners)} listeners`,
          ]}
        />
        <StatTile
          label="New users"
          value={formatNumber(data.users.newLast7d)}
          hint="last 7 days"
          lines={[`${formatNumber(data.users.newLast30d)} in the last 30 days`]}
        />
        <StatTile
          label="Active subscriptions"
          value={formatNumber(activeSubs)}
          lines={[
            `MRR ${formatMoney(data.subscriptions.mrrCents)}`,
            `ARR ${formatMoney(data.subscriptions.arrCents)}`,
            ...data.subscriptions.activeByPlan.map(
              (p) => `${formatNumber(p.count)} on ${p.name || p.plan}`
            ),
          ]}
        />
        <StatTile
          label="Revenue"
          value={formatMoney(data.revenue.last30dCents)}
          hint="last 30 days"
        />
        <StatTile
          label="Calls"
          value={formatNumber(data.calls.last7d)}
          hint="last 7 days"
          lines={[
            `${formatNumber(data.calls.last30d)} in the last 30 days`,
            `Average length ${formatDuration(data.calls.avgDurationSec)}`,
          ]}
        />
        <StatTile
          label="Real Twilio numbers"
          value={formatNumber(data.numbers.real)}
          lines={[
            `${formatNumber(data.numbers.placeholder)} placeholders`,
            `About ${formatMoney(data.numbers.estMonthlyCostCents)} per month`,
          ]}
        />
        <Card className="border-neutral-800 sm:col-span-2">
          <CardHeader>
            <CardDescription>Paywall</CardDescription>
            <CardTitle className="text-lg">
              {data.paywall.required
                ? "Subscription screen is shown"
                : "Subscription screen is hidden"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.paywall.paidFeatures.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
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
          </CardContent>
        </Card>
      </section>

      <section
        aria-label="Trends"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        <ChartCard title="Signups per day" description="New accounts by day">
          <CountChart data={signups} label="Signups" />
        </ChartCard>
        <ChartCard title="Calls per day" description="Completed calls by day">
          <CountChart data={calls} label="Calls" />
        </ChartCard>
        <ChartCard title="Revenue per day" description="Payments received by day">
          <RevenueChart data={revenue} />
        </ChartCard>
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  lines = [],
}: {
  label: string;
  value: string;
  hint?: string;
  lines?: string[];
}) {
  return (
    <Card className="border-neutral-800">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">
          {value}
          {hint ? (
            <span className="ml-2 text-xs font-normal text-neutral-500">{hint}</span>
          ) : null}
        </CardTitle>
      </CardHeader>
      {lines.length > 0 ? (
        <CardContent>
          <ul className="space-y-0.5 text-sm text-neutral-400">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-neutral-800">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-neutral-800 text-sm text-neutral-500">
      No data yet
    </div>
  );
}

function CountChart({
  data,
  label,
}: {
  data: { date: string; count: number }[];
  label: string;
}) {
  if (data.length === 0) return <EmptyChart />;
  const config: ChartConfig = { count: { ...countConfig.count, label } };
  return (
    <ChartContainer config={config} className="h-56 w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={formatDay}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={32}
          tickFormatter={(v: number) => formatNumber(v)}
        />
        <ChartTooltip
          cursor={{ fill: "oklch(1 0 0 / 8%)" }}
          content={
            <ChartTooltipContent
              hideIndicator
              labelFormatter={(value) => formatDayLong(String(value))}
            />
          }
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function RevenueChart({ data }: { data: { date: string; amount: number }[] }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ChartContainer config={revenueConfig} className="h-56 w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={formatDay}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v: number) => formatMoney(Math.round(v * 100))}
        />
        <ChartTooltip
          cursor={{ fill: "oklch(1 0 0 / 8%)" }}
          content={
            <ChartTooltipContent
              hideIndicator
              labelFormatter={(value) => formatDayLong(String(value))}
              formatter={(value) => (
                <span className="flex w-full justify-between gap-4">
                  <span className="text-neutral-400">Revenue</span>
                  <span className="font-mono font-medium tabular-nums">
                    {formatMoney(Math.round(Number(value) * 100))}
                  </span>
                </span>
              )}
            />
          }
        />
        <Bar dataKey="amount" fill="var(--color-amount)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading metrics">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-neutral-800">
            <CardHeader>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-7 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-32" />
              <Skeleton className="mt-2 h-3 w-28" />
            </CardContent>
          </Card>
        ))}
        <Card className="border-neutral-800 sm:col-span-2">
          <CardHeader>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-6 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-5 w-40" />
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border-neutral-800">
            <CardHeader>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1 h-3 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-56 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
