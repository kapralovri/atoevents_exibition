"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Filter, ClipboardList, ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface EventOption {
  id: string;
  name: string;
}

interface TaskRow {
  exhibitorId: string;
  companyName: string;
  email: string;
  eventId: string;
  eventName: string;
  taskType: "Graphics" | "Description" | "Participants";
  status: string;
}

interface Exhibitor {
  id: string;
  company_name: string;
  email: string;
  graphics_status: string;
  description_status?: string;
  company_status?: string;
  participants_status: string;
}

export default function AdminTasksPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<EventOption[]>("/admin/events")
      .then((data) => setEvents(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    async function fetchTasks() {
      setLoading(true);
      try {
        const eventsToFetch = selectedEventId
          ? events.filter((e) => e.id === selectedEventId)
          : events;

        const rows: TaskRow[] = [];

        await Promise.all(
          eventsToFetch.map(async (ev) => {
            try {
              const exhibitors = await apiFetch<Exhibitor[]>(
                `/admin/events/${ev.id}/exhibitors`
              );
              for (const ex of exhibitors) {
                const graphicsStatus = (ex.graphics_status ?? "").toLowerCase();
                const descStatus = (ex.description_status ?? ex.company_status ?? "").toLowerCase();
                const partStatus = (ex.participants_status ?? "").toLowerCase();

                if (graphicsStatus === "under_review") {
                  rows.push({
                    exhibitorId: ex.id,
                    companyName: ex.company_name,
                    email: ex.email,
                    eventId: ev.id,
                    eventName: ev.name,
                    taskType: "Graphics",
                    status: "under_review",
                  });
                }
                if (descStatus === "under_review") {
                  rows.push({
                    exhibitorId: ex.id,
                    companyName: ex.company_name,
                    email: ex.email,
                    eventId: ev.id,
                    eventName: ev.name,
                    taskType: "Description",
                    status: "under_review",
                  });
                }
                // Participants: show when submitted or under review
                if (partStatus === "submitted" || partStatus === "under_review") {
                  rows.push({
                    exhibitorId: ex.id,
                    companyName: ex.company_name,
                    email: ex.email,
                    eventId: ev.id,
                    eventName: ev.name,
                    taskType: "Participants",
                    status: "under_review",
                  });
                }
              }
            } catch {
              // skip events that fail
            }
          })
        );

        setTasks(rows);
      } catch (error) {
        console.error("Failed to fetch tasks:", error);
      } finally {
        setLoading(false);
      }
    }

    if (events.length > 0 || selectedEventId === "") {
      fetchTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, events]);

  const taskTypeColor: Record<string, { bg: string; text: string; border: string }> = {
    Graphics: {
      bg: "hsl(209 65% 21% / 0.08)",
      text: "hsl(209 65% 28%)",
      border: "hsl(209 65% 21% / 0.2)",
    },
    Description: {
      bg: "hsl(154 80% 94%)",
      text: "hsl(154 60% 28%)",
      border: "hsl(154 60% 82%)",
    },
    Participants: {
      bg: "hsl(45 100% 94%)",
      text: "hsl(45 80% 30%)",
      border: "hsl(45 80% 82%)",
    },
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-6 animate-fade-up">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Tasks Under Review</h1>
          <p className="page-description">
            {selectedEventId
              ? `Showing tasks for: ${events.find((e) => e.id === selectedEventId)?.name}`
              : `${tasks.length} task${tasks.length !== 1 ? "s" : ""} awaiting review`}
          </p>
        </div>

        {/* Event filter */}
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2 shrink-0"
          style={{
            border: "1px solid hsl(209 65% 21% / 0.15)",
            background: "hsl(209 65% 21% / 0.04)",
            minWidth: "220px",
          }}
        >
          <Filter className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(209 65% 38%)" }} />
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="flex-1 bg-transparent text-sm font-medium text-foreground focus:outline-none cursor-pointer"
            style={{ color: selectedEventId ? "hsl(209 65% 21%)" : "hsl(213 15% 55%)" }}
          >
            <option value="">All Events</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table card */}
      <Card className="card-elevated">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" style={{ color: "hsl(209 65% 38%)" }} />
            <CardTitle className="text-base">Pending Tasks</CardTitle>
          </div>
          <CardDescription>Click a row to review and update the status</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <span
                className="h-5 w-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{
                  borderColor: "hsl(209 65% 21% / 0.2)",
                  borderTopColor: "hsl(209 65% 21%)",
                }}
              />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center"
                style={{ background: "hsl(154 80% 94%)" }}
              >
                <ClipboardList className="h-6 w-6" style={{ color: "hsl(154 60% 28%)" }} />
              </div>
              <p className="text-sm font-medium text-foreground">All tasks reviewed!</p>
              <p className="text-xs text-muted-foreground">No tasks are currently under review</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "hsl(var(--border))" }}>
              {/* Column headers */}
              <div
                className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 px-6 py-3 text-xs font-semibold uppercase tracking-wide"
                style={{ color: "hsl(213 15% 55%)" }}
              >
                <span>Company</span>
                <span>Event</span>
                <span>Task</span>
                <span>Status</span>
                <span />
              </div>

              {tasks.map((task, i) => {
                const typeStyle = taskTypeColor[task.taskType];
                return (
                  <div
                    key={`${task.exhibitorId}-${task.taskType}-${i}`}
                    className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center cursor-pointer group"
                    style={{
                      transition: "background-color 120ms cubic-bezier(0.23,1,0.32,1)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "hsl(209 65% 21% / 0.04)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "";
                    }}
                    onClick={() =>
                      router.push(`/admin/exhibitors/${task.exhibitorId}`)
                    }
                  >
                    {/* Company */}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{task.companyName}</p>
                      <p className="text-xs text-muted-foreground truncate">{task.email}</p>
                    </div>

                    {/* Event */}
                    <p className="text-sm text-muted-foreground truncate">{task.eventName}</p>

                    {/* Task type badge */}
                    <span
                      className="text-xs font-semibold rounded-full px-2.5 py-1 w-fit"
                      style={{
                        background: typeStyle.bg,
                        color: typeStyle.text,
                        border: `1px solid ${typeStyle.border}`,
                      }}
                    >
                      {task.taskType}
                    </span>

                    {/* Status */}
                    <StatusBadge status={task.status} />

                    {/* Arrow */}
                    <ArrowRight
                      className="h-4 w-4 opacity-0 group-hover:opacity-100"
                      style={{
                        color: "hsl(209 65% 38%)",
                        transition: "opacity 120ms cubic-bezier(0.23,1,0.32,1)",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
