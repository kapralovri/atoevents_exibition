import * as React from "react";
import { GlassCard } from "./glass-card";

export interface EventHeroStat {
  label: string;
  value: React.ReactNode;
  accent?: "mint" | "navy" | "amber" | "red";
}

interface EventHeroProps {
  title: string;
  accentWord?: string;
  subtitle?: string;
  chips?: React.ReactNode;
  brandColor?: string;
  stats?: EventHeroStat[];
  right?: React.ReactNode;
}

const ACCENT_TEXT: Record<NonNullable<EventHeroStat["accent"]>, string> = {
  mint: "text-[hsl(168_55%_34%)]",
  navy: "text-[hsl(212_40%_20%)]",
  amber: "text-[hsl(32_75%_38%)]",
  red: "text-[hsl(0_65%_46%)]",
};

const ACCENT_DOT: Record<NonNullable<EventHeroStat["accent"]>, string> = {
  mint: "bg-[hsl(168_55%_45%)]",
  navy: "bg-[hsl(212_40%_35%)]",
  amber: "bg-[hsl(32_75%_52%)]",
  red: "bg-[hsl(0_65%_55%)]",
};

export function EventHero({
  title,
  accentWord,
  subtitle,
  chips,
  brandColor = "188 55% 42%",
  stats = [],
  right,
}: EventHeroProps) {
  let head = title;
  let tail: string | null = null;
  if (accentWord && title.includes(accentWord)) {
    const idx = title.lastIndexOf(accentWord);
    head = title.slice(0, idx).trim();
    tail = accentWord;
  }

  return (
    <GlassCard className="relative overflow-hidden rounded-3xl p-5 md:p-8 mb-6">
      {/* Thin accent bar (top) */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{
          background: `linear-gradient(90deg, hsl(${brandColor}) 0%, hsl(168 55% 48%) 60%, transparent 100%)`,
        }}
      />

      {/* Subtle branded glow — contained, no overflow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-60 w-60 rounded-full opacity-40 blur-3xl"
        style={{ background: `hsl(${brandColor} / 0.18)` }}
      />

      <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div className="min-w-0 flex-1">
          {chips && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">{chips}</div>
          )}
          <h1
            className="font-extrabold leading-[1.05] text-[hsl(212_40%_16%)] tracking-[-0.02em] break-words"
            style={{
              fontFamily: "var(--font-display), Manrope, system-ui, sans-serif",
              fontSize: "clamp(24px, 4vw, 40px)",
            }}
          >
            {head}
            {tail && (
              <span className="text-[hsl(168_55%_38%)]">
                {head ? " " : ""}
                {tail}
              </span>
            )}
          </h1>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-2 font-medium break-words">{subtitle}</p>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:flex lg:items-stretch lg:flex-wrap w-full lg:w-auto">
          {stats.map((s, i) => {
            const accent = s.accent ?? "navy";
            return (
              <div
                key={i}
                className="relative min-w-0 px-4 py-3 rounded-xl bg-white border border-slate-200/80 lg:min-w-[120px]"
              >
                <div className="flex items-center gap-1.5 mb-1 min-w-0">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${ACCENT_DOT[accent]}`} />
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 truncate">
                    {s.label}
                  </p>
                </div>
                <p
                  className={`text-2xl font-extrabold leading-none truncate ${ACCENT_TEXT[accent]}`}
                  style={{ fontFamily: "var(--font-display), Manrope, system-ui, sans-serif" }}
                >
                  {s.value}
                </p>
              </div>
            );
          })}
          {right && <div className="flex items-end col-span-full lg:col-span-1">{right}</div>}
        </div>
      </div>
    </GlassCard>
  );
}
