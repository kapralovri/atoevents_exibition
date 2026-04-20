"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  Copy,
  Check,
  KeyRound,
  Settings,
  BarChart3,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  status: string;
  deadline_graphics: string;
  deadline_description: string;
  deadline_participants: string;
  alias_shell?: string;
  alias_system?: string;
  alias_bespoke?: string;
}

interface Exhibitor {
  id: string;
  company_name: string;
  email: string;
  booth_type: string;
  booth_config: string;
  booth_size: number;
  stand_inventory_id?: string;
  graphics_status: string;
  description_status: string;
  participants_status: string;
  overall_status: string;
}

interface InventoryItem {
  id: string;
  package: string;
  area_m2: number;
  configuration: string;
  total: number;
  booked: number;
  available: number;
  is_full: boolean;
  backdrop_url?: string | null;
}

const SELECT_CLASSES =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-[hsl(209_65%_21%)] focus:ring-offset-2";

const PKG_ALIAS: Record<string, string> = {
  SHELL_ONLY: "START",
  SYSTEM:     "PRO",
  BESPOKE:    "INDIVIDUAL",
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

interface StandRow {
  key: number;               // local unique key for React
  stand_inventory_id: string;
  is_custom: boolean;        // INDIVIDUAL custom size
  custom_config: string;
  custom_area: number;
}

export default function AdminEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copiedField, setCopiedField] = useState<"email" | "password" | null>(null);
  const [newExhibitor, setNewExhibitor] = useState({ company_name: "", email: "" });
  // Monotonic counter for row keys — avoids Date.now()/Math.random() collisions on rapid clicks
  const keyCounterRef = useRef(1);
  const nextKey = () => keyCounterRef.current++;
  const [standRows, setStandRows] = useState<StandRow[]>([
    { key: 0, stand_inventory_id: "", is_custom: false, custom_config: "LINEAR", custom_area: 9 },
  ]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [eventData, exhibitorsData, invData] = await Promise.all([
          apiFetch<Event>(`/admin/events/${eventId}`),
          apiFetch<Exhibitor[]>(`/admin/events/${eventId}/exhibitors`),
          apiFetch<InventoryItem[]>(`/admin/events/${eventId}/stand-availability`).catch(() => [] as InventoryItem[]),
        ]);
        setEvent(eventData);
        setExhibitors(exhibitorsData);
        setInventory(invData);
        // Pre-select first available slot in stand rows
        if (invData.length > 0) {
          setStandRows([{ key: nextKey(), stand_inventory_id: invData[0].id, is_custom: false, custom_config: "LINEAR", custom_area: 9 }]);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    }
    fetchData();
  }, [eventId]);

  const copyToClipboard = async (text: string, field: "email" | "password") => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Aliases from event (fall back to defaults)
  const pkgLabel = (pkg: string) => {
    if (event) {
      if (pkg === "SHELL_ONLY") return event.alias_shell || "START";
      if (pkg === "SYSTEM")     return event.alias_system || "PRO";
      if (pkg === "BESPOKE")    return event.alias_bespoke || "INDIVIDUAL";
    }
    return PKG_ALIAS[pkg] ?? pkg;
  };

  const handleRegisterExhibitor = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = standRows.filter(r => r.is_custom ? r.custom_area > 0 : r.stand_inventory_id);
    if (validRows.length === 0) {
      toast.error("Please configure at least one stand");
      return;
    }
    setIsRegistering(true);
    try {
      type RegResult = { exhibitor_id: number; user_id: number; temporary_password: string; overbooked?: boolean };

      // Fire all registrations in parallel; collect partial successes/failures
      const settled = await Promise.allSettled(
        validRows.map(row => {
          const payload = row.is_custom
            ? {
                event_id: parseInt(eventId),
                company_name: newExhibitor.company_name,
                email: newExhibitor.email,
                stand_package: "BESPOKE",
                stand_configuration: row.custom_config,
                area_m2: row.custom_area,
              }
            : {
                event_id: parseInt(eventId),
                company_name: newExhibitor.company_name,
                email: newExhibitor.email,
                stand_inventory_id: row.stand_inventory_id,
              };
          return apiFetch<RegResult>(
            `/admin/exhibitors`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
          );
        })
      );

      const succeeded: RegResult[] = [];
      const failed: { index: number; message: string }[] = [];
      settled.forEach((s, i) => {
        if (s.status === "fulfilled") succeeded.push(s.value);
        else failed.push({ index: i, message: s.reason instanceof Error ? s.reason.message : String(s.reason) });
      });

      const overbooked = succeeded.some(r => r.overbooked);

      // Reporting — distinguish all-ok / partial / all-failed
      if (succeeded.length === 0) {
        toast.error(`Registration failed: ${failed[0]?.message ?? "unknown error"}`);
      } else if (failed.length === 0) {
        toast.success(
          overbooked
            ? `${succeeded.length} stand(s) registered — some slots overbooked`
            : `${succeeded.length} stand(s) registered`
        );
      } else {
        toast.warning(
          `${succeeded.length}/${validRows.length} stand(s) registered · ${failed.length} failed: ${failed[0].message}`
        );
      }

      // Show credentials once, using the first successful result
      if (succeeded.length > 0) {
        setCredentials({ email: newExhibitor.email, password: succeeded[0].temporary_password });
      }

      if (failed.length === 0) {
        setShowRegisterForm(false);
        setNewExhibitor({ company_name: "", email: "" });
        setStandRows([{ key: nextKey(), stand_inventory_id: inventory[0]?.id ?? "", is_custom: false, custom_config: "LINEAR", custom_area: 9 }]);
      }

      const [data, invData] = await Promise.all([
        apiFetch<Exhibitor[]>(`/admin/events/${eventId}/exhibitors`),
        apiFetch<InventoryItem[]>(`/admin/events/${eventId}/stand-availability`).catch(() => [] as InventoryItem[]),
      ]);
      setExhibitors(data);
      setInventory(invData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to register exhibitor");
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
      <div className="flex h-full items-center justify-center">
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
      </div>
    );
  }

  const deadlines = [
    { label: "Graphics", key: event.deadline_graphics },
    { label: "Description", key: event.deadline_description },
    { label: "Participants", key: event.deadline_participants },
  ];

  // Group inventory by package for the select optgroups
  const inventoryByPackage = ["SHELL_ONLY", "SYSTEM", "BESPOKE"].reduce<Record<string, InventoryItem[]>>(
    (acc, pkg) => {
      const items = inventory.filter(i => i.package === pkg);
      if (items.length) acc[pkg] = items;
      return acc;
    },
    {}
  );

  return (
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
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => router.push(`/admin/events/${eventId}/settings`)}
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Button>
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
            <form onSubmit={handleRegisterExhibitor} className="space-y-5">
              {/* Company info row */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Company Name *
                  </Label>
                  <Input
                    value={newExhibitor.company_name}
                    onChange={(e) => setNewExhibitor({ ...newExhibitor, company_name: e.target.value })}
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
                    onChange={(e) => setNewExhibitor({ ...newExhibitor, email: e.target.value })}
                    placeholder="contact@company.com"
                    required
                  />
                </div>
              </div>

              {/* Stand rows */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Stand Configuration *
                </Label>

                {standRows.map((row, idx) => {
                  const selItem = inventory.find(i => i.id === row.stand_inventory_id);
                  return (
                    <div
                      key={row.key}
                      className="rounded-lg p-3 space-y-3"
                      style={{ background: "hsl(213 25% 97%)", border: "1px solid hsl(var(--border))" }}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="shrink-0 mt-2.5 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{ background: "hsl(209 65% 21% / 0.1)", color: "hsl(209 65% 28%)" }}
                        >
                          {idx + 1}
                        </span>

                        <div className="flex-1 space-y-2">
                          {/* Toggle between inventory select and custom */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                checked={!row.is_custom}
                                onChange={() => setStandRows(prev => prev.map(r => r.key === row.key ? { ...r, is_custom: false } : r))}
                              />
                              From inventory
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                checked={row.is_custom}
                                onChange={() => setStandRows(prev => prev.map(r => r.key === row.key ? { ...r, is_custom: true } : r))}
                              />
                              Custom INDIVIDUAL
                            </label>
                          </div>

                          {!row.is_custom ? (
                            <div>
                              {inventory.length === 0 ? (
                                <div className="flex h-10 w-full items-center rounded-lg border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                                  No inventory — configure in Settings
                                </div>
                              ) : (
                                <select
                                  value={row.stand_inventory_id}
                                  onChange={(e) => setStandRows(prev => prev.map(r => r.key === row.key ? { ...r, stand_inventory_id: e.target.value } : r))}
                                  className={SELECT_CLASSES}
                                  required={!row.is_custom}
                                >
                                  <option value="">— Select a stand —</option>
                                  {Object.entries(inventoryByPackage).map(([pkg, items]) => (
                                    <optgroup key={pkg} label={pkgLabel(pkg)}>
                                      {items.map(item => (
                                        <option key={item.id} value={item.id} disabled={item.is_full}>
                                          {pkgLabel(item.package)} {item.area_m2}m² {capitalize(item.configuration)}
                                          {" "}({item.available} available{item.is_full ? " — FULL" : ""})
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                              )}
                              {selItem?.is_full && (
                                <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-1"><span>⚠</span>Full — overbooking will be recorded</p>
                              )}
                              {selItem && !selItem.is_full && selItem.available <= 2 && (
                                <p className="text-[11px] text-amber-600 mt-1">Only {selItem.available} left</p>
                              )}
                            </div>
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Configuration</Label>
                                <select
                                  value={row.custom_config}
                                  onChange={(e) => setStandRows(prev => prev.map(r => r.key === row.key ? { ...r, custom_config: e.target.value } : r))}
                                  className={SELECT_CLASSES}
                                >
                                  {["LINEAR", "ANGULAR", "PENINSULA", "ISLAND"].map(c => (
                                    <option key={c} value={c}>{capitalize(c)}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Area (m²)</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  step={0.5}
                                  value={row.custom_area}
                                  onChange={(e) => setStandRows(prev => prev.map(r => r.key === row.key ? { ...r, custom_area: parseFloat(e.target.value) || 0 } : r))}
                                  placeholder="e.g. 24"
                                  required={row.is_custom}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {standRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setStandRows(prev => prev.filter(r => r.key !== row.key))}
                            className="shrink-0 mt-2 h-6 w-6 rounded-md flex items-center justify-center transition-colors"
                            style={{ color: "hsl(0 72% 55%)" }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "hsl(0 72% 51% / 0.08)")}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "")}
                            title="Remove this stand"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setStandRows(prev => [...prev, { key: nextKey(), stand_inventory_id: inventory[0]?.id ?? "", is_custom: false, custom_config: "LINEAR", custom_area: 9 }])}
                  className="flex items-center gap-1.5 text-xs font-medium transition-colors px-2 py-1.5 rounded-lg"
                  style={{ color: "hsl(209 65% 38%)" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "hsl(209 65% 21% / 0.07)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "")}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add another stand
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={isRegistering} className="gap-2">
                  {isRegistering ? (
                    <>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Registering…
                    </>
                  ) : standRows.length > 1 ? (
                    `Register ${standRows.length} stands`
                  ) : (
                    "Register"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowRegisterForm(false)}>
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

      {/* ── Inventory analytics bar ──────────────────────────── */}
      {inventory.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4" style={{ color: "hsl(209 65% 38%)" }} />
            <h2 className="text-sm font-semibold">Stand Availability</h2>
            <span className="text-xs text-muted-foreground">
              · {inventory.reduce((s, i) => s + i.booked, 0)} of{" "}
              {inventory.reduce((s, i) => s + i.total, 0)} total booked
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {inventory.map(item => {
              const pct = item.total > 0
                ? Math.min(100, Math.round((item.booked / item.total) * 100))
                : 0;
              const barColor = item.is_full
                ? "hsl(0 72% 51%)"
                : pct >= 80
                ? "hsl(45 96% 48%)"
                : "hsl(154 100% 38%)";

              return (
                <div
                  key={item.id}
                  className="card-elevated rounded-xl p-3 space-y-2"
                  style={{ border: item.is_full ? "1px solid hsl(0 72% 51% / 0.3)" : undefined }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs font-semibold leading-tight">
                      {pkgLabel(item.package)}
                      <br />
                      <span className="font-normal text-muted-foreground">
                        {item.area_m2}m² · {capitalize(item.configuration)}
                      </span>
                    </p>
                    {item.is_full && (
                      <span
                        className="shrink-0 text-[9px] font-bold uppercase rounded px-1 py-0.5"
                        style={{ background: "hsl(0 72% 51% / 0.1)", color: "hsl(0 72% 45%)" }}
                      >
                        Full
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(213 20% 88%)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {item.booked}/{item.total}
                    </span>
                    <span
                      className="text-[11px] font-semibold tabular-nums"
                      style={{ color: barColor }}
                    >
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                    {["Company", "Stand", "Graphics", "Description", "Participants", "Overall", ""].map(
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
                  {exhibitors.map((ex) => {
                    // Resolve stand label: prefer inventory item, fall back to flat fields
                    const invItem = ex.stand_inventory_id
                      ? inventory.find(i => i.id === ex.stand_inventory_id)
                      : null;
                    const standLabel = invItem
                      ? `${pkgLabel(invItem.package)} ${invItem.area_m2}m² ${capitalize(invItem.configuration)}`
                      : ex.booth_type
                      ? `${ex.booth_type.replace("_", " ")} ${ex.booth_size ?? ""}m²`
                      : "—";

                    return (
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
                          <p className="font-medium text-sm">{standLabel}</p>
                          {ex.stand_inventory_id && (
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              {ex.stand_inventory_id}
                            </p>
                          )}
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

      {/* ── Credentials modal ────────────────────────────────── */}
      {credentials && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "hsl(209 65% 10% / 0.6)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="w-full max-w-md rounded-2xl shadow-2xl animate-fade-up"
            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-5 rounded-t-2xl"
              style={{ background: "hsl(209 65% 21%)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center"
                  style={{ background: "hsl(154 100% 49% / 0.15)" }}
                >
                  <KeyRound className="h-5 w-5" style={{ color: "hsl(154 100% 49%)" }} />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">Exhibitor Access Created</p>
                  <p className="text-xs" style={{ color: "hsl(209 40% 75%)" }}>
                    Save these credentials — password won&apos;t be shown again
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCredentials(null)}
                className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "hsl(209 40% 70%)" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "hsl(209 65% 35%)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "")
                }
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Share these credentials with the exhibitor so they can log in at{" "}
                <span className="font-mono text-xs font-semibold text-foreground">
                  localhost:3000/login
                </span>
              </p>

              {/* Email row */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Email
                </p>
                <div
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
                  style={{ background: "hsl(213 25% 96%)", border: "1px solid hsl(var(--border))" }}
                >
                  <span className="font-mono text-sm truncate">{credentials.email}</span>
                  <button
                    onClick={() => copyToClipboard(credentials.email, "email")}
                    className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center transition-colors"
                    style={{ color: "hsl(209 65% 38%)" }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = "hsl(209 65% 21% / 0.08)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = "")
                    }
                    title="Copy email"
                  >
                    {copiedField === "email" ? (
                      <Check className="h-3.5 w-3.5" style={{ color: "hsl(154 60% 35%)" }} />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Password row */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Temporary Password
                </p>
                <div
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
                  style={{ background: "hsl(154 100% 49% / 0.06)", border: "1px solid hsl(154 100% 49% / 0.2)" }}
                >
                  <span className="font-mono text-sm font-semibold tracking-wider">
                    {credentials.password}
                  </span>
                  <button
                    onClick={() => copyToClipboard(credentials.password, "password")}
                    className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center transition-colors"
                    style={{ color: "hsl(154 60% 35%)" }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = "hsl(154 100% 49% / 0.1)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = "")
                    }
                    title="Copy password"
                  >
                    {copiedField === "password" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Warning */}
              <div
                className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs"
                style={{
                  background: "hsl(45 96% 50% / 0.08)",
                  border: "1px solid hsl(45 96% 50% / 0.25)",
                  color: "hsl(35 80% 35%)",
                }}
              >
                <span className="shrink-0 mt-0.5">⚠</span>
                <span>
                  The exhibitor should change their password after first login.
                  This dialog will not show the password again once closed.
                </span>
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-6 py-4 flex justify-end rounded-b-2xl"
              style={{ borderTop: "1px solid hsl(var(--border))" }}
            >
              <Button onClick={() => setCredentials(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
