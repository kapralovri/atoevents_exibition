import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors border",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-transparent",
        secondary:
          "bg-secondary text-secondary-foreground border-transparent",
        destructive:
          "bg-[hsl(0_80%_95%)] text-[hsl(0_72%_40%)] border-[hsl(0_72%_85%)]",
        outline:
          "text-foreground border-border bg-transparent",
        success:
          "bg-[hsl(154_80%_94%)] text-[hsl(154_60%_28%)] border-[hsl(154_60%_82%)]",
        warning:
          "bg-[hsl(45_100%_94%)] text-[hsl(45_80%_30%)] border-[hsl(45_80%_82%)]",
        info:
          "bg-[hsl(209_65%_94%)] text-[hsl(209_65%_28%)] border-[hsl(209_50%_82%)]",
        muted:
          "bg-muted text-muted-foreground border-border",
        accent:
          "bg-[hsl(154_100%_90%)] text-[hsl(154_60%_22%)] border-[hsl(154_60%_78%)]",
        active:
          "bg-[hsl(154_80%_94%)] text-[hsl(154_70%_26%)] border-[hsl(154_60%_72%)] uppercase tracking-wider text-[10px] px-2 py-0.5 font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
