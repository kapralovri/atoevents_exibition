"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { FileImage, FileText, Users, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";

interface ExhibitorData {
  event_name: string;
  graphics_status: string;
  description_status: string;
  participants_status: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  event_name: string;
  status: string;
  href: string;
  icon: React.ElementType;
  deadline?: string;
}

export default function TasksPage() {
  const [data, setData] = useState<ExhibitorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ExhibitorData>("/portal/me/exhibitor")
      .then(setData)
      .catch(() => toast.error("Failed to load tasks"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "hsl(209 65% 21% / 0.2)", borderTopColor: "hsl(209 65% 21%)" }} />
      </div>
    );
  }

  const tasks: Task[] = data ? [
    {
      id: "graphics",
      title: "Booth Graphics",
      description: "Upload and submit your booth graphic files for validation",
      event_name: data.event_name,
      status: data.graphics_status,
      href: "/graphics",
      icon: FileImage,
    },
    {
      id: "description",
      title: "Company Description",
      description: "Write your company description for the exhibition catalogue",
      event_name: data.event_name,
      status: data.description_status,
      href: "/description",
      icon: FileText,
    },
    {
      id: "participants",
      title: "Participants List",
      description: "Register your team members and staff attending the event",
      event_name: data.event_name,
      status: data.participants_status,
      href: "/participants",
      icon: Users,
    },
  ] : [];

  const statusOrder: Record<string, number> = {
    NOT_STARTED: 0, NOT_UPLOADED: 0, NOT_SUBMITTED: 0,
    DRAFT: 1,
    UNDER_REVIEW: 2,
    APPROVED: 3,
    REJECTED: -1,
    REVISION: -1,
  };

  const sorted = [...tasks].sort((a, b) =>
    (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0)
  );

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="page-title">Tasks</h1>
        <p className="page-description">All submission tasks across your exhibitions</p>
      </div>

      <div className="space-y-3">
        {sorted.map((task, i) => {
          const Icon = task.icon;
          return (
            <Link key={task.id} href={task.href}>
              <div
                className={`group relative flex items-center gap-4 rounded-xl cursor-pointer overflow-hidden transition-all duration-200 stagger-${Math.min(i + 1, 4)} animate-fade-up`}
                style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", padding: "16px 20px" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "hsl(209 65% 21% / 0.25)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px hsl(209 65% 21% / 0.07)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "";
                  (e.currentTarget as HTMLElement).style.boxShadow = "";
                }}
              >
                {/* Left stripe */}
                <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
                  style={{
                    background: task.status === "APPROVED"
                      ? "hsl(154 100% 49%)"
                      : task.status === "UNDER_REVIEW"
                      ? "hsl(45 96% 50%)"
                      : task.status === "REVISION" || task.status === "REJECTED"
                      ? "hsl(0 72% 51%)"
                      : "hsl(209 65% 21% / 0.2)",
                  }}
                />

                {/* Icon */}
                <div className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center"
                  style={{ background: "hsl(209 65% 21% / 0.07)" }}>
                  <Icon className="h-5 w-5" style={{ color: "hsl(209 65% 38%)" }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                  <p className="text-xs mt-1.5 font-medium" style={{ color: "hsl(209 65% 38%)" }}>
                    {task.event_name}
                  </p>
                </div>

                {/* Status */}
                <div className="shrink-0">
                  <StatusBadge status={task.status} />
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
