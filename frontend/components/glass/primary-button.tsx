import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
}

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-xs",
  lg: "h-11 px-5 text-sm",
};

export const PrimaryButton = React.forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      leftIcon,
      rightIcon,
      loading = false,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const base =
      "inline-flex items-center justify-center gap-1.5 rounded-xl font-extrabold tracking-tight transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

    const variants: Record<Variant, string> = {
      primary: "text-white shadow-[0_4px_12px_rgba(30,58,72,0.18)] hover:shadow-[0_6px_16px_rgba(30,58,72,0.25)]",
      secondary:
        "bg-white border border-slate-200 text-[hsl(212_40%_20%)] hover:bg-slate-50 hover:border-slate-300",
      ghost: "text-[hsl(212_40%_20%)] hover:bg-slate-100",
      danger: "text-white hover:brightness-110",
    };

    const primaryStyle =
      variant === "primary"
        ? { background: "linear-gradient(135deg,hsl(212 40% 22%),hsl(212 40% 32%))" }
        : variant === "danger"
        ? { background: "linear-gradient(135deg,hsl(0 65% 52%),hsl(10 65% 55%))" }
        : undefined;

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, SIZE[size], variants[variant], className)}
        style={primaryStyle}
        {...props}
      >
        {loading ? (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {rightIcon}
      </button>
    );
  }
);
PrimaryButton.displayName = "PrimaryButton";
