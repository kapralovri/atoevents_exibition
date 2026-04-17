import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold",
    // Enumerate exact properties — never transition:all (catches layout props, causes repaints)
    "[transition:transform_160ms_cubic-bezier(0.23,1,0.32,1),background-color_160ms_cubic-bezier(0.23,1,0.32,1),box-shadow_160ms_cubic-bezier(0.23,1,0.32,1),opacity_160ms_cubic-bezier(0.23,1,0.32,1)]",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-40",
    // Press: instant (100ms), release: 160ms (set by base transition)
    "active:scale-[0.97] active:[transition-duration:100ms]",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "rounded-lg bg-primary text-primary-foreground shadow-sm " +
          "hover:bg-[hsl(209_65%_17%)] hover:shadow-md",
        accent:
          "rounded-lg bg-accent text-accent-foreground shadow-sm font-bold " +
          "hover:bg-[hsl(154_100%_44%)] hover:shadow-md",
        destructive:
          "rounded-lg bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "rounded-lg border border-input bg-background shadow-sm " +
          "hover:bg-secondary hover:border-primary/30 hover:text-foreground",
        secondary:
          "rounded-lg bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/70",
        ghost:
          "rounded-lg hover:bg-secondary hover:text-foreground text-muted-foreground",
        link:
          "text-primary underline-offset-4 hover:underline p-0 h-auto shadow-none",
        "nav-item":
          "rounded-md w-full justify-start gap-3 px-3 py-2 text-sm font-medium " +
          "text-sidebar-foreground hover:bg-[hsl(209_70%_16%)] hover:text-white transition-colors",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm:      "h-8 px-3 text-xs",
        lg:      "h-11 px-6 text-base",
        xl:      "h-12 px-8 text-base",
        icon:    "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
