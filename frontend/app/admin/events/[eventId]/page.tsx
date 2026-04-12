"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  ArrowLeft,
  Download,
  Plus,
  Unlock,
  X,
  Building2,
  ChevronRight,
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
  deadline_graphics: string;
  deadline_description: string;
  deadline_participants: string;
}

interface Exhibitor {
  id: string;
  company_name: string;
  email: string;
  booth_type: string;
  booth_config: string;
  booth_size: number;
  graphics_status: string;
  description_status: string;
  participants_status: string;
  overall_status: string;
}

const SELECT_CLASSES =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-[hsl(209_65%_21%)] focus:ring-offset-2";

export default function AdminEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [newExhibitor, setNewExhibitor] = useState({
    company_name: "",
    email: "",
    booth_type: "shell_only",
    booth_config: "linear",
    booth_size: 9,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const eventData = await apiFetch<Event>(`/admin/events/${eventId}`);
        setEvent(eventData);
        const exhibitorsData = await apiFetch<Exhibitor[]>(
          `/admin/events/${eventId}/exhibitors`
        );
        setExhibitors(exhibitorsData);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    }
    fetchData();
  }, [eventId]);

  const handleRegisterExhibitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    try {
      await apiFetch(`/admin/events/${eventId}/exhibitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newExhibitor),
      });
      toast.success("Exhibitor registered successfully");
      setShowRegisterForm(false);
      setNewExhibitor({
        company_name: "",
        email: "",
        booth_type: "shell_only",
        booth_config: "linear",
        booth_size: 9,
      });
      const data = await apiFetch<Exhibitor[]>(
        `/admin/events/${eventId}/exhibitors`
      );
      setExhibitors(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to register exhibitor"
      );
    } finally {
      setIsRegistering(false);
    }
  };

  const handleUnlockExhibitor = async (exhibitorId: string) => {
    try {
      await apiFetch(`/admin/exhibitors/${exhibitorId}/unlock`, {
        method: "POST",
      });
      toast.success("Exhibitor unlocked");
      const data = await apiFetch<Exhibitor[]>(
        `/admin/events/${eventId}/exhibitors`
      );
      setExhibitors(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unlock");
    }
  };

  const handleExportParticipants = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/events/${eventId}/export/participants`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `participants-${event?.name}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Participants exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  };

  const getDeadlineInfo = (deadline: string) => {
    if (!deadline) return { label: "Not set", color: "hsl(213 15% 55%)", urgent: false };
    const diff = new Date(deadline).getTime() - Date.now();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: "Expired", color: "hsl(0 72% 51%)", urgent: true };
    if (days < 3) return { label: `${days}d left`, color: "hsl(45 96% 35%)", urgent: true };
    return { label: `${days} days`, color: "hsl(154 60% 35%)", urgent: false };
  };

  if (!event) {
    return (
      <div className="flex h-screen" style={{ background: "hsl(213 25% 97%)" }}>
        <Sidebar userRole="admin" />
        <main className="flex-1 ml-64 overflow-auto flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center font-black animate-pulse text-sm"
              style={{ background: "hsl(209 65% 21%)", color: "hsl(154 100% 49%)" }}
            >
              A
            </div>
            <span
              className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "hsl(209 65% 21% / 0.2)", borderTopColor: "hsl(209 65% 21%)" }}
            />
          </div>
        </main>
      </div>
    );
  }

  const deadlines = [
    { label: "Graphics", key: event.deadline_graphics },
    { label: "Description", key: event.deadline_description },
    { label: "Participants", key: event.deadline_participants },
  ];

  return (
    <div className="flex h-screen" style={{ background: "hsl(213 25% 97%)" }}>
      <Sidebar userRole="admin" />
      <main className="flex-1 ml-64 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-6 animate-fade-up">

          {/* ── Header ───────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                onClick={() => router.back()}
                className="mt-1 h-8 w-8 rounded-lg flex items-center justify-center transition-colors shrink-0"
                style={{ color: "hsl(213 15% 55%)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "hsl(209 65% 21% / 0.08)";
                  (e.currentTarget as HTMLElement).style.color = "hsl(209 65% 28%)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "";
                  (e.currentTarget as HTMLElement).style.color = "";
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h1 className="page-title">{event.name}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  {event.location && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {event.location}
                    </span>
                  )}
                  {event.date && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(event.date).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {exhibitors.length} exhibitors
                  </span>
                  <StatusBadge status={event.status} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleExportParticipants} className="gap-2">
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => setShowRegisterForm(!showRegisterForm)}
              >
                {showRegisterForm ? (
                  <><X className="h-3.5 w-3.5" />Cancel</>
                ) : (
                  <><Plus className="h-3.5 w-3.5" />Register Exhibitor</>
                )}
              </Button>
            </div>
          </div>

          {/* ── Register form ────────────────────────────────────── */}
          {showRegisterForm && (
            <Card
              className="card-elevated animate-fade-up"
              style={{ borderColor: "hsl(209 65% 21% / 0.2)" }}
            >
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <div
                    className="h-7 w-7 rounded-lg flex items-center justify-center"
                    style={{ background: "hsl(209 65% 21% / 0.08)" }}
                  >
                    <Building2 className="h-4 w-4" style={{ color: "hsl(209 65% 38%)" }} />
                  </div>
                  Register New Exhibitor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegisterExhibitor} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Company Name *
                      </Label>
                      <Input
                        value={newExhibitor.company_name}
                        onChange={(e) =>
                          setNewExhibitor({ ...newExhibitor, company_name: e.target.value })
                        }
                        placeholder="Acme Aviation Ltd"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Email *
                      </Label>
                      <Input
                        type="email"
                        value={newExhibitor.email}
                        onChange={(e) =>
                          setNewExhibitor({ ...newExhibitor, email: e.target.value })
                        }
                        placeholder="contact@company.com"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Booth Type *
                      </Label>
                      <select
                        value={newExhibitor.booth_type}
                        onChange={(e) =>
                          setNewExhibitor({ ...newExhibitor, booth_type: e.target.value })
                        }
                        className={SELECT_CLASSES}
                      >
                        <option value="shell_only">Shell Only</option>
                        <option value="system">System</option>
                        <option value="bespoke">Bespoke</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Configuration
                      </Label>
                      <select
                        value={newExhibitor.booth_config}
                        onChange={(e) =>
                          setNewExhibitor({ ...newExhibitor, booth_config: e.target.value })
                        }
                        className={SELECT_CLASSES}
                      >
                        <option value="linear">Linear</option>
                        <option value="corner">Corner</option>
                        <option value="peninsula">Peninsula</option>
                        <option value="island">Island</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Size (m²) *
                      </Label>
                      <Input
                        type="number"
                        min={4}
                        value={newExhibitor.booth_size}
                        onChange={(e) =>
                          setNewExhibitor({
                            ...newExhibitor,
                            booth_size: parseInt(e.target.value) || 9,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="submit" disabled={isRegistering} className="gap-2">
                      {isRegistering ? (
                        <>
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Registering…
                        </>
                      ) : (
                        "Register"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowRegisterForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ── Deadline KPIs ────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-3">
            {deadlines.map(({ label, key }) => {
              const info = getDeadlineInfo(key);
              return (
                <Card key={label} className="card-elevated relative overflow-hidden">
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
                    style={{
                      background: info.urgent
                        ? "hsl(0 72% 51%)"
                        : key
                        ? "linear-gradient(90deg, hsl(154 100% 49%), hsl(170 80% 44%))"
                        : "hsl(213 20% 85%)",
                    }}
                  />
                  <CardHeader className="pb-1 pt-5">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {label} Deadline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p
                      className="text-2xl font-bold tabular-nums"
                      style={{ color: info.color }}
                    >
                      {info.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {key
                        ? new Date(key).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ── Exhibitors table ─────────────────────────────────── */}
          <Card className="card-elevated">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" style={{ color: "hsl(209 65% 38%)" }} />
                  Exhibitors
                </CardTitle>
                <span
                  className="text-xs font-semibold rounded-full px-2.5 py-1"
                  style={{
                    background: "hsl(209 65% 21% / 0.07)",
                    color: "hsl(209 65% 28%)",
                  }}
                >
                  {exhibitors.length} registered
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {exhibitors.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                        {["Company", "Booth", "Graphics", "Description", "Participants", "Overall", ""].map(
                          (h) => (
                            <th
                              key={h}
                              className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {exhibitors.map((ex) => (
                        <tr
                          key={ex.id}
                          className="transition-colors"
                          style={{ borderBottom: "1px solid hsl(var(--border))" }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background =
                              "hsl(209 65% 21% / 0.03)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "";
                          }}
                        >
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/exhibitors/${ex.id}`}
                              className="group flex items-center gap-1.5 font-semibold text-foreground hover:text-[hsl(209_65%_28%)] transition-colors"
                            >
                              {ex.company_name}
                              <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                            <p className="text-xs text-muted-foreground mt-0.5">{ex.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium capitalize">
                              {ex.booth_type.replace("_", " ")}
                            </p>
                            <p className="text-xs text-muted-foreground">{ex.booth_size} m²</p>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={ex.graphics_status} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={ex.description_status} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={ex.participants_status} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={ex.overall_status} />
                          </td>
                          <td className="px-4 py-3">
                            {ex.overall_status === "locked" && (
                              <button
                                onClick={() => handleUnlockExhibitor(ex.id)}
                                className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
                                style={{ color: "hsl(213 15% 60%)" }}
                                onMouseEnter={(e) => {
                                  (e.currentTarget as HTMLElement).style.background =
                                    "hsl(154 100% 49% / 0.1)";
                                  (e.currentTarget as HTMLElement).style.color =
                                    "hsl(154 60% 35%)";
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as HTMLElement).style.background = "";
                                  (e.currentTarget as HTMLElement).style.color = "";
                                }}
                                title="Unlock exhibitor"
                              >
                                <Unlock className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center"
                    style={{ background: "hsl(209 65% 21% / 0.07)" }}
                  >
                    <Building2 className="h-7 w-7" style={{ color: "hsl(209 65% 38%)" }} />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">No exhibitors yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Register the first exhibitor to get started
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 mt-1"
                    onClick={() => setShowRegisterForm(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Register Exhibitor
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
