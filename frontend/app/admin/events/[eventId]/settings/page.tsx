"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  FileText,
  Clock,
  Package,
  Save,
  ImageIcon,
  Upload,
  CheckCircle2,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
  Layers,
  ShieldAlert,
  X,
} from "lucide-react";

import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StandInventoryItem {
  id: string;
  package: string;
  area_m2: number;
  configuration: string;
  total: number;
}

interface AvailabilityItem extends StandInventoryItem {
  booked: number;
  available: number;
  is_full: boolean;
  backdrop_url?: string | null;
}

interface SettingsForm {
  name: string;
  start_date: string;
  end_date: string;
  venue_address: string;
  website_url: string;
  status: string;
  deadline_graphics_initial: string;
  deadline_company_profile: string;
  deadline_participants: string;
  deadline_final_graphics: string;
  stand_inventory: StandInventoryItem[];
}

type FieldErrors = Partial<Record<string, string>>;

// ── Constants ─────────────────────────────────────────────────────────────────

const PKG_LABELS: Record<string, string> = {
  SHELL_ONLY: "START",
  SYSTEM:     "PRO",
  BESPOKE:    "INDIVIDUAL",
};

const CFG_LABELS: Record<string, string> = {
  LINEAR:    "Linear",
  ANGULAR:   "Angular",
  PENINSULA: "Peninsula",
  ISLAND:    "Island",
};

const AREA_OPTIONS = [9, 12, 15, 18, 21];

const CFGS_BY_PKG: Record<string, string[]> = {
  SHELL_ONLY: ["LINEAR", "ANGULAR", "PENINSULA"],
  SYSTEM:     ["LINEAR", "ANGULAR", "PENINSULA"],
  BESPOKE:    ["LINEAR", "ANGULAR", "PENINSULA", "ISLAND"],
};

const STATUS_OPTIONS = [
  { value: "upcoming",  label: "Upcoming"  },
  { value: "active",    label: "Active"    },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function inventorySlug(pkg: string, area: number, cfg: string) {
  const p = { SHELL_ONLY: "so", SYSTEM: "sys", BESPOKE: "besp" }[pkg] ?? pkg.toLowerCase().slice(0, 4);
  const c = { LINEAR: "lin", ANGULAR: "ang", PENINSULA: "pen", ISLAND: "isl" }[cfg] ?? cfg.toLowerCase().slice(0, 3);
  return `${p}_${area}_${c}`;
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

const INPUT_CLS =
  "h-9 text-sm rounded-lg border border-input bg-background px-3 focus:outline-none focus:ring-2 focus:ring-[hsl(209_65%_38%)] focus:ring-offset-0 w-full";

const SELECT_CLS =
  "h-9 text-sm rounded-lg border border-input bg-background px-3 focus:outline-none focus:ring-2 focus:ring-[hsl(209_65%_38%)] focus:ring-offset-0 w-full";

function FieldLabel({ htmlFor, required, children }: { htmlFor?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </Label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

function SectionCard({ id, icon: Icon, title, children }: { id: string; icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "hsl(209 65% 21% / 0.08)" }}>
          <Icon className="h-3.5 w-3.5" style={{ color: "hsl(209 65% 38%)" }} />
        </div>
        <h2 className="text-sm font-semibold" style={{ color: "hsl(209 65% 21%)" }}>{title}</h2>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm">
        {children}
      </div>
    </section>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EventSettingsPage() {
  const params  = useParams();
  const router  = useRouter();
  const eventId = params.eventId as string;

  const [form, setForm]       = useState<SettingsForm | null>(null);
  const [errors, setErrors]   = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityItem[]>([]);

  // Inline "add row" state
  const [addRow, setAddRow] = useState(false);
  const [newItem, setNewItem] = useState({ package: "SHELL_ONLY", area_m2: 9, configuration: "LINEAR", total: 1 });
  const [addError, setAddError] = useState("");

  // Per-inventory backdrop upload
  const [backdropStatus, setBackdropStatus] = useState<Record<string, "idle" | "uploading" | "done" | "error">>({});
  const backdropInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // PDF arrival schedule
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<{ title: string; filename?: string } | null>(null);

  // Delete event
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      apiFetch<Record<string, unknown>>(`/admin/events/${eventId}`),
      apiFetch<AvailabilityItem[]>(`/admin/events/${eventId}/stand-availability`).catch(() => []),
      apiFetch<Array<{ doc_type: string; title: string; original_filename?: string }>>(`/admin/events/${eventId}/documents`).catch(() => []),
    ]).then(([ev, avail, docs]) => {
      const d = (k: string) => ((ev[k] as string) || "");
      setForm({
        name:                       d("name"),
        start_date:                 d("start_date") || d("date"),
        end_date:                   d("end_date"),
        venue_address:              d("venue_address") || d("location"),
        website_url:                d("website_url"),
        status:                     d("status") || "upcoming",
        deadline_graphics_initial:  d("deadline_graphics") || d("deadline_graphics_initial"),
        deadline_company_profile:   d("deadline_description") || d("deadline_company_profile"),
        deadline_participants:      d("deadline_participants"),
        deadline_final_graphics:    d("deadline_final_graphics"),
        stand_inventory:            (ev.stand_inventory as StandInventoryItem[]) ?? [],
      });
      setAvailability(avail as AvailabilityItem[]);
      const schedule = (docs as Array<{ doc_type: string; title: string; original_filename?: string }>)
        .find((d) => d.doc_type === "setup_schedule");
      if (schedule) setPdfDoc({ title: schedule.title, filename: schedule.original_filename });
    }).catch(() => toast.error("Failed to load event settings"));
  }, [eventId]);

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(f: SettingsForm): FieldErrors {
    const e: FieldErrors = {};
    if (!f.name.trim() || f.name.trim().length < 3) e.name = "Minimum 3 characters";
    if (!f.start_date) e.start_date = "Required";
    if (!f.venue_address.trim() || f.venue_address.trim().length < 2) e.venue_address = "Required";
    if (f.website_url && !/^https?:\/\//.test(f.website_url)) e.website_url = "Must start with http:// or https://";
    if (f.end_date && f.start_date && f.end_date <= f.start_date) e.end_date = "Must be after start date";
    (["deadline_graphics_initial", "deadline_company_profile", "deadline_participants", "deadline_final_graphics"] as const)
      .forEach((k) => {
        if (f[k] && f.start_date && f[k] >= f.start_date) e[k] = "Must be before event start";
      });
    return e;
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form) return;
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) { toast.error("Please fix validation errors"); return; }
    setIsSaving(true);
    try {
      await apiFetch(`/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:                      form.name,
          start_date:                form.start_date,
          end_date:                  form.end_date || null,
          venue_address:             form.venue_address,
          website_url:               form.website_url || null,
          status:                    form.status,
          deadline_graphics_initial: form.deadline_graphics_initial || null,
          deadline_company_profile:  form.deadline_company_profile || null,
          deadline_participants:     form.deadline_participants || null,
          deadline_final_graphics:   form.deadline_final_graphics || null,
          stand_inventory:           form.stand_inventory,
        }),
      });
      toast.success("Settings saved");
      // Refresh availability after save
      apiFetch<AvailabilityItem[]>(`/admin/events/${eventId}/stand-availability`)
        .then(setAvailability).catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Backdrop upload ─────────────────────────────────────────────────────────
  async function handleBackdropUpload(itemId: string, file: File) {
    setBackdropStatus((s) => ({ ...s, [itemId]: "uploading" }));
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      const token   = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      const presign = await fetch(`${apiBase}/admin/backdrop/presign`, {
        method: "POST", headers,
        body: JSON.stringify({ event_id: parseInt(eventId), inventory_id: itemId, filename: file.name, content_type: file.type || "image/jpeg" }),
      });
      if (!presign.ok) throw new Error("Presign failed");
      const { upload_url, s3_key } = await presign.json();

      const put = await fetch(upload_url, { method: "PUT", body: file });
      if (!put.ok) throw new Error("S3 upload failed");

      const complete = await fetch(`${apiBase}/admin/backdrop/complete`, {
        method: "POST", headers,
        body: JSON.stringify({ event_id: parseInt(eventId), inventory_id: itemId, s3_key }),
      });
      if (!complete.ok) throw new Error("Complete failed");

      setBackdropStatus((s) => ({ ...s, [itemId]: "done" }));
      toast.success("Backdrop uploaded");
      // Refresh availability to get new backdrop_url
      apiFetch<AvailabilityItem[]>(`/admin/events/${eventId}/stand-availability`)
        .then(setAvailability).catch(() => {});
    } catch (err) {
      setBackdropStatus((s) => ({ ...s, [itemId]: "error" }));
      toast.error(err instanceof Error ? err.message : "Backdrop upload failed");
    }
  }

  // ── PDF upload ──────────────────────────────────────────────────────────────
  async function handlePdfUpload(file: File) {
    setPdfUploading(true);
    try {
      const { upload_url, s3_key, doc_type, title, version_label } =
        await apiFetch<{ upload_url: string; s3_key: string; doc_type: string; title: string; version_label: string }>(
          `/admin/events/${eventId}/documents/presign`,
          { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ doc_type: "setup_schedule", title: "Arrival Schedule", version_label: "1.0", content_type: "application/pdf" }) }
        );
      await fetch(upload_url, { method: "PUT", body: file });
      await apiFetch(`/admin/events/${eventId}/documents/complete`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3_key, doc_type, title, version_label }),
      });
      toast.success("PDF uploaded");
      setPdfDoc({ title: "Arrival Schedule", filename: file.name });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF upload failed");
    } finally {
      setPdfUploading(false);
    }
  }

  // ── Delete event ────────────────────────────────────────────────────────────
  async function handleDeleteEvent() {
    if (!form) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/admin/events/${eventId}`, { method: "DELETE" });
      toast.success(`Event "${form.name}" deleted`);
      router.push("/admin/events");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setIsDeleting(false);
    }
  }

  // ── Inventory helpers ───────────────────────────────────────────────────────
  function addInventoryItem() {
    if (!form) return;
    setAddError("");
    const { package: pkg, area_m2, configuration, total } = newItem;
    const id = inventorySlug(pkg, area_m2, configuration);
    if (form.stand_inventory.some((i) => i.id === id)) {
      setAddError(`${PKG_LABELS[pkg]} ${area_m2}m² ${CFG_LABELS[configuration]} already exists`);
      return;
    }
    setForm({ ...form, stand_inventory: [...form.stand_inventory, { id, package: pkg, area_m2, configuration, total }] });
    setAddRow(false);
    setNewItem({ package: "SHELL_ONLY", area_m2: 9, configuration: "LINEAR", total: 1 });
  }

  function removeInventoryItem(id: string) {
    if (!form) return;
    const avail = availability.find((a) => a.id === id);
    if (avail && avail.booked > 0) {
      if (!confirm(`${avail.booked} exhibitor(s) are assigned to this slot. Remove anyway?`)) return;
    }
    setForm({ ...form, stand_inventory: form.stand_inventory.filter((i) => i.id !== id) });
  }

  function updateItemTotal(id: string, total: number) {
    if (!form) return;
    setForm({ ...form, stand_inventory: form.stand_inventory.map((i) => i.id === id ? { ...i, total } : i) });
  }

  const avMap = Object.fromEntries(availability.map((a) => [a.id, a]));

  // ── Loading state ───────────────────────────────────────────────────────────
  if (!form) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const navItems = [
    { id: "basic",     label: "Basic Details",    icon: FileText   },
    { id: "deadlines", label: "Deadlines",         icon: Clock      },
    { id: "inventory", label: "Stand Inventory",   icon: Layers     },
    { id: "documents", label: "Documents",         icon: ImageIcon  },
    { id: "danger",    label: "Danger Zone",       icon: ShieldAlert },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={`/admin/events/${eventId}`}
              className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted shrink-0 transition-colors">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-bold truncate" style={{ color: "hsl(209 65% 21%)" }}>Event Settings</h1>
              <p className="text-xs text-muted-foreground truncate">{form.name}</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shrink-0 transition-opacity disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, hsl(209 65% 38%), hsl(209 65% 28%))", color: "white" }}
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-8 flex gap-8">
        {/* ── Left nav ── */}
        <nav className="hidden lg:flex flex-col gap-1 w-52 shrink-0 sticky top-24 self-start">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isDanger = id === "danger";
            return (
              <a key={id} href={`#${id}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  color: isDanger ? "hsl(0 72% 51%)" : "hsl(209 50% 35%)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = isDanger ? "hsl(0 72% 51% / 0.06)" : "hsl(213 20% 95%)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </a>
            );
          })}
        </nav>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0 space-y-8">

          {/* ─────────────── 1. BASIC DETAILS ─────────────── */}
          <SectionCard id="basic" icon={FileText} title="1. Basic Details">
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2 space-y-1.5">
                <FieldLabel htmlFor="name" required>Event Name</FieldLabel>
                <Input id="name" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={INPUT_CLS} placeholder="e.g. ATO COMM 2026" />
                <FieldError msg={errors.name} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="start_date" required>Start Date</FieldLabel>
                <Input id="start_date" type="date" value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className={INPUT_CLS} />
                <FieldError msg={errors.start_date} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="end_date">End Date</FieldLabel>
                <Input id="end_date" type="date" value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className={INPUT_CLS} />
                <FieldError msg={errors.end_date} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="venue" required>Venue / Address</FieldLabel>
                <Input id="venue" value={form.venue_address}
                  onChange={(e) => setForm({ ...form, venue_address: e.target.value })}
                  className={INPUT_CLS} placeholder="Moscow, Expocentre" />
                <FieldError msg={errors.venue_address} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="website">Website</FieldLabel>
                <Input id="website" value={form.website_url}
                  onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                  className={INPUT_CLS} placeholder="https://example.com" />
                <FieldError msg={errors.website_url} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="status">Status</FieldLabel>
                <select id="status" value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className={SELECT_CLS}>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </SectionCard>

          {/* ─────────────── 2. DEADLINES ─────────────── */}
          <SectionCard id="deadlines" icon={Clock} title="2. Deadlines">
            <div className="grid sm:grid-cols-2 gap-5">
              {([
                ["deadline_graphics_initial", "Initial Graphics Deadline"],
                ["deadline_company_profile",  "Company Profile Deadline"],
                ["deadline_participants",     "Participants Deadline"],
                ["deadline_final_graphics",   "Final Graphics Deadline"],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <FieldLabel htmlFor={key}>{label}</FieldLabel>
                  <Input id={key} type="date" value={(form as unknown as Record<string, string>)[key] ?? ""}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className={INPUT_CLS} />
                  <FieldError msg={errors[key]} />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              All deadlines must be before the event start date.
            </p>
          </SectionCard>

          {/* ─────────────── 3. STAND INVENTORY ─────────────── */}
          <SectionCard id="inventory" icon={Layers} title="3. Stand Inventory">

            {/* Table */}
            {form.stand_inventory.length > 0 ? (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ borderBottom: "1px solid hsl(213 20% 88%)" }}>
                      {["Package", "Area m²", "Configuration", "Total", "Booked", "Free", "Backdrop", ""].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold uppercase tracking-wide px-3 py-2"
                          style={{ color: "hsl(213 20% 48%)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {form.stand_inventory.map((item) => {
                      const av = avMap[item.id];
                      const bkStatus = backdropStatus[item.id] ?? (av?.backdrop_url ? "done" : "idle");
                      return (
                        <tr key={item.id}
                          style={{ borderBottom: "1px solid hsl(213 20% 93%)" }}
                          className="hover:bg-muted/30 transition-colors">
                          {/* Package */}
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: "hsl(209 65% 21% / 0.08)", color: "hsl(209 65% 28%)" }}>
                              {PKG_LABELS[item.package] ?? item.package}
                            </span>
                          </td>
                          {/* Area */}
                          <td className="px-3 py-2.5 font-medium text-foreground">{item.area_m2} m²</td>
                          {/* Config */}
                          <td className="px-3 py-2.5 text-muted-foreground">{CFG_LABELS[item.configuration] ?? item.configuration}</td>
                          {/* Total — editable */}
                          <td className="px-3 py-2.5">
                            <input
                              type="number" min={1} value={item.total}
                              onChange={(e) => updateItemTotal(item.id, Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-16 h-7 text-sm rounded-md border border-input bg-background px-2 text-center focus:outline-none focus:ring-1 focus:ring-[hsl(209_65%_38%)]"
                            />
                          </td>
                          {/* Booked */}
                          <td className="px-3 py-2.5">
                            <span className={`text-sm font-medium ${av?.booked ? "text-foreground" : "text-muted-foreground"}`}>
                              {av?.booked ?? "—"}
                            </span>
                          </td>
                          {/* Free */}
                          <td className="px-3 py-2.5">
                            {av ? (
                              <span className={`text-sm font-semibold ${av.is_full ? "text-red-500" : "text-green-600"}`}>
                                {av.is_full ? "FULL" : av.available}
                              </span>
                            ) : <span className="text-muted-foreground text-sm">—</span>}
                          </td>
                          {/* Backdrop */}
                          <td className="px-3 py-2.5">
                            <input type="file" accept="image/*"
                              ref={(el) => { backdropInputRefs.current[item.id] = el; }}
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleBackdropUpload(item.id, f);
                                if (e.target) e.target.value = "";
                              }}
                            />
                            {bkStatus === "uploading" ? (
                              <span className="flex items-center gap-1 text-xs text-blue-500">
                                <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                              </span>
                            ) : bkStatus === "done" || av?.backdrop_url ? (
                              <button
                                onClick={() => backdropInputRefs.current[item.id]?.click()}
                                className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 transition-colors">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Replace
                              </button>
                            ) : (
                              <button
                                onClick={() => backdropInputRefs.current[item.id]?.click()}
                                className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                                style={{ color: "hsl(209 65% 38%)" }}>
                                <Upload className="h-3 w-3" />
                                Upload
                              </button>
                            )}
                          </td>
                          {/* Delete */}
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => removeInventoryItem(item.id)}
                              className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 rounded-xl"
                style={{ border: "2px dashed hsl(213 20% 84%)", background: "hsl(213 20% 98%)" }}>
                <Package className="h-8 w-8 text-muted-foreground mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">No stand configurations yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add a configuration below</p>
              </div>
            )}

            {/* Add row form */}
            {addRow ? (
              <div className="rounded-xl p-4 space-y-3"
                style={{ border: "1px solid hsl(209 65% 21% / 0.2)", background: "hsl(209 65% 21% / 0.03)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "hsl(209 65% 38%)" }}>
                  New Stand Configuration
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Package</label>
                    <select value={newItem.package}
                      onChange={(e) => {
                        const pkg = e.target.value;
                        const cfgs = CFGS_BY_PKG[pkg];
                        setNewItem({ ...newItem, package: pkg, configuration: cfgs[0] });
                      }}
                      className={SELECT_CLS}>
                      {Object.entries(PKG_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Area m²</label>
                    <select value={newItem.area_m2}
                      onChange={(e) => setNewItem({ ...newItem, area_m2: parseInt(e.target.value) })}
                      className={SELECT_CLS}>
                      {AREA_OPTIONS.map((a) => <option key={a} value={a}>{a} m²</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Configuration</label>
                    <select value={newItem.configuration}
                      onChange={(e) => setNewItem({ ...newItem, configuration: e.target.value })}
                      className={SELECT_CLS}>
                      {CFGS_BY_PKG[newItem.package].map((c) => (
                        <option key={c} value={c}>{CFG_LABELS[c]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Total slots</label>
                    <input type="number" min={1} value={newItem.total}
                      onChange={(e) => setNewItem({ ...newItem, total: Math.max(1, parseInt(e.target.value) || 1) })}
                      className={INPUT_CLS} />
                  </div>
                </div>
                {addError && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" /> {addError}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={addInventoryItem}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-opacity"
                    style={{ background: "hsl(209 65% 38%)" }}>
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                  <button onClick={() => { setAddRow(false); setAddError(""); }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddRow(true)}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium border-2 border-dashed w-full justify-center transition-colors hover:bg-muted/50"
                style={{ borderColor: "hsl(209 65% 21% / 0.2)", color: "hsl(209 65% 38%)" }}>
                <Plus className="h-4 w-4" />
                Add Stand Configuration
              </button>
            )}

            <p className="text-xs text-muted-foreground">
              Edit <strong>Total</strong> inline. Upload a backdrop image per configuration for the zone preview editor.
              Booked / Free counts update after saving.
            </p>
          </SectionCard>

          {/* ─────────────── 4. DOCUMENTS ─────────────── */}
          <SectionCard id="documents" icon={FileText} title="4. Documents">
            <div className="space-y-3">
              <FieldLabel>Arrival Schedule (PDF)</FieldLabel>
              <p className="text-xs text-muted-foreground">
                Upload the setup/arrival schedule PDF for exhibitors.
              </p>

              {/* Existing file badge */}
              {pdfDoc && (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: "hsl(154 80% 94%)", border: "1px solid hsl(154 60% 78%)" }}>
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "hsl(154 60% 28%)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: "hsl(154 60% 22%)" }}>
                      {pdfDoc.title}
                    </p>
                    {pdfDoc.filename && (
                      <p className="text-xs truncate" style={{ color: "hsl(154 50% 35%)" }}>
                        {pdfDoc.filename}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={pdfUploading}
                    className="shrink-0 text-xs font-medium rounded-lg px-2.5 py-1 transition-colors disabled:opacity-60"
                    style={{ background: "hsl(154 60% 88%)", color: "hsl(154 60% 22%)" }}>
                    Replace
                  </button>
                </div>
              )}

              <input type="file" accept=".pdf,application/pdf" ref={pdfInputRef} className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); if (e.target) e.target.value = ""; }} />

              {!pdfDoc && (
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={pdfUploading}
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium border transition-colors hover:bg-muted/50 disabled:opacity-60"
                  style={{ borderColor: "hsl(213 20% 82%)", color: "hsl(209 65% 38%)" }}>
                  {pdfUploading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                    : <><FileText className="h-4 w-4" /> Upload PDF</>
                  }
                </button>
              )}
              {pdfDoc && pdfUploading && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "hsl(209 65% 38%)" }}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading new version…
                </div>
              )}
            </div>
          </SectionCard>

          {/* ─────────────── 5. DANGER ZONE ─────────────── */}
          <section id="danger" className="scroll-mt-24">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "hsl(0 72% 51% / 0.08)" }}>
                <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
              </div>
              <h2 className="text-sm font-semibold text-red-600">Danger Zone</h2>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-red-700">Delete this event</p>
                  <p className="text-xs text-red-500 mt-1 max-w-md">
                    Permanently removes the event and all associated exhibitors, graphics, participants, and documents.
                    This action cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => { setDeleteConfirmName(""); setShowDeleteModal(true); }}
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shrink-0 transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "hsl(0 72% 51%)", color: "white" }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Event
                </button>
              </div>
            </div>
          </section>

        </div>{/* end content */}
      </div>{/* end layout */}

      {/* ── Delete confirmation modal ── */}
      {showDeleteModal && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-2xl bg-white border border-border shadow-2xl p-6 space-y-5 animate-fade-up">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "hsl(0 72% 51% / 0.1)" }}>
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Delete Event</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">This action is permanent and cannot be undone.</p>
                </div>
              </div>
              <button onClick={() => setShowDeleteModal(false)}
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors shrink-0 mt-0.5">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Warning box */}
            <div className="rounded-xl p-4 space-y-1.5"
              style={{ background: "hsl(0 72% 51% / 0.06)", border: "1px solid hsl(0 72% 51% / 0.2)" }}>
              <div className="flex items-center gap-2 text-xs font-semibold text-red-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                The following will be permanently deleted:
              </div>
              <ul className="text-xs text-red-500 space-y-0.5 pl-5 list-disc">
                <li>All registered exhibitors and their company profiles</li>
                <li>All graphic uploads and participant records</li>
                <li>All event documents and stand inventory</li>
                <li>Audit log entries remain for compliance</li>
              </ul>
            </div>

            {/* Confirmation input */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Type <span className="font-semibold text-foreground">{form.name}</span> to confirm deletion:
              </p>
              <input
                autoFocus
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={form.name}
                className="w-full h-9 text-sm rounded-lg border border-input bg-background px-3 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && deleteConfirmName === form.name) handleDeleteEvent();
                  if (e.key === "Escape") setShowDeleteModal(false);
                }}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded-xl px-4 py-2 text-sm font-medium border border-border hover:bg-muted transition-colors">
                Cancel
              </button>
              <button
                onClick={handleDeleteEvent}
                disabled={deleteConfirmName !== form.name || isDeleting}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: deleteConfirmName === form.name && !isDeleting
                    ? "hsl(0 72% 51%)"
                    : "hsl(0 72% 51% / 0.5)",
                  color: "white",
                }}
              >
                {isDeleting
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…</>
                  : <><Trash2 className="h-3.5 w-3.5" /> Delete permanently</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
