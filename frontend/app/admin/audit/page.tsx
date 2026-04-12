"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ClipboardList,
  Search,
  Filter,
  Upload,
  CheckCircle2,
  ShieldCheck,
  Building2,
  RotateCcw,
  Lock,
  FileText,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";

interface AuditLog {
  id: string;
  actor_type: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  created_at: string;
}

const ACTION_FILTERS = [
  "All",
  "file_upload",
  "material_approved",
  "material_revision",
  "description_submitted",
  "exhibitor_locked",
  "exhibitor_created",
  "gdpr_accepted",
];

const ACTION_META: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; border: string }
> = {
  file_upload: {
    icon: Upload,
    color: "hsl(209 65% 38%)",
    bg: "hsl(209 65% 21% / 0.08)",
    border: "hsl(209 65% 21% / 0.2)",
  },
  material_approved: {
    icon: CheckCircle2,
    color: "hsl(154 60% 35%)",
    bg: "hsl(154 80% 94%)",
    border: "hsl(154 60% 82%)",
  },
  gdpr_accepted: {
    icon: ShieldCheck,
    color: "hsl(154 60% 35%)",
    bg: "hsl(154 80% 94%)",
    border: "hsl(154 60% 82%)",
  },
  exhibitor_created: {
    icon: Building2,
    color: "hsl(209 65% 38%)",
    bg: "hsl(209 65% 21% / 0.08)",
    border: "hsl(209 65% 21% / 0.2)",
  },
  material_revision: {
    icon: RotateCcw,
    color: "hsl(45 80% 30%)",
    bg: "hsl(45 100% 94%)",
    border: "hsl(45 80% 82%)",
  },
  exhibitor_locked: {
    icon: Lock,
    color: "hsl(0 72% 40%)",
    bg: "hsl(0 80% 97%)",
    border: "hsl(0 72% 88%)",
  },
  description_submitted: {
    icon: FileText,
    color: "hsl(154 60% 35%)",
    bg: "hsl(154 80% 94%)",
    border: "hsl(154 60% 82%)",
  },
};

const SELECT_CLASSES =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-[hsl(209_65%_21%)] focus:ring-offset-2";

const formatActionLabel = (action: string) =>
  action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("All");

  useEffect(() => {
    async function fetchLogs() {
      try {
        const data = await apiFetch<AuditLog[]>("/admin/audit");
        setLogs(data);
        setFilteredLogs(data);
      } catch (error) {
        console.error("Failed to fetch audit logs:", error);
      }
    }
    fetchLogs();
  }, []);

  useEffect(() => {
    let filtered = logs;
    if (actionFilter !== "All") {
      filtered = filtered.filter((log) => log.action === actionFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.actor_name.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q)
      );
    }
    setFilteredLogs(filtered);
  }, [logs, searchQuery, actionFilter]);

  return (
    <div className="flex h-screen" style={{ background: "hsl(213 25% 97%)" }}>
      <Sidebar userRole="admin" />
      <main className="flex-1 ml-64 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-6 animate-fade-up">

          {/* ── Header ───────────────────────────────────────────── */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="page-title">Audit Log</h1>
              <p className="page-description">Track all system actions and changes</p>
            </div>
            <div
              className="hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                background: "hsl(209 65% 21% / 0.07)",
                color: "hsl(209 65% 28%)",
                border: "1px solid hsl(209 65% 21% / 0.15)",
              }}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              {filteredLogs.length} entries
            </div>
          </div>

          {/* ── Filters ──────────────────────────────────────────── */}
          <Card className="card-elevated">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                    style={{ color: "hsl(213 15% 55%)" }}
                  />
                  <Input
                    placeholder="Search by name or details…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {/* Action filter */}
                <div className="relative sm:w-52">
                  <Filter
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none z-10"
                    style={{ color: "hsl(213 15% 55%)" }}
                  />
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className={SELECT_CLASSES}
                  >
                    {ACTION_FILTERS.map((f) => (
                      <option key={f} value={f}>
                        {f === "All" ? "All Actions" : formatActionLabel(f)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Log table ────────────────────────────────────────── */}
          <Card className="card-elevated">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Activity Log</CardTitle>
                <CardDescription>{filteredLogs.length} entries</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                        {["Date / Time", "Actor", "Action", "Details"].map((h) => (
                          <th
                            key={h}
                            className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => {
                        const meta = ACTION_META[log.action] || {
                          icon: ClipboardList,
                          color: "hsl(213 15% 50%)",
                          bg: "hsl(213 15% 96%)",
                          border: "hsl(213 15% 88%)",
                        };
                        const Icon = meta.icon;

                        return (
                          <tr
                            key={log.id}
                            style={{ borderBottom: "1px solid hsl(var(--border))" }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background =
                                "hsl(209 65% 21% / 0.02)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "";
                            }}
                          >
                            {/* Date */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="text-xs font-medium text-foreground tabular-nums">
                                {new Date(log.created_at).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {new Date(log.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </td>

                            {/* Actor */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                                  style={{
                                    background: "hsl(209 65% 21% / 0.08)",
                                    color: "hsl(209 65% 28%)",
                                  }}
                                >
                                  {log.actor_type}
                                </span>
                                <span className="text-sm font-medium text-foreground">
                                  {log.actor_name}
                                </span>
                              </div>
                            </td>

                            {/* Action badge */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1"
                                style={{
                                  background: meta.bg,
                                  color: meta.color,
                                  border: `1px solid ${meta.border}`,
                                }}
                              >
                                <Icon className="h-3 w-3 shrink-0" />
                                {formatActionLabel(log.action)}
                              </span>
                            </td>

                            {/* Details */}
                            <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs">
                              <span className="line-clamp-2">{log.details}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center"
                    style={{ background: "hsl(209 65% 21% / 0.07)" }}
                  >
                    <ClipboardList
                      className="h-7 w-7"
                      style={{ color: "hsl(209 65% 38%)" }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">No logs found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Try adjusting your search or filter
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
