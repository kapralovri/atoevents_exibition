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
  Package,
  FileText,
  Image as ImageIcon,
  Upload,
  Check,
  Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  status: string;
  exhibitor_count: number;
  completed_count: number;
}

interface StandSlot {
  enabled: boolean;
  alias: string;
  count: number;
  area_m2: number;
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
  // Section 3 — Stand slots (keyed by package)
  slots: Record<string, StandSlot>;
  // Section 4 — Documents / Backdrops (handled post-create)
  arrivalPdfFile: File | null;
  backdropFiles: Record<string, File | null>;
}

type FieldErrors = Partial<Record<keyof NewEventForm | string, string>>;

// ── Constants ─────────────────────────────────────────────────────────────────

const SLOT_KEYS = ["SHELL_ONLY", "SYSTEM", "BESPOKE"] as const;

const DEFAULT_SLOTS: Record<string, StandSlot> = {
  SHELL_ONLY: { enabled: true, alias: "START",      count: 10, area_m2: 9 },
  SYSTEM:     { enabled: true, alias: "PRO",        count: 5,  area_m2: 18 },
  BESPOKE:    { enabled: false,alias: "INDIVIDUAL", count: 0,  area_m2: 0 },
};

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
    slots: structuredClone(DEFAULT_SLOTS),
    arrivalPdfFile: null,
    backdropFiles: { SHELL_ONLY: null, SYSTEM: null, BESPOKE: null },
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

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 items-center rounded-full shrink-0 transition-colors duration-200"
      style={{
        background: checked ? "hsl(209 65% 38%)" : "hsl(213 20% 80%)",
      }}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

// ── Progress helper ───────────────────────────────────────────────────────────

function pct(completed: number, total: number) {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<NewEventForm>(blankForm());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isCreating, setIsCreating] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Section open/closed state
  const [openSections, setOpenSections] = useState({
    metadata: true,
    deadlines: true,
    slots: false,
    docs: false,
  });

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const backdropRefs = {
    SHELL_ONLY: useRef<HTMLInputElement>(null),
    SYSTEM: useRef<HTMLInputElement>(null),
    BESPOKE: useRef<HTMLInputElement>(null),
  };

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

  function setSlot(slotKey: string, field: keyof StandSlot, value: unknown) {
    setForm((prev) => ({
      ...prev,
      slots: {
        ...prev.slots,
        [slotKey]: { ...prev.slots[slotKey], [field]: value },
      },
    }));
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

    // Slots: if enabled, count must be > 0 and area > 0
    SLOT_KEYS.forEach((sk) => {
      const slot = form.slots[sk];
      if (slot.enabled) {
        if (slot.count <= 0) e[`slot_count_${sk}`] = "Count must be > 0";
        if (slot.area_m2 <= 0) e[`slot_area_${sk}`] = "Area must be > 0";
        if (!slot.alias.trim()) e[`slot_alias_${sk}`] = "Enter a name";
      }
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
      alias_shell: form.slots.SHELL_ONLY.alias,
      alias_system: form.slots.SYSTEM.alias,
      alias_bespoke: form.slots.BESPOKE.alias,
      stand_slots: Object.fromEntries(
        SLOT_KEYS.map((sk) => [
          sk,
          {
            enabled: form.slots[sk].enabled,
            count: form.slots[sk].count,
            area_m2: form.slots[sk].area_m2,
          },
        ])
      ),
    };

    try {
      const created = await apiFetch<{ id: string }>("/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setCreatedEventId(String(created.id));
      toast.success("Event created — upload documents now");
      setOpenSections((prev) => ({ ...prev, docs: true }));
      await loadEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setIsCreating(false);
    }
  }

  // ── Phase 2: Upload PDF + backdrops ────────────────────────────────────────

  async function handleUploadDocs() {
    if (!createdEventId) return;
    setIsUploading(true);

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    const token = localStorage.getItem("access_token");
    const headers = { Authorization: `Bearer ${token}` };

    try {
      // Upload arrival PDF
      if (form.arrivalPdfFile) {
        const presignRes = await fetch(
          `${apiBase}/admin/events/${createdEventId}/documents/presign`,
          {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: form.arrivalPdfFile.name,
              doc_type: "setup_schedule",
              title: "График заезда",
              content_type: "application/pdf",
            }),
          }
        );
        if (presignRes.ok) {
          const { upload_url, s3_key } = await presignRes.json();
          await fetch(upload_url, {
            method: "PUT",
            body: form.arrivalPdfFile,
            headers: { "Content-Type": "application/pdf" },
          });
          await fetch(`${apiBase}/admin/events/${createdEventId}/documents/complete`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ s3_key }),
          });
        }
      }

      // Upload backdrop images
      for (const sk of SLOT_KEYS) {
        const file = form.backdropFiles[sk];
        if (!file) continue;
        const presignRes = await fetch(`${apiBase}/admin/backdrop/presign`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            event_id: createdEventId,
            stand_package: sk,
            filename: file.name,
            content_type: file.type,
          }),
        });
        if (presignRes.ok) {
          const { upload_url, s3_key } = await presignRes.json();
          await fetch(upload_url, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });
          await fetch(`${apiBase}/admin/backdrop/complete`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              event_id: createdEventId,
              stand_package: sk,
              s3_key,
            }),
          });
        }
      }

      toast.success("Documents uploaded successfully");
      setShowCreateForm(false);
      setForm(blankForm());
      setCreatedEventId(null);
    } catch {
      toast.error("Failed to upload files");
    } finally {
      setIsUploading(false);
    }
  }

  function handleCancelCreate() {
    setShowCreateForm(false);
    setForm(blankForm());
    setErrors({});
    setCreatedEventId(null);
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
                  {createdEventId
                    ? "Upload Documents"
                    : "Create Event"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {!createdEventId ? (
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
                                      (−{DEADLINE_OFFSETS[key]}д)
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

                    {/* ── Section 3: Stand slots ── */}
                    <div
                      className="rounded-xl overflow-hidden"
                      style={{ border: "1px solid hsl(209 65% 21% / 0.1)" }}
                    >
                      <div className="px-4 pt-3 pb-1">
                        <SectionHeader
                          icon={Package}
                          title="3. Stand Types"
                          open={openSections.slots}
                          onToggle={() => toggleSection("slots")}
                        />
                      </div>
                      {openSections.slots && (
                        <div
                          className="px-4 pb-4 pt-2 space-y-3"
                          style={{ background: "hsl(209 65% 21% / 0.015)" }}
                        >
                          <div className="space-y-3">
                            {/* Header row */}
                            <div className="grid grid-cols-[auto_1fr_80px_80px] gap-3 items-center">
                              <span className="w-10" />
                              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</span>
                              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">Count</span>
                              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">m²</span>
                            </div>
                            {SLOT_KEYS.map((sk) => {
                              const slot = form.slots[sk];
                              return (
                                <div
                                  key={sk}
                                  className="grid grid-cols-[auto_1fr_80px_80px] gap-3 items-start"
                                >
                                  <div className="flex items-center gap-2 pt-2">
                                    <ToggleSwitch
                                      checked={slot.enabled}
                                      onChange={(v) => setSlot(sk, "enabled", v)}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Input
                                      value={slot.alias}
                                      onChange={(e) =>
                                        setSlot(sk, "alias", e.target.value)
                                      }
                                      placeholder={DEFAULT_SLOTS[sk].alias}
                                      disabled={!slot.enabled}
                                      className={`text-sm ${!slot.enabled ? "opacity-40" : ""} ${errors[`slot_alias_${sk}`] ? "border-red-400" : ""}`}
                                    />
                                    <FieldError msg={errors[`slot_alias_${sk}`]} />
                                    <p className="text-xs text-muted-foreground/60">{sk}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <Input
                                      type="number"
                                      min={0}
                                      value={slot.count}
                                      onChange={(e) =>
                                        setSlot(sk, "count", parseInt(e.target.value) || 0)
                                      }
                                      disabled={!slot.enabled}
                                      className={`text-sm text-center ${!slot.enabled ? "opacity-40" : ""} ${errors[`slot_count_${sk}`] ? "border-red-400" : ""}`}
                                    />
                                    <FieldError msg={errors[`slot_count_${sk}`]} />
                                  </div>
                                  <div className="space-y-1">
                                    <Input
                                      type="number"
                                      min={0}
                                      step={0.5}
                                      value={slot.area_m2}
                                      onChange={(e) =>
                                        setSlot(sk, "area_m2", parseFloat(e.target.value) || 0)
                                      }
                                      disabled={!slot.enabled}
                                      className={`text-sm text-center ${!slot.enabled ? "opacity-40" : ""} ${errors[`slot_area_${sk}`] ? "border-red-400" : ""}`}
                                    />
                                    <FieldError msg={errors[`slot_area_${sk}`]} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Submit Phase 1 ── */}
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
                ) : (
                  // ── Phase 2: Document upload (after event created) ──────────────
                  <div className="space-y-4">
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                      style={{
                        background: "hsl(154 100% 49% / 0.08)",
                        color: "hsl(154 60% 28%)",
                        border: "1px solid hsl(154 100% 49% / 0.2)",
                      }}
                    >
                      <Check className="h-4 w-4 shrink-0" />
                      Event created (ID: {createdEventId}). Upload documents below.
                    </div>

                    {/* ── Section 4: Docs & Backdrops ── */}
                    <div
                      className="rounded-xl overflow-hidden"
                      style={{ border: "1px solid hsl(209 65% 21% / 0.1)" }}
                    >
                      <div className="px-4 pt-3 pb-1">
                        <SectionHeader
                          icon={ImageIcon}
                          title="4. Documents & Backdrop Images"
                          open={openSections.docs}
                          onToggle={() => toggleSection("docs")}
                        />
                      </div>
                      {openSections.docs && (
                        <div
                          className="px-4 pb-4 pt-2 space-y-5"
                          style={{ background: "hsl(209 65% 21% / 0.015)" }}
                        >
                          {/* Arrival schedule PDF */}
                          <div className="space-y-2">
                            <FieldLabel>Arrival Schedule (PDF)</FieldLabel>
                            <div className="flex items-center gap-3">
                              <input
                                ref={pdfInputRef}
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    arrivalPdfFile: e.target.files?.[0] ?? null,
                                  })
                                }
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => pdfInputRef.current?.click()}
                              >
                                <Upload className="h-3.5 w-3.5" />
                                Choose File
                              </Button>
                              {form.arrivalPdfFile && (
                                <span className="text-sm text-muted-foreground truncate max-w-xs">
                                  {form.arrivalPdfFile.name}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Backdrop images per booth type */}
                          <div className="space-y-3">
                            <FieldLabel>
                              Booth Backdrops (JPEG/PNG, per stand type)
                            </FieldLabel>
                            <div className="space-y-2">
                              {SLOT_KEYS.map((sk) => (
                                <div key={sk} className="flex items-center gap-3">
                                  <span
                                    className="text-xs font-semibold rounded px-2 py-1 shrink-0"
                                    style={{
                                      background: "hsl(209 65% 21% / 0.07)",
                                      color: "hsl(209 65% 28%)",
                                      minWidth: "80px",
                                      textAlign: "center",
                                    }}
                                  >
                                    {form.slots[sk].alias}
                                  </span>
                                  <input
                                    ref={backdropRefs[sk]}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={(e) =>
                                      setForm({
                                        ...form,
                                        backdropFiles: {
                                          ...form.backdropFiles,
                                          [sk]: e.target.files?.[0] ?? null,
                                        },
                                      })
                                    }
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() =>
                                      backdropRefs[sk].current?.click()
                                    }
                                  >
                                    <Upload className="h-3.5 w-3.5" />
                                    Choose
                                  </Button>
                                  {form.backdropFiles[sk] && (
                                    <span className="text-sm text-muted-foreground truncate max-w-xs">
                                      {form.backdropFiles[sk]!.name}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={handleUploadDocs}
                        disabled={isUploading}
                        className="gap-2"
                      >
                        {isUploading ? (
                          <>
                            <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            Uploading…
                          </>
                        ) : (
                          "Upload & Finish"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelCreate}
                      >
                        Skip
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Events list (row layout) ──────────────────────────── */}
          {events.length > 0 ? (
            <div className="space-y-2">
              {events.map((event, i) => {
                const progress = pct(event.completed_count, event.exhibitor_count);
                return (
                  <div
                    key={event.id}
                    className={[
                      "group relative flex items-center gap-4 rounded-xl overflow-hidden",
                      `stagger-${Math.min(i + 1, 4)} animate-fade-up`,
                    ].join(" ")}
                    style={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      padding: "14px 16px",
                      transition: "border-color 150ms cubic-bezier(0.23,1,0.32,1), box-shadow 150ms cubic-bezier(0.23,1,0.32,1)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "hsl(209 65% 21% / 0.25)";
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 2px 12px hsl(209 65% 21% / 0.08)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "";
                      (e.currentTarget as HTMLElement).style.boxShadow = "";
                    }}
                  >
                    {/* Left accent stripe */}
                    <div
                      className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
                      style={{
                        background:
                          progress === 100
                            ? "linear-gradient(180deg, hsl(154 100% 49%), hsl(170 80% 44%))"
                            : progress > 50
                            ? "hsl(209 65% 50%)"
                            : "hsl(209 65% 21% / 0.2)",
                      }}
                    />

                    {/* Clickable area → event detail */}
                    <Link
                      href={`/admin/events/${event.id}`}
                      className="flex flex-1 min-w-0 items-center gap-4"
                    >
                      {/* Event name + meta */}
                      <div className="flex-1 min-w-0 pl-3">
                        <p className="font-semibold text-sm text-foreground truncate">
                          {event.name}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {event.location && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[160px]">{event.location}</span>
                            </span>
                          )}
                          {event.date && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3 shrink-0" />
                              {new Date(event.date).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status badge */}
                      <div className="shrink-0">
                        <StatusBadge status={event.status} />
                      </div>

                      {/* Participant count */}
                      <div className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground min-w-[64px]">
                        <Users className="h-3.5 w-3.5" />
                        <span>{event.exhibitor_count} exh.</span>
                      </div>

                      {/* Progress bar */}
                      <div className="shrink-0 w-36 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            {event.completed_count}/{event.exhibitor_count}
                          </span>
                          <span
                            className="font-semibold tabular-nums"
                            style={{
                              color:
                                progress === 100
                                  ? "hsl(154 60% 32%)"
                                  : "hsl(209 65% 28%)",
                            }}
                          >
                            {progress}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${progress}%`,
                              transition: "width 500ms cubic-bezier(0.23,1,0.32,1)",
                              background:
                                progress === 100
                                  ? "linear-gradient(90deg, hsl(154 100% 49%), hsl(170 80% 44%))"
                                  : "hsl(209 65% 45%)",
                            }}
                          />
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </Link>

                    {/* Settings button — outside the Link so it doesn't navigate to detail */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/events/${event.id}/settings`);
                      }}
                      title="Event settings"
                      className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 active:scale-95"
                      style={{
                        background: "hsl(209 65% 21% / 0.06)",
                        color: "hsl(209 65% 38%)",
                        transition: "opacity 150ms ease, background-color 120ms cubic-bezier(0.23,1,0.32,1), transform 100ms cubic-bezier(0.23,1,0.32,1)",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "hsl(209 65% 21% / 0.12)";
                        (e.currentTarget as HTMLElement).style.color = "hsl(209 65% 21%)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "hsl(209 65% 21% / 0.06)";
                        (e.currentTarget as HTMLElement).style.color = "hsl(209 65% 38%)";
                      }}
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
  );
}
