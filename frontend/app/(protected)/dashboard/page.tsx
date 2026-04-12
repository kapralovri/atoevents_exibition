"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import {
  Clock,
  CheckCircle2,
  FileImage,
  FileText,
  Users,
  AlertCircle,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface ExhibitorData {
  overall_status: string;
  graphics_status: string;
  description_status: string;
  participants_status: string;
  event_name: string;
  deadline_graphics: string;
  booth_size: number;
  booth_type: string;
}

interface GraphicElement {
  name: string;
  label: string;
  required: boolean;
  status: string;
}

const SECTION_COLORS = {
  complete:     { bg: "hsl(154 80% 94%)",  text: "hsl(154 60% 28%)",  icon: "hsl(154 60% 38%)" },
  under_review: { bg: "hsl(45 100% 94%)",  text: "hsl(45 80% 30%)",   icon: "hsl(45 80% 40%)"  },
  pending:      { bg: "hsl(213 20% 93%)",  text: "hsl(213 15% 40%)",  icon: "hsl(213 15% 50%)" },
};

export default function DashboardPage() {
  const [data, setData] = useState<ExhibitorData | null>(null);
  const [graphicsElements, setGraphicsElements] = useState<GraphicElement[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number; hours: number; minutes: number;
  } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const exhibitorData = await apiFetch<ExhibitorData>("/portal/me/exhibitor");
        setData(exhibitorData);

        const graphics = await apiFetch<GraphicElement[]>("/portal/me/exhibitor/graphics");
        setGraphicsElements(graphics);

        if (exhibitorData.deadline_graphics) {
          const deadline = new Date(exhibitorData.deadline_graphics);
          const now = new Date();
          const diff = deadline.getTime() - now.getTime();
          if (diff > 0) {
            setTimeRemaining({
              days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
              hours:   Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
              minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
            });
          }
        }
      } catch {
        // silently fail — handled by layout auth check
      }
    }
    fetchData();
  }, []);

  const progress = (() => {
    if (!data) return 0;
    const done = [
      data.graphics_status === "approved",
      data.description_status === "submitted",
      data.participants_status === "submitted",
    ].filter(Boolean).length;
    return Math.round((done / 3) * 100);
  })();

  const tasks = data
    ? [
        { title: "Upload Graphics",    status: data.graphics_status,     href: "/graphics",     icon: FileImage },
        { title: "Company Description",status: data.description_status,  href: "/description",  icon: FileText },
        { title: "Participants List",   status: data.participants_status, href: "/participants", icon: Users },
      ]
    : [];

  const approvedCount = graphicsElements.filter((g) => g.status === "approved").length;
  const requiredCount = graphicsElements.filter((g) => g.required).length;

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <span
            className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin"
          />
          <p className="text-sm text-muted-foreground">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7 animate-fade-up">

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">{data.event_name}</p>
        </div>
        <div
          className="hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{
            background: "hsl(209 65% 21% / 0.07)",
            color: "hsl(209 65% 28%)",
            border: "1px solid hsl(209 65% 21% / 0.15)",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "hsl(154 100% 49%)" }}
          />
          {data.booth_type.replace(/_/g, " ")} · {data.booth_size} m²
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">

        {/* Overall Progress */}
        <Card className="card-elevated relative overflow-hidden stagger-1 animate-fade-up">
          <div
            className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
            style={{ background: "linear-gradient(90deg, hsl(154 100% 49%), hsl(170 80% 44%))" }}
          />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Overall Progress
              </CardTitle>
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ background: "hsl(154 100% 49% / 0.12)" }}
              >
                <TrendingUp className="h-4 w-4" style={{ color: "hsl(154 60% 38%)" }} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold tracking-tight" style={{ color: "hsl(209 65% 21%)" }}>
                {progress}
              </span>
              <span className="text-lg font-semibold text-muted-foreground mb-0.5">%</span>
            </div>
            <Progress value={progress} className="mt-3 h-1.5" />
            <p className="text-xs text-muted-foreground mt-2">
              {tasks.filter((t) => t.status === "approved" || t.status === "submitted").length} of 3 tasks complete
            </p>
          </CardContent>
        </Card>

        {/* Deadline */}
        <Card className="card-elevated relative overflow-hidden stagger-2 animate-fade-up">
          <div
            className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
            style={{
              background: timeRemaining
                ? timeRemaining.days < 7
                  ? "hsl(45 96% 48%)"
                  : "hsl(209 65% 50%)"
                : "hsl(0 72% 51%)",
            }}
          />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Graphics Deadline
              </CardTitle>
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ background: "hsl(209 65% 21% / 0.08)" }}
              >
                <Clock className="h-4 w-4" style={{ color: "hsl(209 65% 38%)" }} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {timeRemaining ? (
              <div className="flex items-end gap-3">
                <div className="text-center">
                  <span className="text-2xl font-bold tracking-tight" style={{ color: "hsl(209 65% 21%)" }}>
                    {timeRemaining.days}
                  </span>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">days</p>
                </div>
                <div className="text-center">
                  <span className="text-2xl font-bold tracking-tight" style={{ color: "hsl(209 65% 21%)" }}>
                    {timeRemaining.hours}
                  </span>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">hrs</p>
                </div>
                <div className="text-center">
                  <span className="text-2xl font-bold tracking-tight" style={{ color: "hsl(209 65% 21%)" }}>
                    {timeRemaining.minutes}
                  </span>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">min</p>
                </div>
              </div>
            ) : (
              <span className="text-2xl font-bold text-destructive">Expired</span>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {data.deadline_graphics
                ? new Date(data.deadline_graphics).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "Date not set"}
            </p>
          </CardContent>
        </Card>

        {/* Graphics Status */}
        <Card className="card-elevated relative overflow-hidden stagger-3 animate-fade-up">
          <div
            className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
            style={{
              background:
                approvedCount === requiredCount && requiredCount > 0
                  ? "linear-gradient(90deg, hsl(154 100% 49%), hsl(170 80% 44%))"
                  : "hsl(209 65% 50%)",
            }}
          />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Graphics Status
              </CardTitle>
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ background: "hsl(209 65% 21% / 0.08)" }}
              >
                <FileImage className="h-4 w-4" style={{ color: "hsl(209 65% 38%)" }} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold tracking-tight" style={{ color: "hsl(209 65% 21%)" }}>
                {approvedCount}
              </span>
              <span className="text-lg font-semibold text-muted-foreground mb-0.5">/ {requiredCount}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Approved of required files</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Task checklist ───────────────────────────────────────── */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Submission Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.map((task, i) => {
            const Icon = task.icon;
            const isComplete =
              task.status === "approved" || task.status === "submitted";
            const isReview = task.status === "under_review";

            return (
              <Link
                key={task.title}
                href={task.href}
                className={[
                  "flex items-center gap-4 p-4 rounded-xl border",
                  "transition-all duration-200 group",
                  `stagger-${i + 1} animate-fade-up`,
                ].join(" ")}
                style={{
                  borderColor: isComplete
                    ? "hsl(154 60% 82%)"
                    : "hsl(var(--border))",
                  background: isComplete ? "hsl(154 80% 97%)" : "hsl(var(--card))",
                }}
                onMouseEnter={(e) => {
                  if (!isComplete) {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "hsl(209 65% 21% / 0.3)";
                    (e.currentTarget as HTMLElement).style.background =
                      "hsl(209 65% 21% / 0.03)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    isComplete ? "hsl(154 60% 82%)" : "hsl(var(--border))";
                  (e.currentTarget as HTMLElement).style.background = isComplete
                    ? "hsl(154 80% 97%)"
                    : "hsl(var(--card))";
                }}
              >
                {/* Icon box */}
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: isComplete
                      ? "hsl(154 100% 49% / 0.15)"
                      : isReview
                      ? "hsl(45 100% 94%)"
                      : "hsl(209 65% 21% / 0.07)",
                  }}
                >
                  {isComplete ? (
                    <CheckCircle2
                      className="h-5 w-5"
                      style={{ color: "hsl(154 60% 38%)" }}
                    />
                  ) : (
                    <Icon
                      className="h-5 w-5"
                      style={{
                        color: isReview ? "hsl(45 80% 40%)" : "hsl(209 65% 38%)",
                      }}
                    />
                  )}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium leading-tight"
                    style={{
                      color: isComplete ? "hsl(154 60% 28%)" : "hsl(var(--foreground))",
                    }}
                  >
                    {task.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isComplete
                      ? "Completed"
                      : isReview
                      ? "Under review by admin"
                      : "Action required"}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={task.status} />
                  <ArrowRight
                    className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Graphics elements grid ───────────────────────────────── */}
      {graphicsElements.length > 0 && (
        <Card className="card-elevated">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Booth Graphics Elements</CardTitle>
              <span className="text-xs text-muted-foreground">
                {approvedCount} / {requiredCount} required approved
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {graphicsElements.map((element) => (
                <div
                  key={element.name}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{
                        background:
                          element.status === "approved"
                            ? "hsl(154 100% 49%)"
                            : element.status === "under_review"
                            ? "hsl(45 96% 48%)"
                            : "hsl(213 15% 75%)",
                      }}
                    />
                    <span className="text-sm font-medium text-foreground leading-tight">
                      {element.label}
                    </span>
                    {!element.required && (
                      <span className="text-[10px] text-muted-foreground">(optional)</span>
                    )}
                    {element.required && element.status !== "approved" && (
                      <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    )}
                  </div>
                  <StatusBadge status={element.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
