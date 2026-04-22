import * as React from "react";
import { GlassCard } from "./glass-card";
import { cn } from "@/lib/utils";

type Accent = "mint" | "amber" | "red" | "navy" | "slate";

interface KpiCardProps {
  eyebrow: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: Accent;
  progress?: number; // 0..100 → renders progress bar below
  className?: string;
}

const ACCENT_COLORS: Record<Accent, { bar: string; value: string }> = {
  mint:  { bar: "linear-gradient(90deg,hsl(168 55% 45%),hsl(190 50% 50%))", value: "text-[hsl(168_55%_32%)]" },
  amber: { bar: "linear-gradient(90deg,hsl(38 80% 55%),hsl(28 80% 52%))",   value: "text-[hsl(32_70%_38%)]"  },
  red:   { bar: "linear-gradient(90deg,hsl(0 65% 55%),hsl(10 65% 52%))",    value: "text-[hsl(0_60%_46%)]"   },
  navy:  { bar: "linear-gradient(90deg,hsl(212 40% 32%),hsl(212 40% 22%))", value: "text-[hsl(212_40%_20%)]" },
  slate: { bar: "linear-gradient(90deg,hsl(214 15% 65%),hsl(214 15% 50%))", value: "text-slate-500"          },
};

export function KpiCard({
  eyebrow,
  value,
  sub,
  icon,
  accent = "mint",
  progress,
  className,
}: KpiCardProps) {
  const a = ACCENT_COLORS[accent];
  const useGradient = accent === "mint";

  return (
    <GlassCard className={cn("relative p-5 overflow-hidden", className)}>
      {/* Top color bar — encodes urgency / status */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: a.bar }}
      />
      <div className="flex items-center gap-2">
        {icon && (
          <span
            className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-600"
            style={{ background: "hsl(214 20% 95%)" }}
          >
            {icon}
          </span>
        )}
        <p
          className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500"
          style={{ fontFamily: "var(--font-display), Manrope, system-ui, sans-serif" }}
        >
          {eyebrow}
        </p>
      </div>
      <p
        className={cn(
          "mt-3 text-[28px] font-extrabold leading-none tracking-[-0.02em]",
          useGradient ? "gradient-text-mint" : a.value
        )}
        style={{ fontFamily: "var(--font-display), Manrope, system-ui, sans-serif" }}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-2 font-medium">{sub}</p>}
      {typeof progress === "number" && (
        <div className="mt-4 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.max(0, Math.min(100, progress))}%`,
              background: a.bar,
            }}
          />
        </div>
      )}
    </GlassCard>
  );
}
