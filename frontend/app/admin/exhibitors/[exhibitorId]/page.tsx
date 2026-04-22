"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Unlock,
  Mail,
  FileImage,
  FileText,
  Users,
  CheckCircle2,
  XCircle,
  Building2,
  LayoutGrid,
  Maximize2,
  ShieldCheck,
  AlertCircle,
  Clock,
  Send,
  Download,
  Globe,
  ImageIcon,
  Pencil,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface Participant {
  id: number;
  full_name: string;
  job_title: string;
  email: string;
  phone: string;
  badge_type?: string | null;
}

interface Exhibitor {
  id: string;
  company_name: string;
  email: string;
  booth_type: string;
  booth_config: string;
  booth_size: number;
  stand_package?: string;
  stand_configuration?: string;
  area_m2?: number;
  stand_inventory_id?: string;
  event_id?: number;
  overall_status: string;
  graphics_status: string;
  description_status?: string;
  company_status?: string;
  participants_status: string;
  gdpr_accepted: boolean;
  company_description?: string;
  website?: string;
  logo_url?: string;
  participants?: Participant[];
}

interface GraphicElement {
  id: string;
  name: string;
  label: string;
  required: boolean;
  status: string;
  file_name?: string;
  file_size?: number;
  uploaded_at?: string;
  admin_comment?: string;
  download_url?: string;
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "N/A";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
};

export default function AdminExhibitorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const exhibitorId = params.exhibitorId as string;

  const [exhibitor, setExhibitor] = useState<Exhibitor | null>(null);
  const [graphics, setGraphics] = useState<GraphicElement[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [taskComments, setTaskComments] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Edit stand state
  const [showEditStand, setShowEditStand] = useState(false);
  const [editStand, setEditStand] = useState({ stand_inventory_id: "", stand_package: "BESPOKE", stand_configuration: "LINEAR", area_m2: 9, is_custom: false });
  const [eventInventory, setEventInventory] = useState<{ id: string; package: string; area_m2: number; configuration: string; total: number; booked: number; available: number; is_full: boolean }[]>([]);
  const [isSavingStand, setIsSavingStand] = useState(false);

  // Final stand PDF (admin uploads)
  const [finalPdf, setFinalPdf] = useState<{ url: string | null; filename: string | null; uploaded_at: string | null }>({ url: null, filename: null, uploaded_at: null });
  const [finalPdfUploading, setFinalPdfUploading] = useState(false);
  const [finalPdfProgress, setFinalPdfProgress] = useState(0);

  const refreshFinalPdf = async () => {
    try {
      const data = await apiFetch<{ url: string | null; filename: string | null; uploaded_at: string | null }>(
        `/admin/exhibitors/${exhibitorId}/final-pdf`
      );
      setFinalPdf(data);
    } catch { /* ignore */ }
  };

  const handleFinalPdfUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are accepted");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast.error("PDF exceeds 100 MB limit");
      return;
    }
    setFinalPdfUploading(true);
    setFinalPdfProgress(0);
    try {
      const { upload_url, s3_key } = await apiFetch<{ upload_url: string; s3_key: string }>(
        `/admin/exhibitors/${exhibitorId}/final-pdf/presign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exhibitor_id: Number(exhibitorId), filename: file.name, content_type: "application/pdf" }),
        }
      );
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setFinalPdfProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener("load", () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))));
        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.open("PUT", upload_url);
        xhr.setRequestHeader("Content-Type", "application/pdf");
        xhr.send(file);
      });
      await apiFetch(`/admin/exhibitors/${exhibitorId}/final-pdf/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exhibitor_id: Number(exhibitorId), s3_key, filename: file.name }),
      });
      toast.success("Final stand PDF attached");
      await refreshFinalPdf();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setFinalPdfUploading(false);
      setFinalPdfProgress(0);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const [exhibitorData, graphicsData] = await Promise.all([
          apiFetch<Exhibitor>(`/admin/exhibitors/${exhibitorId}`),
          apiFetch<GraphicElement[]>(`/admin/exhibitors/${exhibitorId}/graphics`),
        ]);
        setExhibitor(exhibitorData);
        setGraphics(graphicsData);
        refreshFinalPdf();
        // Pre-load event inventory for stand editing
        if (exhibitorData.event_id) {
          try {
            const inv = await apiFetch<typeof eventInventory>(`/admin/events/${exhibitorData.event_id}/stand-availability`);
            setEventInventory(inv);
          } catch { /* no inventory configured */ }
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    }
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exhibitorId]);

  const refreshGraphics = async () => {
    const data = await apiFetch<GraphicElement[]>(
      `/admin/exhibitors/${exhibitorId}/graphics`
    );
    setGraphics(data);
  };

  const handleUnlock = async () => {
    try {
      await apiFetch(`/admin/exhibitors/${exhibitorId}/unlock`, { method: "POST" });
      toast.success("Exhibitor unlocked");
      const data = await apiFetch<Exhibitor>(`/admin/exhibitors/${exhibitorId}`);
      setExhibitor(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unlock");
    }
  };

  const handleApprove = async (elementId: string) => {
    setActionLoading(`approve-${elementId}`);
    try {
      await apiFetch(`/admin/graphics/${elementId}/approve`, { method: "POST" });
      toast.success("Graphics approved");
      await refreshGraphics();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestRevision = async (elementId: string) => {
    const comment = comments[elementId] || "";
    if (!comment.trim()) {
      toast.error("Please provide a comment for the revision request");
      return;
    }
    setActionLoading(`revision-${elementId}`);
    try {
      await apiFetch(`/admin/graphics/${elementId}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      toast.success("Revision requested");
      setComments((prev) => ({ ...prev, [elementId]: "" }));
      await refreshGraphics();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to request revision"
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendReminder = async () => {
    try {
      await apiFetch(`/admin/exhibitors/${exhibitorId}/reminder`, { method: "POST" });
      toast.success("Reminder sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send reminder");
    }
  };

  const handleApproveTask = async (taskKey: "company_status" | "participants_status") => {
    const loadingKey = `approve-task-${taskKey}`;
    setActionLoading(loadingKey);
    try {
      await apiFetch(`/admin/exhibitors/${exhibitorId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [taskKey]: "approved" }),
      });
      toast.success("Task approved");
      const data = await apiFetch<Exhibitor>(`/admin/exhibitors/${exhibitorId}`);
      setExhibitor(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevisionTask = async (taskKey: "company_status" | "participants_status") => {
    const comment = taskComments[taskKey] || "";
    if (!comment.trim()) {
      toast.error("Please provide a reason for sending to revision");
      return;
    }
    const loadingKey = `revision-task-${taskKey}`;
    setActionLoading(loadingKey);
    try {
      await apiFetch(`/admin/exhibitors/${exhibitorId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [taskKey]: "needs_revision", comment }),
      });
      toast.success("Sent for revision");
      setTaskComments((prev) => ({ ...prev, [taskKey]: "" }));
      const data = await apiFetch<Exhibitor>(`/admin/exhibitors/${exhibitorId}`);
      setExhibitor(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to request revision");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveStand = async () => {
    setIsSavingStand(true);
    try {
      const payload = editStand.is_custom
        ? { stand_package: editStand.stand_package, stand_configuration: editStand.stand_configuration, area_m2: editStand.area_m2 }
        : { stand_inventory_id: editStand.stand_inventory_id };
      await apiFetch(`/admin/exhibitors/${exhibitorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("Stand configuration updated");
      const data = await apiFetch<Exhibitor>(`/admin/exhibitors/${exhibitorId}`);
      setExhibitor(data);
      setShowEditStand(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update stand");
    } finally {
      setIsSavingStand(false);
    }
  };

  if (!exhibitor) {
    return (
      <div className="flex h-full items-center justify-center">
        <span
          className="h-5 w-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{
            borderColor: "hsl(209 65% 21% / 0.2)",
            borderTopColor: "hsl(209 65% 21%)",
          }}
        />
      </div>
    );
  }

  const underReview = graphics.filter((g) => g.status === "under_review");
  const descStatus = (exhibitor.description_status ?? exhibitor.company_status ?? "").toLowerCase();
  const partStatus = (exhibitor.participants_status ?? "").toLowerCase();
  const totalPendingReview =
    underReview.length +
    (descStatus === "under_review" ? 1 : 0) +
    (partStatus === "submitted" || partStatus === "under_review" ? 1 : 0);
  const boothMeta = [
    { icon: Building2, label: "Booth Type", value: exhibitor.booth_type.replace("_", " ") },
    { icon: LayoutGrid, label: "Config", value: exhibitor.booth_config },
    { icon: Maximize2, label: "Size", value: `${exhibitor.booth_size} m²` },
    {
      icon: ShieldCheck,
      label: "GDPR",
      value: exhibitor.gdpr_accepted ? "Accepted" : "Pending",
      color: exhibitor.gdpr_accepted ? "hsl(154 60% 35%)" : "hsl(45 80% 30%)",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6 animate-fade-up">

          {/* ── Header ───────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                onClick={() => router.back()}
                className="mt-1 h-8 w-8 rounded-lg flex items-center justify-center transition-colors shrink-0"
                style={{ color: "hsl(213 15% 55%)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "hsl(209 65% 21% / 0.08)";
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
                <h1 className="page-title">{exhibitor.company_name}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {exhibitor.email}
                  </span>
                  <StatusBadge status={exhibitor.overall_status} />
                  {totalPendingReview > 0 && (
                    <span
                      className="flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1"
                      style={{
                        background: "hsl(45 100% 94%)",
                        color: "hsl(45 80% 30%)",
                        border: "1px solid hsl(45 80% 82%)",
                      }}
                    >
                      <Clock className="h-3 w-3" />
                      {totalPendingReview} pending review
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleSendReminder}
              >
                <Send className="h-3.5 w-3.5" />
                Remind
              </Button>
              {exhibitor.overall_status === "locked" && (
                <Button size="sm" className="gap-2" onClick={handleUnlock}>
                  <Unlock className="h-3.5 w-3.5" />
                  Unlock
                </Button>
              )}
            </div>
          </div>

          {/* ── Booth meta ───────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-4">
              {boothMeta.map(({ icon: Icon, label, value, color }) => (
                <Card key={label} className="card-elevated">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p
                      className="text-base font-bold capitalize"
                      style={color ? { color } : undefined}
                    >
                      {value}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Edit stand button */}
            {!showEditStand && (
              <button
                onClick={() => {
                  setEditStand({
                    stand_inventory_id: exhibitor.stand_inventory_id ?? "",
                    stand_package: exhibitor.stand_package ?? "BESPOKE",
                    stand_configuration: exhibitor.stand_configuration ?? "LINEAR",
                    area_m2: exhibitor.area_m2 ?? exhibitor.booth_size ?? 9,
                    is_custom: !exhibitor.stand_inventory_id,
                  });
                  setShowEditStand(true);
                }}
                className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                style={{ color: "hsl(209 65% 38%)" }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit stand configuration
              </button>
            )}

            {/* Inline edit stand form */}
            {showEditStand && (
              <Card className="card-elevated animate-fade-up" style={{ borderColor: "hsl(209 65% 21% / 0.2)" }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Edit Stand Configuration</span>
                    <button onClick={() => setShowEditStand(false)} style={{ color: "hsl(213 15% 55%)" }}>
                      <X className="h-4 w-4" />
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Toggle: inventory vs custom */}
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={!editStand.is_custom}
                        onChange={() => setEditStand(s => ({ ...s, is_custom: false }))}
                      />
                      From inventory
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={editStand.is_custom}
                        onChange={() => setEditStand(s => ({ ...s, is_custom: true }))}
                      />
                      Custom (INDIVIDUAL)
                    </label>
                  </div>

                  {!editStand.is_custom ? (
                    eventInventory.length > 0 ? (
                      <select
                        value={editStand.stand_inventory_id}
                        onChange={e => setEditStand(s => ({ ...s, stand_inventory_id: e.target.value }))}
                        className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(209_65%_21%)]"
                      >
                        <option value="">— Select —</option>
                        {eventInventory.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.package.replace("_", " ")} {item.area_m2}m² {item.configuration} ({item.available} available)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-muted-foreground">No inventory configured for this event.</p>
                    )
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Package</Label>
                        <select
                          value={editStand.stand_package}
                          onChange={e => setEditStand(s => ({ ...s, stand_package: e.target.value }))}
                          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                        >
                          <option value="SHELL_ONLY">START</option>
                          <option value="SYSTEM">PRO</option>
                          <option value="BESPOKE">INDIVIDUAL</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Configuration</Label>
                        <select
                          value={editStand.stand_configuration}
                          onChange={e => setEditStand(s => ({ ...s, stand_configuration: e.target.value }))}
                          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                        >
                          {["LINEAR","ANGULAR","PENINSULA","ISLAND"].map(c => (
                            <option key={c} value={c}>{c.charAt(0)+c.slice(1).toLowerCase()}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Area (m²)</Label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={editStand.area_m2}
                          onChange={e => setEditStand(s => ({ ...s, area_m2: parseFloat(e.target.value) || 9 }))}
                          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Button size="sm" onClick={handleSaveStand} disabled={isSavingStand} className="gap-2">
                      {isSavingStand ? <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : null}
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowEditStand(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Submission status row ────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: FileImage,
                label: "Graphics",
                status: exhibitor.graphics_status,
              },
              {
                icon: FileText,
                label: "Description",
                status: descStatus,
                extra: exhibitor.company_description,
              },
              {
                icon: Users,
                label: "Participants",
                status: exhibitor.participants_status,
              },
            ].map(({ icon: Icon, label, status, extra }) => (
              <Card key={label} className="card-elevated">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <StatusBadge status={status} />
                  {extra && (
                    <p className="text-xs text-muted-foreground line-clamp-3 mt-1">
                      {extra}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Graphics review ──────────────────────────────────── */}
          <Card className="card-elevated">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileImage className="h-4 w-4" style={{ color: "hsl(209 65% 38%)" }} />
                  Graphics Review
                </CardTitle>
                {underReview.length > 0 && (
                  <CardDescription>{underReview.length} pending</CardDescription>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {graphics.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center"
                    style={{ background: "hsl(209 65% 21% / 0.07)" }}
                  >
                    <FileImage className="h-6 w-6" style={{ color: "hsl(209 65% 38%)" }} />
                  </div>
                  <p className="text-sm text-muted-foreground">No graphics uploaded yet</p>
                </div>
              )}

              {graphics.map((element) => (
                <div
                  key={element.id}
                  className="rounded-xl border p-4 space-y-3"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  {/* Element header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                        {element.label}
                        {element.required && (
                          <span
                            className="text-[10px] font-bold rounded px-1.5 py-0.5 uppercase tracking-wide"
                            style={{
                              background: "hsl(209 65% 21% / 0.08)",
                              color: "hsl(209 65% 28%)",
                            }}
                          >
                            Required
                          </span>
                        )}
                      </p>
                      {element.file_name && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <div
                            className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5"
                            style={{
                              background: "hsl(213 20% 95%)",
                              color: "hsl(213 15% 45%)",
                            }}
                          >
                            <FileImage className="h-3 w-3 shrink-0" />
                            <span className="font-medium truncate max-w-[200px]">
                              {element.file_name}
                            </span>
                            <span>·</span>
                            <span className="shrink-0">{formatFileSize(element.file_size)}</span>
                            {element.uploaded_at && (
                              <>
                                <span>·</span>
                                <span className="shrink-0">
                                  {new Date(element.uploaded_at).toLocaleDateString("en-GB")}
                                </span>
                              </>
                            )}
                          </div>
                          {element.download_url && (
                            <a
                              href={element.download_url}
                              download={element.file_name}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-xs font-semibold rounded-lg px-2.5 py-1.5"
                              style={{
                                background: "hsl(209 65% 21% / 0.07)",
                                color: "hsl(209 65% 28%)",
                                border: "1px solid hsl(209 65% 21% / 0.15)",
                                transition: "background-color 120ms cubic-bezier(0.23,1,0.32,1)",
                                textDecoration: "none",
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.background = "hsl(209 65% 21% / 0.13)";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.background = "hsl(209 65% 21% / 0.07)";
                              }}
                            >
                              <Download className="h-3 w-3" />
                              Download
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <StatusBadge status={element.status} />
                  </div>

                  {/* Previous revision comment */}
                  {element.admin_comment && element.status !== "under_review" && (
                    <div
                      className="flex items-start gap-2 rounded-lg p-2.5 text-xs"
                      style={{
                        background: "hsl(213 20% 96%)",
                        color: "hsl(213 15% 45%)",
                      }}
                    >
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>Previous comment: {element.admin_comment}</span>
                    </div>
                  )}

                  {/* Review actions */}
                  {element.status === "under_review" && (
                    <div
                      className="space-y-3 pt-3"
                      style={{ borderTop: "1px solid hsl(var(--border))" }}
                    >
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Revision Comment
                        </Label>
                        <Textarea
                          placeholder="Describe what needs to be corrected…"
                          rows={2}
                          className="resize-none text-sm"
                          value={comments[element.id] || ""}
                          onChange={(e) =>
                            setComments((prev) => ({
                              ...prev,
                              [element.id]: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="gap-2"
                          onClick={() => handleApprove(element.id)}
                          disabled={actionLoading === `approve-${element.id}`}
                        >
                          {actionLoading === `approve-${element.id}` ? (
                            <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-2"
                          onClick={() => handleRequestRevision(element.id)}
                          disabled={
                            actionLoading === `revision-${element.id}` ||
                            !(comments[element.id] || "").trim()
                          }
                        >
                          {actionLoading === `revision-${element.id}` ? (
                            <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          Request Revision
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Approved state */}
                  {element.status === "approved" && (
                    <div
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
                      style={{
                        background: "hsl(154 80% 94%)",
                        color: "hsl(154 60% 28%)",
                        border: "1px solid hsl(154 60% 82%)",
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      Approved
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── Final stand PDF (admin attaches after review) ─────── */}
          <Card className="card-elevated">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" style={{ color: "hsl(154 70% 30%)" }} />
                    Final Stand Visualization (PDF)
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    Upload the final PDF showing how the stand will look. The exhibitor will see it inline before signing.
                  </CardDescription>
                </div>
                {finalPdf.url && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ background: "hsl(154 80% 94%)", color: "hsl(154 60% 26%)", border: "1px solid hsl(154 60% 78%)" }}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Attached
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {finalPdf.url && (
                <div
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                  style={{ background: "hsl(210 18% 96%)", border: "1px solid hsl(var(--border))" }}
                >
                  <FileText className="h-4 w-4 shrink-0" style={{ color: "hsl(154 70% 30%)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: "hsl(209 65% 22%)" }}>
                      {finalPdf.filename ?? "stand.pdf"}
                    </p>
                    {finalPdf.uploaded_at && (
                      <p className="text-[10px] mt-0.5" style={{ color: "hsl(210 12% 50%)" }}>
                        Uploaded {new Date(finalPdf.uploaded_at).toLocaleString("en-GB")}
                      </p>
                    )}
                  </div>
                  <a
                    href={finalPdf.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5"
                    style={{
                      background: "hsl(209 65% 21% / 0.08)",
                      color: "hsl(209 65% 28%)",
                      border: "1px solid hsl(209 65% 21% / 0.15)",
                    }}
                  >
                    <Download className="h-3 w-3" />
                    View
                  </a>
                </div>
              )}
              <div>
                <input
                  type="file"
                  id="final-pdf-upload"
                  className="hidden"
                  accept=".pdf,application/pdf"
                  disabled={finalPdfUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFinalPdfUpload(f);
                    e.target.value = "";
                  }}
                />
                <label
                  htmlFor="final-pdf-upload"
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-5 cursor-pointer text-center transition-all duration-200"
                  style={{
                    borderColor: finalPdfUploading ? "hsl(154 100% 49%)" : "hsl(var(--border))",
                    background: finalPdfUploading ? "hsl(154 100% 49% / 0.05)" : "hsl(213 20% 98%)",
                  }}
                >
                  {finalPdfUploading ? (
                    <div className="w-full space-y-2 py-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span style={{ color: "hsl(154 60% 35%)" }}>Uploading…</span>
                        <span style={{ color: "hsl(154 60% 35%)" }}>{finalPdfProgress}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(154 100% 49% / 0.15)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${finalPdfProgress}%`,
                            background: "hsl(154 100% 49%)",
                            transition: "width 80ms linear",
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <FileText className="h-6 w-6" style={{ color: "hsl(209 65% 38%)" }} />
                      <p className="text-sm font-semibold text-foreground">
                        {finalPdf.url ? "Replace final stand PDF" : "Upload final stand PDF"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">PDF only · max 100 MB</p>
                    </>
                  )}
                </label>
              </div>
            </CardContent>
          </Card>

          {/* ── Description review ───────────────────────────────── */}
          {(descStatus === "under_review" ||
            descStatus === "approved" ||
            descStatus === "needs_revision" ||
            descStatus === "submitted") && (
            <Card className="card-elevated">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" style={{ color: "hsl(209 65% 38%)" }} />
                  Description Review
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Website + Logo row */}
                {(exhibitor.website || exhibitor.logo_url) && (
                  <div className="flex flex-wrap items-center gap-3">
                    {exhibitor.website && (
                      <a
                        href={exhibitor.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-medium transition-colors"
                        style={{ color: "hsl(209 65% 38%)" }}
                      >
                        <Globe className="h-3.5 w-3.5 shrink-0" />
                        {exhibitor.website}
                      </a>
                    )}
                    {exhibitor.logo_url && (
                      <a
                        href={exhibitor.logo_url}
                        download
                        className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
                        style={{
                          background: "hsl(209 65% 21% / 0.08)",
                          color: "hsl(209 65% 28%)",
                          border: "1px solid hsl(209 65% 21% / 0.15)",
                        }}
                      >
                        <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                        Download Logo
                      </a>
                    )}
                  </div>
                )}

                {exhibitor.company_description ? (
                  <div
                    className="rounded-xl p-4 text-sm leading-relaxed"
                    style={{
                      background: "hsl(213 20% 96%)",
                      color: "hsl(213 15% 35%)",
                      border: "1px solid hsl(213 20% 90%)",
                    }}
                  >
                    {exhibitor.company_description}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No description provided.</p>
                )}

                {(descStatus === "under_review" || descStatus === "submitted") && (
                  <div
                    className="space-y-3 pt-3"
                    style={{ borderTop: "1px solid hsl(var(--border))" }}
                  >
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Revision Reason
                      </Label>
                      <Textarea
                        placeholder="Describe what needs to be corrected…"
                        rows={2}
                        className="resize-none text-sm"
                        value={taskComments["company_status"] || ""}
                        onChange={(e) =>
                          setTaskComments((prev) => ({
                            ...prev,
                            company_status: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() => handleApproveTask("company_status")}
                        disabled={actionLoading === "approve-task-company_status"}
                      >
                        {actionLoading === "approve-task-company_status" ? (
                          <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-2"
                        onClick={() => handleRevisionTask("company_status")}
                        disabled={
                          actionLoading === "revision-task-company_status" ||
                          !(taskComments["company_status"] || "").trim()
                        }
                      >
                        {actionLoading === "revision-task-company_status" ? (
                          <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        Send for Revision
                      </Button>
                    </div>
                  </div>
                )}

                {(descStatus === "approved") && (
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
                    style={{
                      background: "hsl(154 80% 94%)",
                      color: "hsl(154 60% 28%)",
                      border: "1px solid hsl(154 60% 82%)",
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Approved
                  </div>
                )}

                {descStatus === "needs_revision" && (
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
                    style={{
                      background: "hsl(0 80% 97%)",
                      color: "hsl(0 65% 40%)",
                      border: "1px solid hsl(0 60% 88%)",
                    }}
                  >
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    Sent for revision
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Participants review ──────────────────────────────── */}
          {(partStatus === "submitted" ||
            partStatus === "under_review" ||
            partStatus === "approved" ||
            partStatus === "needs_revision") && (
            <Card className="card-elevated">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" style={{ color: "hsl(209 65% 38%)" }} />
                  Participants Review
                  {exhibitor.participants && (
                    <span className="ml-auto text-xs font-normal text-muted-foreground">
                      {exhibitor.participants.length} registered
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Participants list */}
                {exhibitor.participants && exhibitor.participants.length > 0 ? (
                  <div className="divide-y rounded-xl overflow-hidden border" style={{ borderColor: "hsl(var(--border))" }}>
                    {/* header */}
                    <div
                      className="grid grid-cols-[2fr_1fr_2fr_1fr] gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "hsl(213 15% 55%)", background: "hsl(213 20% 97%)" }}
                    >
                      <span>Name</span>
                      <span>Title</span>
                      <span>Email</span>
                      <span>Badge</span>
                    </div>
                    {exhibitor.participants.map((p) => (
                      <div
                        key={p.id}
                        className="grid grid-cols-[2fr_1fr_2fr_1fr] gap-3 px-4 py-3 text-sm items-center"
                      >
                        <span className="font-medium">{p.full_name}</span>
                        <span className="text-muted-foreground truncate">{p.job_title}</span>
                        <span className="text-muted-foreground truncate">{p.email}</span>
                        <span>
                          {p.badge_type && (
                            <span
                              className="text-[10px] rounded px-1.5 py-0.5 font-semibold"
                              style={p.badge_type === "COMPLIMENTARY"
                                ? { background: "hsl(154 100% 49% / 0.12)", color: "hsl(154 60% 35%)" }
                                : { background: "hsl(45 100% 90%)", color: "hsl(45 80% 30%)" }}
                            >
                              {p.badge_type === "COMPLIMENTARY" ? "Comp." : "Add."}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Participant list submitted by the exhibitor.
                  </p>
                )}

                {(partStatus === "submitted" || partStatus === "under_review") && (
                  <div
                    className="space-y-3 pt-3"
                    style={{ borderTop: "1px solid hsl(var(--border))" }}
                  >
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Revision Reason
                      </Label>
                      <Textarea
                        placeholder="Describe what needs to be corrected…"
                        rows={2}
                        className="resize-none text-sm"
                        value={taskComments["participants_status"] || ""}
                        onChange={(e) =>
                          setTaskComments((prev) => ({
                            ...prev,
                            participants_status: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() => handleApproveTask("participants_status")}
                        disabled={actionLoading === "approve-task-participants_status"}
                      >
                        {actionLoading === "approve-task-participants_status" ? (
                          <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-2"
                        onClick={() => handleRevisionTask("participants_status")}
                        disabled={
                          actionLoading === "revision-task-participants_status" ||
                          !(taskComments["participants_status"] || "").trim()
                        }
                      >
                        {actionLoading === "revision-task-participants_status" ? (
                          <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        Send for Revision
                      </Button>
                    </div>
                  </div>
                )}

                {partStatus === "approved" && (
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
                    style={{
                      background: "hsl(154 80% 94%)",
                      color: "hsl(154 60% 28%)",
                      border: "1px solid hsl(154 60% 82%)",
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Approved
                  </div>
                )}

                {partStatus === "needs_revision" && (
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
                    style={{
                      background: "hsl(0 80% 97%)",
                      color: "hsl(0 65% 40%)",
                      border: "1px solid hsl(0 60% 88%)",
                    }}
                  >
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    Sent for revision
                  </div>
                )}
              </CardContent>
            </Card>
          )}
    </div>
  );
}
