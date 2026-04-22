import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "light" | "dark";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  rim?: boolean; // gradient rim border
  padded?: boolean;
  hover?: boolean;
}

/**
 * GlassCard — frosted-glass surface used everywhere in the portal.
 * Mirrors `.glass-light` / `.glass-dark` + optional `.border-gradient-*` rim.
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ tone = "light", rim = true, padded = false, hover = false, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-2xl",
          tone === "light" ? "glass-light" : "glass-dark text-white",
          rim && (tone === "light" ? "border-gradient-light" : "border-gradient-dark"),
          padded && "p-5",
          hover && "transition-transform duration-200 hover:-translate-y-0.5",
          className
        )}
        {...props}
      />
    );
  }
);
GlassCard.displayName = "GlassCard";
