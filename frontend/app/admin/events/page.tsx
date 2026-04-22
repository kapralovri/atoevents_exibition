"use client";

import { useEffect, useRef, useState } from "react";
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
  Plus,
  ChevronRight,
  ChevronDown,
  Users,
  X,
  Layers,
  Globe,
  Clock,
  FileText,
  Settings,
  Search,
  ArrowUpDown,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

interface Event {
  id: string;
  name: string;
  date: string;
  end_date?: string | null;
  location: string;
  website_url?: string;
  status: string;
  exhibitor_count: number;
  completed_count: number;
  deadline_graphics_initial?: string | null;
  deadline_company_profile?: string | null;
  deadline_participants?: string | null;
  deadline_final_graphics?: string | null;
}

interface NewEventForm {
  // Section 1 — Metadata
  name: string;
  start_date: string;
  end_date: string;
  venue_address: string;
  website_url: string;
  // Section 2 — Deadlines
  deadline_graphics_initial: string;
  deadline_company_profile: string;
  deadline_participants: string;
  deadline_final_graphics: string;
}

type FieldErrors = Partial<Record<keyof NewEventForm | string, string>>;

// ── Constants ─────────────────────────────────────────────────────────────────

const DEADLINE_OFFSETS: Record<string, number> = {
  deadline_graphics_initial: 90,
  deadline_company_profile: 60,
  deadline_participants: 30,
  deadline_final_graphics: 14,
};

const DEADLINE_LABELS: Record<string, string> = {
  deadline_graphics_initial: "Initial Graphics",
  deadline_company_profile: "Company Profile",
  deadline_participants: "Participants List",
  deadline_final_graphics: "Final Graphics",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(isoDate: string, offset: number): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function validateUrl(v: string): boolean {
  if (!v) return true;
  return /^https?:\/\/.+/.test(v);
}

function blankForm(): NewEventForm {
  return {
    name: "",
    start_date: "",
    end_date: "",
    venue_address: "",
    website_url: "",
    deadline_graphics_initial: "",
    deadline_company_profile: "",
    deadline_participants: "",
    deadline_final_graphics: "",
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  open,
  onToggle,
}: {
  icon: React.ElementType;
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-3 py-2.5 px-1 rounded-lg transition-colors"
      style={{ color: "hsl(209 65% 21%)" }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.background = "hsl(209 65% 21% / 0.04)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.background = "")
      }
    >
      <span className="flex items-center gap-2 font-semibold text-sm">
        <Icon className="h-4 w-4" />
        {title}
      </span>
      <ChevronDown
        className="h-4 w-4 transition-transform duration-200 text-muted-foreground"
        style={{ transform: open ? "rotate(180deg)" : "" }}
      />
    </button>
  );
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
    >
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </Label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

// ── Progress helper ───────────────────────────────────────────────────────────

function pct(completed: number, total: number) {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

// ── Event thumbnail (deterministic gradient + initials from name) ─────────────

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function eventInitials(name: string): string {
  return (
    name
      .replace(/[^A-Za-zА-Яа-я0-9 ]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "EV"
  );
}

const THUMB_PALETTES: Array<{ from: string; to: string; fg: string }> = [
  { from: "hsl(192 80% 18%)", to: "hsl(162 55% 30%)", fg: "hsl(154 85% 70%)" }, // teal→mint
  { from: "hsl(0 0% 12%)",     to: "hsl(348 55% 28%)", fg: "hsl(348 95% 68%)" }, // charcoal→pink
  { from: "hsl(214 50% 22%)",  to: "hsl(200 45% 35%)", fg: "hsl(165 75% 75%)" }, // navy→cyan
  { from: "hsl(260 35% 22%)",  to: "hsl(280 40% 40%)", fg: "hsl(265 90% 82%)" }, // violet
  { from: "hsl(25 55% 22%)",   to: "hsl(15 60% 38%)",  fg: "hsl(35 100% 75%)" }, // amber
];

// ── Deadline helper ───────────────────────────────────────────────────────────

const DEADLINE_FIELDS: Array<{ key: keyof Event; label: string }> = [
  { key: "deadline_final_graphics",   label: "Final graphics" },
  { key: "deadline_participants",     label: "Participants" },
  { key: "deadline_company_profile",  label: "Company profile" },
  { key: "deadline_graphics_initial", label: "Initial graphics" },
];

function nextUpcomingDeadline(ev: Event): { label: string; date: string; daysLeft: number } | null {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const nowTs = now.getTime();

  const future: Array<{ label: string; date: string; daysLeft: number }> = [];
  const overdue: Array<{ label: string; date: string; daysLeft: number }> = [];
  for (const f of DEADLINE_FIELDS) {
    const v = ev[f.key] as string | null | undefined;
    if (!v) continue;
    const d = new Date(v);
    if (isNaN(d.getTime())) continue;
    const daysLeft = Math.round((d.getTime() - nowTs) / (24 * 3600 * 1000));
    const row = { label: f.label, date: v, daysLeft };
    if (daysLeft < 0) overdue.push(row);
    else future.push(row);
  }
  if (overdue.length) {
    // Worst overdue first
    overdue.sort((a, b) => a.daysLeft - b.daysLeft);
    return overdue[0];
  }
  if (future.length) {
    future.sort((a, b) => a.daysLeft - b.daysLeft);
    return future[0];
  }
  return null;
}

// ── Pagination helpers ────────────────────────────────────────────────────────

function pageNumbers(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | "…"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

function PagerBtn({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-md text-[11px] font-semibold active:scale-95"
      style={{
        width: 26,
        height: 26,
        background: active ? "hsl(154 70% 36%)" : "transparent",
        color: active ? "#fff" : disabled ? "hsl(210 10% 70%)" : "hsl(209 50% 22%)",
        border: active ? "1px solid hsl(154 70% 36%)" : "1px solid hsl(210 18% 88%)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background-color 120ms, color 120ms, transform 100ms",
      }}
    >
      {children}
    </button>
  );
}

// ── Filter dropdown ───────────────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  options,
  onPick,
  highlighted,
}: {
  label: string;
  value: string;
  options: Array<{ key: string; label: string }>;
  onPick: (key: string) => void;
  highlighted?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1.5 active:scale-95"
        style={{
          background: highlighted ? "hsl(154 80% 94%)" : "#FFFFFF",
          color: highlighted ? "hsl(154 70% 28%)" : "hsl(210 10% 38%)",
          border: highlighted ? "1px solid hsl(154 60% 72%)" : "1px solid hsl(210 18% 88%)",
          transition: "background-color 120ms, color 120ms, border-color 120ms, transform 100ms",
        }}
      >
        {label}: {value}
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+4px)] z-30 min-w-[160px] py-1 rounded-lg animate-fade-up"
          style={{
            background: "#FFFFFF",
            border: "1px solid hsl(210 18% 88%)",
            boxShadow: "0 8px 24px -12px hsl(209 30% 20% / 0.18)",
          }}
        >
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                onPick(o.key);
                setOpen(false);
              }}
              className="block w-full text-left text-xs font-medium px-3 py-1.5"
              style={{
                color: o.label === value || o.key === value ? "hsl(154 70% 28%)" : "hsl(209 50% 22%)",
                background: "transparent",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "hsl(210 20% 96%)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "transparent")
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EventThumb({
  name,
  website,
  size = 40,
}: {
  name: string;
  website?: string;
  size?: number;
}) {
  // When a website URL is present, derive palette from the site host so all
  // events on the same domain share stylistics (proxy for brand). Later this
  // will be replaced by real colours extracted from the site on the backend.
  let host = "";
  try {
    if (website) host = new URL(website).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }
  const paletteKey = host || name;
  const palette = THUMB_PALETTES[hashString(paletteKey) % THUMB_PALETTES.length];
  const initials = eventInitials(name);
  return (
    <div
      className="relative rounded-lg shrink-0 overflow-hidden flex items-center justify-center"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`,
        border: "1px solid hsl(210 18% 88%)",
      }}
      aria-hidden="true"
    >
      <span
        style={{
          color: palette.fg,
          fontFamily: "Manrope, Inter, system-ui, sans-serif",
          fontWeight: 900,
          fontSize: size * 0.34,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {initials}
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(135deg, transparent 40%, rgba(0,0,0,0.18) 100%)" }}
      />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<NewEventForm>(blankForm());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isCreating, setIsCreating] = useState(false);

  // Section open/closed state
  const [openSections, setOpenSections] = useState({
    metadata: true,
    deadlines: true,
  });

  // ── Filters ─────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "upcoming" | "past" | "draft">("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;


  // Load events on mount
  useEffect(() => {
    loadEvents();
  }, []);

  // Auto-recalc deadlines when start_date changes
  useEffect(() => {
    if (!form.start_date) return;
    setForm((prev) => ({
      ...prev,
      deadline_graphics_initial: addDays(prev.start_date, 90),
      deadline_company_profile: addDays(prev.start_date, 60),
      deadline_participants: addDays(prev.start_date, 30),
      deadline_final_graphics: addDays(prev.start_date, 14),
    }));
  }, [form.start_date]);

  async function loadEvents() {
    try {
      const data = await apiFetch<Event[]>("/admin/events");
      setEvents(data);
    } catch {
      toast.error("Failed to load events");
    }
  }

  function toggleSection(key: keyof typeof openSections) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!form.name || form.name.trim().length < 3)
      e.name = "Minimum 3 characters";
    if (!form.start_date)
      e.start_date = "Required";
    else if (form.start_date < todayIso())
      e.start_date = "Date cannot be in the past";
    if (form.end_date && form.end_date <= form.start_date)
      e.end_date = "Must be after start date";
    if (!form.venue_address || form.venue_address.trim().length < 2)
      e.venue_address = "Required";
    if (!validateUrl(form.website_url))
      e.website_url = "Must start with http:// or https://";

    // Deadlines must be before start_date
    Object.keys(DEADLINE_OFFSETS).forEach((key) => {
      const val = (form as unknown as Record<string, string>)[key];
      if (val && val >= form.start_date)
        e[key] = "Deadline must be before start date";
    });

    return e;
  }

  // ── Phase 1: Create event ───────────────────────────────────────────────────

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error("Please fix the errors in the form");
      return;
    }
    setErrors({});
    setIsCreating(true);

    const body = {
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date || null,
      venue_address: form.venue_address.trim(),
      website_url: form.website_url.trim() || null,
      deadline_graphics_initial: form.deadline_graphics_initial || null,
      deadline_company_profile: form.deadline_company_profile || null,
      deadline_participants: form.deadline_participants || null,
      deadline_final_graphics: form.deadline_final_graphics || null,
    };

    try {
      const created = await apiFetch<{ id: string }>("/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const newId = String(created.id);
      toast.success("Event created — configure stand inventory in Settings");
      setShowCreateForm(false);
      setForm(blankForm());
      setErrors({});
      await loadEvents();
      router.push(`/admin/events/${newId}/settings`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setIsCreating(false);
    }
  }

  function handleCancelCreate() {
    setShowCreateForm(false);
    setForm(blankForm());
    setErrors({});
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 animate-fade-up">

          {/* ── Header ────────────────────────────────────────────── */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="page-title">Events</h1>
              <p className="page-description">
                {events.length} event{events.length !== 1 ? "s" : ""} ·{" "}
                {events.reduce((s, e) => s + e.exhibitor_count, 0)} total exhibitors
              </p>
            </div>
            <Button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                if (showCreateForm) handleCancelCreate();
              }}
              className="gap-2"
            >
              {showCreateForm ? (
                <><X className="h-4 w-4" />Cancel</>
              ) : (
                <><Plus className="h-4 w-4" />New Event</>
              )}
            </Button>
          </div>

          {/* ── Create form ───────────────────────────────────────── */}
          {showCreateForm && (
            <Card
              className="card-elevated animate-fade-up"
              style={{ borderColor: "hsl(209 65% 21% / 0.2)" }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <div
                    className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "hsl(209 65% 21% / 0.08)" }}
                  >
                    <Plus className="h-4 w-4" style={{ color: "hsl(209 65% 38%)" }} />
                  </div>
                  Create Event
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <form onSubmit={handleCreateEvent} className="space-y-2">

                    {/* ── Section 1: Metadata ── */}
                    <div
                      className="rounded-xl overflow-hidden"
                      style={{ border: "1px solid hsl(209 65% 21% / 0.1)" }}
                    >
                      <div className="px-4 pt-3 pb-1">
                        <SectionHeader
                          icon={FileText}
                          title="1. Basic Details"
                          open={openSections.metadata}
                          onToggle={() => toggleSection("metadata")}
                        />
                      </div>
                      {openSections.metadata && (
                        <div
                          className="px-4 pb-4 pt-2 space-y-4"
                          style={{ background: "hsl(209 65% 21% / 0.015)" }}
                        >
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2 space-y-1.5">
                              <FieldLabel htmlFor="name" required>
                                Event Name
                              </FieldLabel>
                              <Input
                                id="name"
                                value={form.name}
                                onChange={(e) =>
                                  setForm({ ...form, name: e.target.value })
                                }
                                placeholder="MRO Central Asia 2026"
                                className={errors.name ? "border-red-400" : ""}
                              />
                              <FieldError msg={errors.name} />
                            </div>
                            <div className="space-y-1.5">
                              <FieldLabel htmlFor="start_date" required>
                                Start Date
                              </FieldLabel>
                              <Input
                                id="start_date"
                                type="date"
                                value={form.start_date}
                                onChange={(e) =>
                                  setForm({ ...form, start_date: e.target.value })
                                }
                                className={errors.start_date ? "border-red-400" : ""}
                              />
                              <FieldError msg={errors.start_date} />
                            </div>
                            <div className="space-y-1.5">
                              <FieldLabel htmlFor="end_date">
                                End Date
                              </FieldLabel>
                              <Input
                                id="end_date"
                                type="date"
                                value={form.end_date}
                                onChange={(e) =>
                                  setForm({ ...form, end_date: e.target.value })
                                }
                                className={errors.end_date ? "border-red-400" : ""}
                              />
                              <FieldError msg={errors.end_date} />
                            </div>
                            <div className="space-y-1.5">
                              <FieldLabel htmlFor="venue_address" required>
                                Venue / Address
                              </FieldLabel>
                              <Input
                                id="venue_address"
                                value={form.venue_address}
                                onChange={(e) =>
                                  setForm({ ...form, venue_address: e.target.value })
                                }
                                placeholder="Almaty, Kazakhstan"
                                className={errors.venue_address ? "border-red-400" : ""}
                              />
                              <FieldError msg={errors.venue_address} />
                            </div>
                            <div className="space-y-1.5">
                              <FieldLabel htmlFor="website_url">
                                Event Website
                              </FieldLabel>
                              <Input
                                id="website_url"
                                type="url"
                                value={form.website_url}
                                onChange={(e) =>
                                  setForm({ ...form, website_url: e.target.value })
                                }
                                placeholder="https://example.com"
                                className={errors.website_url ? "border-red-400" : ""}
                              />
                              <FieldError msg={errors.website_url} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Section 2: Deadlines ── */}
                    <div
                      className="rounded-xl overflow-hidden"
                      style={{ border: "1px solid hsl(209 65% 21% / 0.1)" }}
                    >
                      <div className="px-4 pt-3 pb-1">
                        <SectionHeader
                          icon={Clock}
                          title="2. Deadlines"
                          open={openSections.deadlines}
                          onToggle={() => toggleSection("deadlines")}
                        />
                      </div>
                      {openSections.deadlines && (
                        <div
                          className="px-4 pb-4 pt-2 space-y-3"
                          style={{ background: "hsl(209 65% 21% / 0.015)" }}
                        >
                          <p className="text-xs text-muted-foreground">
                            Auto-calculated from start date. You can edit them manually.
                          </p>
                          <div className="grid gap-4 sm:grid-cols-2">
                            {(Object.keys(DEADLINE_OFFSETS) as Array<keyof typeof DEADLINE_OFFSETS>).map(
                              (key) => (
                                <div key={key} className="space-y-1.5">
                                  <FieldLabel htmlFor={key}>
                                    {DEADLINE_LABELS[key]}
                                    <span className="ml-1.5 text-muted-foreground/60 normal-case font-normal">
                                      (−{DEADLINE_OFFSETS[key]}d)
                                    </span>
                                  </FieldLabel>
                                  <Input
                                    id={key}
                                    type="date"
                                    value={(form as unknown as Record<string, string>)[key]}
                                    onChange={(e) =>
                                      setForm({ ...form, [key]: e.target.value })
                                    }
                                    className={errors[key] ? "border-red-400" : ""}
                                  />
                                  <FieldError msg={errors[key]} />
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Note about stand inventory ── */}
                    <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-xs"
                      style={{ background: "hsl(209 65% 21% / 0.05)", border: "1px solid hsl(209 65% 21% / 0.12)", color: "hsl(209 50% 35%)" }}>
                      <Layers className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "hsl(209 65% 38%)" }} />
                      <span>
                        Stand inventory (types, configurations, areas) and backdrop images are configured in{" "}
                        <strong>Event Settings</strong> after creation.
                      </span>
                    </div>

                    {/* ── Submit ── */}
                    <div className="flex gap-2 pt-2">
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
                      <Button type="button" variant="outline" onClick={handleCancelCreate}>
                        Cancel
                      </Button>
                    </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ── Filter bar ─────────────────────────────────────────── */}
          {events.length > 0 && (() => {
            // Derive year options from loaded events
            const years = Array.from(
              new Set(
                events
                  .map((e) => (e.date ? new Date(e.date).getFullYear() : null))
                  .filter((y): y is number => y !== null)
              )
            ).sort((a, b) => b - a);

            const statusLabel =
              statusFilter === "all" ? "All" : statusFilter[0].toUpperCase() + statusFilter.slice(1);
            const yearLabel = yearFilter === "all" ? "Any" : yearFilter;

            return (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[260px] max-w-[420px]">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                    style={{ color: "hsl(210 10% 55%)" }}
                  />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search by name, city, venue…"
                    className="pl-9 bg-white"
                  />
                </div>

                <FilterSelect
                  label="Status"
                  value={statusLabel}
                  highlighted={statusFilter !== "all"}
                  options={[
                    { key: "all",      label: "All statuses" },
                    { key: "active",   label: "Active" },
                    { key: "upcoming", label: "Upcoming" },
                    { key: "past",     label: "Past" },
                    { key: "draft",    label: "Draft" },
                  ]}
                  onPick={(k) => {
                    setStatusFilter(k as typeof statusFilter);
                    setPage(1);
                  }}
                />

                <FilterSelect
                  label="Year"
                  value={yearLabel}
                  highlighted={yearFilter !== "all"}
                  options={[
                    { key: "all", label: "Any year" },
                    ...years.map((y) => ({ key: String(y), label: String(y) })),
                  ]}
                  onPick={(k) => {
                    setYearFilter(k);
                    setPage(1);
                  }}
                />

                <div className="flex-1" />

                <button
                  type="button"
                  onClick={() => setSortDesc((v) => !v)}
                  className="text-xs font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1.5 active:scale-95"
                  style={{
                    background: "#FFFFFF",
                    color: "hsl(210 10% 38%)",
                    border: "1px solid hsl(210 18% 88%)",
                  }}
                  title="Toggle sort order"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  Date {sortDesc ? "↓" : "↑"}
                </button>
              </div>
            );
          })()}

          {/* ── Events table ──────────────────────────────────────── */}
          {(() => {
            const q = search.trim().toLowerCase();
            const filtered = events
              .filter((ev) => {
                if (statusFilter !== "all" && (ev.status || "").toLowerCase() !== statusFilter) {
                  return false;
                }
                if (yearFilter !== "all") {
                  const y = ev.date ? String(new Date(ev.date).getFullYear()) : "";
                  if (y !== yearFilter) return false;
                }
                if (!q) return true;
                return (
                  ev.name.toLowerCase().includes(q) ||
                  (ev.location || "").toLowerCase().includes(q)
                );
              })
              .sort((a, b) => {
                const da = new Date(a.date || 0).getTime();
                const db = new Date(b.date || 0).getTime();
                return sortDesc ? db - da : da - db;
              });

            const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
            const safePage = Math.min(page, totalPages);
            const pageStart = (safePage - 1) * PAGE_SIZE;
            const pageEnd = pageStart + PAGE_SIZE;
            const pageRows = filtered.slice(pageStart, pageEnd);

            if (events.length === 0) {
              return (
                <Card className="card-elevated">
                  <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                    <div
                      className="h-16 w-16 rounded-2xl flex items-center justify-center"
                      style={{ background: "hsl(154 80% 94%)" }}
                    >
                      <Layers className="h-8 w-8" style={{ color: "hsl(154 70% 34%)" }} />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-foreground">No events yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Create your first exhibition event to get started
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setShowCreateForm(true)} className="gap-2 mt-1">
                      <Plus className="h-4 w-4" />
                      Create First Event
                    </Button>
                  </CardContent>
                </Card>
              );
            }

            if (filtered.length === 0) {
              return (
                <Card className="card-elevated">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    No events match the current filters.
                  </CardContent>
                </Card>
              );
            }

            const gridCols =
              "minmax(0,1.7fr) minmax(0,1.1fr) 90px minmax(0,0.9fr) minmax(0,1fr) 110px 44px";

            return (
              <div
                className="rounded-xl overflow-hidden"
                style={{ background: "#FFFFFF", border: "1px solid hsl(210 18% 90%)" }}
              >
                {/* Table header */}
                <div
                  className="hidden md:grid items-center gap-4 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                  style={{
                    background: "hsl(210 20% 97%)",
                    color: "hsl(210 10% 48%)",
                    borderBottom: "1px solid hsl(210 18% 90%)",
                    gridTemplateColumns: gridCols,
                  }}
                >
                  <div>Event</div>
                  <div>Location / Dates</div>
                  <div>Exhibitors</div>
                  <div>Readiness</div>
                  <div>Deadline</div>
                  <div>Status</div>
                  <div></div>
                </div>

                {/* Rows */}
                {pageRows.map((event, i) => {
                  const progress = pct(event.completed_count, event.exhibitor_count);
                  const progressBg =
                    progress === 100
                      ? "hsl(154 70% 42%)"
                      : progress >= 50
                      ? "hsl(154 70% 42%)"
                      : progress >= 20
                      ? "hsl(45 85% 50%)"
                      : "hsl(210 14% 70%)";
                  const nextDeadline = nextUpcomingDeadline(event);
                  return (
                    <div
                      key={event.id}
                      className={[
                        "group relative grid items-center gap-4 px-4 py-3",
                        "grid-cols-1 md:grid",
                        `stagger-${Math.min(i + 1, 4)} animate-fade-up`,
                      ].join(" ")}
                      style={{
                        borderTop: i === 0 ? "none" : "1px solid hsl(210 18% 93%)",
                        transition: "background-color 120ms",
                        gridTemplateColumns: gridCols,
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.background = "hsl(210 20% 98%)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.background = "")
                      }
                    >
                      <Link
                        href={`/admin/events/${event.id}`}
                        className="contents"
                        aria-label={`Open ${event.name}`}
                      >
                        {/* Event (thumbnail + name) */}
                        <div className="flex items-center gap-3 min-w-0">
                          <EventThumb name={event.name} website={event.website_url} />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">
                              {event.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                              #EV-{String(event.id).padStart(3, "0")}
                            </p>
                          </div>
                        </div>

                        {/* Location / Dates */}
                        <div className="min-w-0 text-xs">
                          <div className="flex items-center gap-1.5 text-foreground font-medium truncate">
                            <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="truncate">
                              {event.location || <span className="text-muted-foreground">TBD</span>}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>
                              {event.date
                                ? new Date(event.date).toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "—"}
                            </span>
                          </div>
                        </div>

                        {/* Exhibitors */}
                        <div className="text-sm">
                          <span className="font-bold text-foreground">
                            {event.exhibitor_count}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1 inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            exh.
                          </span>
                        </div>

                        {/* Readiness */}
                        <div className="min-w-0">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-muted-foreground tabular-nums">
                              {event.completed_count}/{event.exhibitor_count}
                            </span>
                            <span
                              className="font-bold tabular-nums"
                              style={{
                                color:
                                  progress === 100
                                    ? "hsl(154 70% 30%)"
                                    : "hsl(209 50% 22%)",
                              }}
                            >
                              {progress}%
                            </span>
                          </div>
                          <div
                            className="h-1.5 rounded-full overflow-hidden"
                            style={{ background: "hsl(210 18% 92%)" }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${progress}%`,
                                transition: "width 500ms cubic-bezier(0.23,1,0.32,1)",
                                background: progressBg,
                              }}
                            />
                          </div>
                        </div>

                        {/* Deadline */}
                        <div className="min-w-0 text-xs">
                          {nextDeadline ? (
                            <>
                              <div
                                className="font-semibold tabular-nums"
                                style={{
                                  color:
                                    nextDeadline.daysLeft < 0
                                      ? "hsl(0 72% 48%)"
                                      : nextDeadline.daysLeft <= 7
                                      ? "hsl(25 90% 42%)"
                                      : "hsl(209 50% 22%)",
                                }}
                              >
                                {nextDeadline.daysLeft < 0
                                  ? `${Math.abs(nextDeadline.daysLeft)}d overdue`
                                  : `D−${nextDeadline.daysLeft}`}
                              </div>
                              <div className="text-muted-foreground truncate">
                                {nextDeadline.label} ·{" "}
                                {new Date(nextDeadline.date).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                })}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>

                        {/* Status */}
                        <div className="shrink-0">
                          <StatusBadge status={event.status} />
                        </div>
                      </Link>

                      {/* Settings button (outside Link) */}
                      <div className="flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/events/${event.id}/settings`);
                          }}
                          title="Event settings"
                          className="h-8 w-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 active:scale-95"
                          style={{
                            color: "hsl(210 12% 52%)",
                            transition: "opacity 150ms, background-color 120ms, color 120ms, transform 100ms",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "hsl(210 18% 92%)";
                            (e.currentTarget as HTMLElement).style.color = "hsl(209 65% 22%)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                            (e.currentTarget as HTMLElement).style.color = "hsl(210 12% 52%)";
                          }}
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Footer + pagination */}
                <div
                  className="flex items-center justify-between px-4 py-2.5 text-xs"
                  style={{
                    borderTop: "1px solid hsl(210 18% 93%)",
                    color: "hsl(210 10% 52%)",
                    background: "hsl(210 20% 98%)",
                  }}
                >
                  <div>
                    Showing{" "}
                    <b style={{ color: "hsl(209 50% 22%)" }}>
                      {filtered.length === 0
                        ? 0
                        : `${pageStart + 1}–${Math.min(pageEnd, filtered.length)}`}
                    </b>{" "}
                    of {filtered.length}
                    {filtered.length !== events.length && (
                      <span className="text-muted-foreground">
                        {" "}
                        · filtered from {events.length}
                      </span>
                    )}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <PagerBtn
                        disabled={safePage === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        ‹
                      </PagerBtn>
                      {pageNumbers(safePage, totalPages).map((n, idx) =>
                        n === "…" ? (
                          <span key={`e-${idx}`} className="px-1 text-muted-foreground">
                            …
                          </span>
                        ) : (
                          <PagerBtn
                            key={n}
                            active={n === safePage}
                            onClick={() => setPage(Number(n))}
                          >
                            {n}
                          </PagerBtn>
                        )
                      )}
                      <PagerBtn
                        disabled={safePage === totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        ›
                      </PagerBtn>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
    </div>
  );
}
