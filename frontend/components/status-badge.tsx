import { Badge } from "@/components/ui/badge";

type StatusVariant =
  | "success"
  | "warning"
  | "destructive"
  | "muted"
  | "info"
  | "active";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

function getStatusVariant(status: string): StatusVariant {
  if (!status) return "muted";
  const s = status.toLowerCase();

  // Active (event is live / running) — ALWAYS green with indicator dot
  if (["active", "live", "running"].includes(s)) {
    return "active";
  }

  // Success variants
  if (["approved", "complete", "completed", "submitted"].includes(s)) {
    return "success";
  }

  // Warning variants
  if (["under_review", "in_progress", "upcoming", "pending"].includes(s)) {
    return "warning";
  }

  // Destructive variants
  if (["revision", "locked", "overdue", "cancelled"].includes(s)) {
    return "destructive";
  }

  // Info variants
  if (
    ["file_upload", "material_approved", "gdpr_accepted", "exhibitor_created"].includes(s)
  ) {
    return "info";
  }

  // Default muted (draft, past, unknown, …)
  return "muted";
}

function formatStatusLabel(status: string): string {
  if (!status) return "Unknown";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = getStatusVariant(status);
  const label = formatStatusLabel(status);

  if (variant === "active") {
    // Dedicated render: always-green with pulsing dot, regardless of page/event theme
    return (
      <Badge variant="active" className={className}>
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5 rounded-full mr-1.5 animate-pulse-dot"
          style={{
            background: "hsl(154 70% 34%)",
            boxShadow: "0 0 6px hsl(154 70% 34% / 0.6)",
          }}
        />
        {label}
      </Badge>
    );
  }

  return <Badge variant={variant} className={className}>{label}</Badge>;
}
