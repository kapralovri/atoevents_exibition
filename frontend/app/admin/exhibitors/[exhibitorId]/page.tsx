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
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Sidebar } from "@/components/sidebar";

interface Exhibitor {
  id: string;
  company_name: string;
  email: string;
  booth_type: string;
  booth_config: string;
  booth_size: number;
  overall_status: string;
  graphics_status: string;
  description_status: string;
  participants_status: string;
  gdpr_accepted: boolean;
  company_description?: string;
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
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [exhibitorData, graphicsData] = await Promise.all([
          apiFetch<Exhibitor>(`/admin/exhibitors/${exhibitorId}`),
          apiFetch<GraphicElement[]>(`/admin/exhibitors/${exhibitorId}/graphics`),
        ]);
        setExhibitor(exhibitorData);
        setGraphics(graphicsData);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    }
    fetchData();
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

  if (!exhibitor) {
    return (
      <div className="flex h-screen" style={{ background: "hsl(213 25% 97%)" }}>
        <Sidebar userRole="admin" />
        <main className="flex-1 ml-64 overflow-auto flex items-center justify-center">
          <span
            className="h-5 w-5 rounded-full border-2 border-t-transparent animate-spin"
            style={{
              borderColor: "hsl(209 65% 21% / 0.2)",
              borderTopColor: "hsl(209 65% 21%)",
            }}
          />
        </main>
      </div>
    );
  }

  const underReview = graphics.filter((g) => g.status === "under_review");
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
    <div className="flex h-screen" style={{ background: "hsl(213 25% 97%)" }}>
      <Sidebar userRole="admin" />
      <main className="flex-1 ml-64 overflow-auto">
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
                  {underReview.length > 0 && (
                    <span
                      className="flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1"
                      style={{
                        background: "hsl(45 100% 94%)",
                        color: "hsl(45 80% 30%)",
                        border: "1px solid hsl(45 80% 82%)",
                      }}
                    >
                      <Clock className="h-3 w-3" />
                      {underReview.length} pending review
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
                status: exhibitor.description_status,
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
                        <div
                          className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 w-fit"
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
        </div>
      </main>
    </div>
  );
}
