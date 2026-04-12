"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  MapPin,
  Plus,
  ChevronRight,
  Users,
  X,
  Layers,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Sidebar } from "@/components/sidebar";

interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  status: string;
  exhibitor_count: number;
  completed_count: number;
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: "", start_date: "", venue_address: "",
  });

  useEffect(() => {
    async function fetchEvents() {
      try {
        const data = await apiFetch<Event[]>("/admin/events");
        setEvents(data);
      } catch {
        toast.error("Failed to load events");
      }
    }
    fetchEvents();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await apiFetch("/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEvent),
      });
      toast.success("Event created");
      setShowCreateForm(false);
      setNewEvent({ name: "", start_date: "", venue_address: "" });
      const data = await apiFetch<Event[]>("/admin/events");
      setEvents(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    } finally {
      setIsCreating(false);
    }
  };

  const progress = (completed: number, total: number) =>
    total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar userRole="admin" />
      <main className="flex-1 ml-64 overflow-auto">
        <div className="max-w-6xl mx-auto p-6 space-y-6 animate-fade-up">

          {/* ── Header ──────────────────────────────────────────── */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="page-title">Events</h1>
              <p className="page-description">
                {events.length} event{events.length !== 1 ? "s" : ""} ·{" "}
                {events.reduce((s, e) => s + e.exhibitor_count, 0)} total exhibitors
              </p>
            </div>
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="gap-2"
            >
              {showCreateForm ? (
                <>
                  <X className="h-4 w-4" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  New Event
                </>
              )}
            </Button>
          </div>

          {/* ── Create form ─────────────────────────────────────── */}
          {showCreateForm && (
            <Card
              className="card-elevated border-primary/20 animate-fade-up"
              style={{ borderColor: "hsl(209 65% 21% / 0.2)" }}
            >
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <div
                    className="h-7 w-7 rounded-lg flex items-center justify-center"
                    style={{ background: "hsl(209 65% 21% / 0.08)" }}
                  >
                    <Plus className="h-4 w-4" style={{ color: "hsl(209 65% 38%)" }} />
                  </div>
                  Create New Event
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateEvent} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Event Name *
                      </Label>
                      <Input
                        id="name"
                        value={newEvent.name}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, name: e.target.value })
                        }
                        placeholder="MRO Central Asia 2026"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="start_date" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Start Date *
                      </Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={newEvent.start_date}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, start_date: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="venue_address" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Venue *
                      </Label>
                      <Input
                        id="venue_address"
                        value={newEvent.venue_address}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, venue_address: e.target.value })
                        }
                        placeholder="Almaty, Kazakhstan"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="submit" disabled={isCreating} className="gap-2">
                      {isCreating ? (
                        <>
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Creating…
                        </>
                      ) : (
                        "Create Event"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ── Events grid ─────────────────────────────────────── */}
          {events.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event, i) => {
                const pct = progress(event.completed_count, event.exhibitor_count);
                return (
                  <Link key={event.id} href={`/admin/events/${event.id}`}>
                    <Card
                      className={[
                        "card-elevated card-hover h-full cursor-pointer group relative overflow-hidden",
                        `stagger-${Math.min(i + 1, 4)} animate-fade-up`,
                      ].join(" ")}
                    >
                      {/* Top accent line */}
                      <div
                        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
                        style={{
                          background:
                            pct === 100
                              ? "linear-gradient(90deg, hsl(154 100% 49%), hsl(170 80% 44%))"
                              : pct > 50
                              ? "hsl(209 65% 50%)"
                              : "hsl(209 65% 21% / 0.3)",
                        }}
                      />

                      <CardHeader className="pb-3 pt-5">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm font-semibold leading-tight line-clamp-2 flex-1">
                            {event.name}
                          </CardTitle>
                          <ChevronRight
                            className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        </div>
                        <div className="space-y-1 mt-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{event.location || "—"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>
                              {event.date
                                ? new Date(event.date).toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "TBA"}
                            </span>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <StatusBadge status={event.status} />
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {event.exhibitor_count}
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Completion</span>
                            <span
                              className="font-semibold"
                              style={{
                                color: pct === 100 ? "hsl(154 60% 35%)" : "hsl(209 65% 28%)",
                              }}
                            >
                              {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden bg-muted">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                background:
                                  pct === 100
                                    ? "linear-gradient(90deg, hsl(154 100% 49%), hsl(170 80% 44%))"
                                    : "hsl(209 65% 45%)",
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {event.completed_count} of {event.exhibitor_count} exhibitors complete
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card className="card-elevated">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                <div
                  className="h-16 w-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "hsl(209 65% 21% / 0.07)" }}
                >
                  <Layers className="h-8 w-8" style={{ color: "hsl(209 65% 38%)" }} />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">No events yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create your first exhibition event to get started
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(true)}
                  className="gap-2 mt-1"
                >
                  <Plus className="h-4 w-4" />
                  Create First Event
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
