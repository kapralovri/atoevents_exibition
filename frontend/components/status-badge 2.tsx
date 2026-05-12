import { Badge } from "@/components/ui/badge";

type StatusVariant = "success" | "warning" | "destructive" | "muted" | "info";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

function getStatusVariant(status: string): StatusVariant {
  if (!status) return "muted";
  const s = status.toLowerCase();

  // Success variants
  if (["approved", "complete", "submitted"].includes(s)) {
    return "success";
  }

  // Warning variants
  if (["under_review", "in_progress"].includes(s)) {
    return "warning";
  }

  // Destructive variants
  if (["revision", "locked"].includes(s)) {
    return "destructive";
  }

  // Info variants
  if (["file_upload", "material_approved", "gdpr_accepted", "exhibitor_created"].includes(s)) {
    return "info";
  }

  // Default muted
  return "muted";
}

function formatStatusLabel(status: string): string {
  if (!status) return "Unknown";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = getStatusVariant(status);
  const label = formatStatusLabel(status);

  return <Badge variant={variant} className={className}>{label}</Badge>;
}
