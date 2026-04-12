"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart3,
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";

interface Analytics {
  total_exhibitors: number;
  completion_rate: number;
  in_progress: number;
  days_to_deadline: number;
  status_distribution: { name: string; value: number; color: string }[];
  graphics_status: { name: string; value: number }[];
}

/* ATO COMM-brand chart colors */
const PIE_COLORS = [
  "hsl(154 100% 49%)",  // complete — green
  "hsl(209 65% 50%)",   // in-progress — mid-navy
  "hsl(45 96% 48%)",    // pending — yellow
  "hsl(0 72% 60%)",     // locked — red
  "hsl(213 20% 75%)",   // other — grey
];

const BAR_COLOR = "hsl(209 65% 45%)";

/* Custom dot tooltip */
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs font-semibold shadow-lg"
      style={{
        background: "hsl(209 65% 21%)",
        color: "hsl(154 100% 49%)",
        border: "1px solid hsl(209 65% 30%)",
      }}
    >
      {label && <p className="text-white/60 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i}>
          {p.name ? `${p.name}: ` : ""}
          <span style={{ color: "hsl(154 100% 49%)" }}>{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function AdminAnalyticsPage() {
  const params = useParams();
  const eventId = params.eventId as string | undefined;
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const endpoint = eventId
          ? `/admin/analytics/${eventId}`
          : "/admin/analytics";
        const data = await apiFetch<Analytics>(endpoint);
        setAnalytics(data);
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      }
    }
    fetchAnalytics();
  }, [eventId]);

  if (!analytics) {
    return (
      <div className="flex h-screen" style={{ background: "hsl(213 25% 97%)" }}>
        <Sidebar userRole="admin" />
        <main className="flex-1 ml-64 overflow-auto flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center font-black animate-pulse text-sm"
              style={{ background: "hsl(209 65% 21%)", color: "hsl(154 100% 49%)" }}
            >
              A
            </div>
            <span
              className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin"
              style={{
                borderColor: "hsl(209 65% 21% / 0.2)",
                borderTopColor: "hsl(209 65% 21%)",
              }}
            />
          </div>
        </main>
      </div>
    );
  }

  const kpis = [
    {
      icon: Users,
      label: "Total Exhibitors",
      value: analytics.total_exhibitors,
      accent: "hsl(209 65% 38%)",
      bg: "hsl(209 65% 21% / 0.08)",
    },
    {
      icon: CheckCircle2,
      label: "Completion Rate",
      value: `${analytics.completion_rate}%`,
      accent: "hsl(154 60% 35%)",
      bg: "hsl(154 80% 94%)",
    },
    {
      icon: Clock,
      label: "In Progress",
      value: analytics.in_progress,
      accent: "hsl(45 80% 30%)",
      bg: "hsl(45 100% 94%)",
    },
    {
      icon: TrendingUp,
      label: "Days to Deadline",
      value: analytics.days_to_deadline,
      accent:
        analytics.days_to_deadline < 7
          ? "hsl(0 72% 51%)"
          : analytics.days_to_deadline < 14
          ? "hsl(45 80% 30%)"
          : "hsl(209 65% 38%)",
      bg:
        analytics.days_to_deadline < 7
          ? "hsl(0 80% 97%)"
          : analytics.days_to_deadline < 14
          ? "hsl(45 100% 94%)"
          : "hsl(209 65% 21% / 0.08)",
    },
  ];

  return (
    <div className="flex h-screen" style={{ background: "hsl(213 25% 97%)" }}>
      <Sidebar userRole="admin" />
      <main className="flex-1 ml-64 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-6 animate-fade-up">

          {/* ── Header ───────────────────────────────────────────── */}
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-description">
              {eventId ? "Event performance metrics" : "Overall platform analytics"}
            </p>
          </div>

          {/* ── KPI strip ────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map(({ icon: Icon, label, value, accent, bg }, i) => (
              <Card
                key={label}
                className={`card-elevated relative overflow-hidden stagger-${
                  Math.min(i + 1, 4)
                } animate-fade-up`}
              >
                {/* Accent stripe */}
                <div
                  className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
                  style={{ background: accent }}
                />
                <CardHeader className="pb-1 pt-5 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </CardTitle>
                  <div
                    className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: bg }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p
                    className="text-3xl font-bold tabular-nums tracking-tight"
                    style={{ color: accent }}
                  >
                    {value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Charts row ───────────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Status distribution donut */}
            <Card className="card-elevated stagger-1 animate-fade-up">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Status Distribution</CardTitle>
                <CardDescription>Exhibitor completion status breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.status_distribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={108}
                      paddingAngle={4}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {analytics.status_distribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Graphics status bar chart */}
            <Card className="card-elevated stagger-2 animate-fade-up">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Graphics Status</CardTitle>
                <CardDescription>Graphics approval status overview</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={analytics.graphics_status}
                    margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(213 20% 90%)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "hsl(213 15% 55%)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(213 15% 55%)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(209 65% 21% / 0.04)" }} />
                    <Bar
                      dataKey="value"
                      fill={BAR_COLOR}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={52}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* ── Summary footer row ───────────────────────────────── */}
          <div
            className="rounded-xl p-4 flex flex-wrap gap-6 items-center stagger-3 animate-fade-up"
            style={{
              background: "hsl(209 65% 21% / 0.05)",
              border: "1px solid hsl(209 65% 21% / 0.1)",
            }}
          >
            <div className="flex items-center gap-2">
              <BarChart3
                className="h-4 w-4"
                style={{ color: "hsl(209 65% 38%)" }}
              />
              <span className="text-sm font-semibold" style={{ color: "hsl(209 65% 21%)" }}>
                Platform Summary
              </span>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <span className="text-muted-foreground">
                Total exhibitors:{" "}
                <strong className="text-foreground">{analytics.total_exhibitors}</strong>
              </span>
              <span className="text-muted-foreground">
                Completed:{" "}
                <strong style={{ color: "hsl(154 60% 35%)" }}>
                  {analytics.completion_rate}%
                </strong>
              </span>
              <span className="text-muted-foreground">
                In progress:{" "}
                <strong style={{ color: "hsl(45 80% 30%)" }}>
                  {analytics.in_progress}
                </strong>
              </span>
              <span className="text-muted-foreground">
                Days remaining:{" "}
                <strong
                  style={{
                    color:
                      analytics.days_to_deadline < 7
                        ? "hsl(0 72% 51%)"
                        : "hsl(209 65% 38%)",
                  }}
                >
                  {analytics.days_to_deadline}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
