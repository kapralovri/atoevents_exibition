"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import {
  Clock,
  CheckCircle2,
  FileImage,
  FileText,
  Users,
  AlertCircle,
  ArrowRight,
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
        // handled by layout auth check
      }
    }
    fetchData();
  }, []);

  const allApproved =
    data?.graphics_status === "approved" &&
    (data?.description_status === "approved" || data?.description_status === "submitted") &&
    (data?.participants_status === "submitted" || data?.participants_status === "approved");

  const progress = (() => {
    if (!data) return 0;
    const done = [
      data.graphics_status === "approved",
      data.description_status === "submitted" || data.description_status === "approved",
      data.participants_status === "submitted" || data.participants_status === "approved",
    ].filter(Boolean).length;
    return Math.round((done / 3) * 100);
  })();

  const tasks = data
    ? [
        { title: "Upload Graphics",     status: data.graphics_status,     href: "/graphics",     icon: FileImage },
        { title: "Company Description", status: data.description_status,  href: "/description",  icon: FileText  },
        { title: "Participants List",   status: data.participants_status,  href: "/participants", icon: Users     },
      ]
    : [];

  const approvedCount = graphicsElements.filter((g) => g.status === "approved").length;
  const requiredCount = graphicsElements.filter((g) => g.required).length;

  // SVG circle progress
  const RADIUS = 50;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const strokeOffset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;

  const isUrgent = timeRemaining && timeRemaining.days < 7;

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="h-7 w-7 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-up">

      {/* ── Event header banner ──────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden px-6 py-5"
        style={{
          background: "linear-gradient(135deg, hsl(209 65% 22%) 0%, hsl(209 65% 15%) 100%)",
        }}
      >
        {/* Radial glow top-left */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at -5% -20%, hsl(154 100% 49% / 0.18) 0%, transparent 55%), " +
              "radial-gradient(ellipse at 110% 110%, hsl(209 65% 10% / 0.45) 0%, transparent 50%)",
          }}
        />
        {/* Subtle grid texture */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p
              className="text-[9px] font-semibold uppercase tracking-[0.2em] mb-1.5"
              style={{ color: "hsl(154 100% 49% / 0.55)" }}
            >
              Current Event
            </p>
            <h1
              className="text-xl font-bold text-white leading-tight tracking-tight truncate"
              style={{ letterSpacing: "-0.025em" }}
            >
              {data.event_name}
            </h1>
            <p className="mt-1.5 text-xs font-medium" style={{ color: "hsl(210 40% 52%)" }}>
              {data.booth_type.replace(/_/g, " ")} &middot; {data.booth_size}&thinsp;m²
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={data.overall_status} />
            {timeRemaining && (
              <div
                className="flex items-center gap-1.5 text-[11px] font-medium"
                style={{ color: isUrgent ? "hsl(45 96% 58%)" : "hsl(210 40% 48%)" }}
              >
                <Clock className="h-3 w-3 shrink-0" />
                <span className="tabular-nums" style={{ fontFamily: "var(--font-geist-mono, monospace)" }}>
                  {timeRemaining.days}d {String(timeRemaining.hours).padStart(2, "0")}h {String(timeRemaining.minutes).padStart(2, "0")}m
                </span>
                <span>to deadline</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main grid: Progress (5) + Tasks (7) ─────────────────────── */}
      <div className="grid gap-5 md:grid-cols-[5fr_7fr]">

        {/* Left: Circular progress + Deadline countdown */}
        <div
          className="rounded-2xl border bg-card card-elevated p-6 space-y-5"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          {/* Completion ring */}
          <div>
            <p className="section-label mb-4">Completion</p>
            <div className="flex items-center gap-5">
              {/* SVG arc progress */}
              <div className="relative shrink-0">
                <svg
                  width="116"
                  height="116"
                  viewBox="0 0 140 140"
                  style={{ transform: "rotate(-90deg)" }}
                >
                  {/* Track */}
                  <circle
                    cx="70" cy="70" r={RADIUS}
                    fill="none"
                    stroke="hsl(213 20% 90%)"
                    strokeWidth="10"
                  />
                  {/* Progress arc — always green, glows at 100% */}
                  <circle
                    cx="70" cy="70" r={RADIUS}
                    fill="none"
                    stroke="hsl(154 100% 49%)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={strokeOffset}
                    style={{
                      transition: "stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                      willChange: "stroke-dashoffset",
                      filter: progress === 100
                        ? "drop-shadow(0 0 7px hsl(154 100% 49% / 0.65))"
                        : "drop-shadow(0 0 3px hsl(154 100% 49% / 0.28))",
                    }}
                  />
                </svg>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className="text-[1.6rem] font-bold tracking-tight leading-none tabular-nums"
                    style={{
                      color: "hsl(209 65% 21%)",
                      fontFamily: "var(--font-geist-mono, monospace)",
                    }}
                  >
                    {progress}%
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {tasks.filter((t) => t.status === "approved" || t.status === "submitted").length}{" "}
                  <span className="text-muted-foreground font-normal">of 3</span>
                </p>
                <p className="text-xs text-muted-foreground">tasks submitted</p>
                {progress === 100 && (
                  <p
                    className="text-xs font-semibold mt-2"
                    style={{ color: "hsl(154 60% 35%)" }}
                  >
                    All complete
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Deadline */}
          {timeRemaining ? (
            <div
              className="pt-5"
              style={{ borderTop: "1px solid hsl(var(--border) / 0.6)" }}
            >
              <p className="section-label mb-3">Graphics deadline</p>
              <div className="flex items-end gap-4">
                {[
                  { value: timeRemaining.days,    label: "days" },
                  { value: timeRemaining.hours,   label: "hrs"  },
                  { value: timeRemaining.minutes, label: "min"  },
                ].map(({ value, label }) => (
                  <div key={label} className="text-center">
                    <div
                      className="text-3xl font-bold leading-none tabular-nums"
                      style={{
                        color: isUrgent
                          ? "hsl(0 72% 51%)"
                          : "hsl(209 65% 21%)",
                        fontFamily: "var(--font-geist-mono, monospace)",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {String(value).padStart(2, "0")}
                    </div>
                    <div
                      className="text-[9px] uppercase tracking-widest mt-1"
                      style={{ color: "hsl(213 15% 58%)" }}
                    >
                      {label}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {new Date(data.deadline_graphics).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          ) : data.deadline_graphics ? (
            <div
              className="pt-5"
              style={{ borderTop: "1px solid hsl(var(--border) / 0.6)" }}
            >
              <p className="section-label mb-2">Deadline</p>
              <span className="text-lg font-bold text-destructive">Expired</span>
            </div>
          ) : null}
        </div>

        {/* Right: Task checklist (divider-based, no inner cards) */}
        <div
          className="rounded-2xl border bg-card card-elevated p-6"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <p className="section-label mb-4">Submission tasks</p>
          <div
            className="divide-y"
            style={{ borderColor: "hsl(var(--border) / 0.55)" }}
          >
            {tasks.map((task, i) => {
              const Icon = task.icon;
              const isComplete =
                task.status === "approved" || task.status === "submitted";
              const isReview = task.status === "under_review";

              return (
                <Link
                  key={task.title}
                  href={task.href}
                  className="group flex items-center gap-4 py-4 first:pt-0 last:pb-0 rounded-xl animate-fade-up"
                  style={{
                    animationDelay: `${i * 60}ms`,
                    animationFillMode: "both",
                    transition: "background-color 130ms cubic-bezier(0.23,1,0.32,1)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(213 20% 96% / 0.7)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "";
                  }}
                >
                  {/* Icon */}
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105"
                    style={{
                      background: isComplete
                        ? "hsl(154 100% 49% / 0.1)"
                        : isReview
                        ? "hsl(45 100% 94%)"
                        : "hsl(209 65% 21% / 0.06)",
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
                          color: isReview
                            ? "hsl(45 80% 40%)"
                            : "hsl(209 65% 40%)",
                        }}
                      />
                    )}
                  </div>

                  {/* Label + subtitle */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold leading-tight"
                      style={{
                        color: isComplete
                          ? "hsl(154 60% 30%)"
                          : "hsl(var(--foreground))",
                      }}
                    >
                      {task.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isComplete
                        ? "Submitted"
                        : isReview
                        ? "Under review"
                        : "Action required"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={task.status} />
                    <ArrowRight
                      className="h-3.5 w-3.5 text-muted-foreground opacity-0 translate-x-0 group-hover:opacity-100 group-hover:translate-x-0.5"
                      style={{ transition: "opacity 140ms cubic-bezier(0.23,1,0.32,1), transform 140ms cubic-bezier(0.23,1,0.32,1)" }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── All done banner ─────────────────────────────────────────────── */}
      {allApproved && (
        <div
          className="relative rounded-2xl overflow-hidden px-6 py-5"
          style={{
            background: "linear-gradient(135deg, hsl(154 60% 22%) 0%, hsl(154 55% 16%) 100%)",
          }}
        >
          {/* Glow */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 10% 50%, hsl(154 100% 49% / 0.22) 0%, transparent 60%), " +
                "radial-gradient(ellipse at 90% 50%, hsl(154 100% 49% / 0.10) 0%, transparent 50%)",
            }}
          />
          <div className="relative flex items-center gap-4">
            {/* Check icon */}
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "hsl(154 100% 49% / 0.15)", border: "1px solid hsl(154 100% 49% / 0.3)" }}
            >
              <CheckCircle2 className="h-6 w-6" style={{ color: "hsl(154 100% 49%)" }} />
            </div>
            <div className="min-w-0">
              <p
                className="text-sm font-bold uppercase tracking-widest"
                style={{ color: "hsl(154 100% 49% / 0.7)", letterSpacing: "0.15em" }}
              >
                All tasks complete
              </p>
              <h2
                className="text-xl font-bold text-white mt-0.5"
                style={{ letterSpacing: "-0.02em" }}
              >
                You&apos;re Ready for the Event!
              </h2>
              <p className="text-sm mt-1" style={{ color: "hsl(154 60% 62%)" }}>
                All materials submitted and approved. Your ATO COMM manager has been notified.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Booth graphics elements ───────────────────────────────────── */}
      {graphicsElements.length > 0 && (
        <div
          className="rounded-2xl border bg-card card-elevated"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          {/* Section header */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: "1px solid hsl(var(--border) / 0.55)" }}
          >
            <div>
              <p className="section-label">Booth graphics</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {approvedCount}{" "}
                <span className="font-normal text-muted-foreground">
                  of {requiredCount} required files approved
                </span>
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: "hsl(154 100% 49%)",
                    boxShadow: "0 0 5px hsl(154 100% 49% / 0.5)",
                  }}
                />
                Approved
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: "hsl(45 96% 48%)" }}
                />
                In review
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: "hsl(213 15% 75%)" }}
                />
                Pending
              </span>
            </div>
          </div>

          <div className="p-6">
            <div className="grid gap-2 sm:grid-cols-2">
              {graphicsElements.map((element) => {
                const isApproved = element.status === "approved";
                const isReview   = element.status === "under_review";
                return (
                  <div
                    key={element.name}
                    className="group flex items-center justify-between px-4 py-2.5 rounded-xl transition-colors hover:bg-muted/40"
                    style={{ border: "1px solid hsl(var(--border) / 0.65)" }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{
                          background: isApproved
                            ? "hsl(154 100% 49%)"
                            : isReview
                            ? "hsl(45 96% 48%)"
                            : "hsl(213 15% 74%)",
                          boxShadow: isApproved
                            ? "0 0 6px hsl(154 100% 49% / 0.5)"
                            : "none",
                        }}
                      />
                      <span className="text-sm font-medium text-foreground truncate">
                        {element.label}
                      </span>
                      {!element.required && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          optional
                        </span>
                      )}
                      {element.required && !isApproved && (
                        <AlertCircle
                          className="h-3.5 w-3.5 text-destructive shrink-0"
                        />
                      )}
                    </div>
                    <StatusBadge status={element.status} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
