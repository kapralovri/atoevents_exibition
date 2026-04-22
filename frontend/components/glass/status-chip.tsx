import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "muted" | "live";

interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  glow?: boolean;
  dot?: boolean;
  pulse?: boolean;
}

const TONE_STYLES: Record<Tone, { bg: string; fg: string; bd: string; dot: string }> = {
  success: {
    bg: "hsl(168 45% 95%)",
    fg: "hsl(168 55% 26%)",
    bd: "hsl(168 35% 82%)",
    dot: "hsl(168 55% 42%)",
  },
  warning: {
    bg: "hsl(38 85% 95%)",
    fg: "hsl(32 70% 32%)",
    bd: "hsl(38 60% 82%)",
    dot: "hsl(32 75% 52%)",
  },
  danger: {
    bg: "hsl(0 70% 96%)",
    fg: "hsl(0 60% 42%)",
    bd: "hsl(0 50% 86%)",
    dot: "hsl(0 65% 55%)",
  },
  info: {
    bg: "hsl(212 40% 95%)",
    fg: "hsl(212 40% 26%)",
    bd: "hsl(212 30% 82%)",
    dot: "hsl(212 45% 48%)",
  },
  muted: {
    bg: "hsl(214 20% 95%)",
    fg: "hsl(215 15% 40%)",
    bd: "hsl(214 15% 86%)",
    dot: "hsl(215 15% 50%)",
  },
  live: {
    bg: "hsl(168 45% 95%)",
    fg: "hsl(168 55% 24%)",
    bd: "hsl(168 35% 80%)",
    dot: "hsl(168 65% 42%)",
  },
};

export const StatusChip = React.forwardRef<HTMLSpanElement, StatusChipProps>(
  ({ tone = "info", glow = false, dot = false, pulse = false, className, children, ...props }, ref) => {
    const s = TONE_STYLES[tone];
    return (
      <span
        ref={ref}
        className={cn("chip", glow && "glow-mint", className)}
        style={{
          background: s.bg,
          color: s.fg,
          border: `1px solid ${s.bd}`,
        }}
        {...props}
      >
        {dot && (
          <span
            className={cn("h-1.5 w-1.5 rounded-full", pulse && "pulse-dot")}
            style={{ background: s.dot }}
          />
        )}
        {children}
      </span>
    );
  }
);
StatusChip.displayName = "StatusChip";
