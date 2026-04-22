"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  FileText, Save, Send, CheckCircle2, Info,
  ImagePlus, X, MessageSquare, Lock, Loader2, Eye,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

const MAX_CHARS = 1000;

// ── Request Changes Modal ────────────────────────────────────────────────────
function RequestModal({
  exhibitorId,
  onClose,
}: {
  exhibitorId: number;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!message.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/portal/exhibitors/${exhibitorId}/change-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "company", message: message.trim() }),
      });
      toast.success("Request sent — ATO COMM will review it shortly.");
      onClose();
    } catch {
      toast.error("Failed to send request");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8,14,26,0.78)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden animate-fade-up"
        style={{
          background: "hsl(209 65% 14%)",
          border: "1px solid hsl(209 65% 28% / 0.4)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: "linear-gradient(90deg, hsl(45 96% 48%), hsl(30 90% 55%), transparent)" }}
        />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-7 w-7 rounded-lg flex items-center justify-center"
          style={{ color: "hsl(210 30% 55%)" }}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pt-7 pb-5">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "hsl(45 96% 48% / 0.12)", border: "1px solid hsl(45 96% 48% / 0.25)" }}
            >
              <MessageSquare className="h-4 w-4" style={{ color: "hsl(45 96% 48%)" }} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Request Changes</h2>
              <p className="text-xs mt-0.5" style={{ color: "hsl(210 30% 55%)" }}>Company Description section</p>
            </div>
          </div>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe what you need to change or update…"
            rows={5}
            className="resize-none text-sm"
            style={{
              background: "hsl(209 65% 10% / 0.7)",
              border: "1px solid hsl(209 65% 28% / 0.35)",
              color: "#e8e8e8",
            }}
          />
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={send}
            disabled={sending || !message.trim()}
            className="flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, hsl(45 96% 48%), hsl(35 90% 42%))",
              color: "hsl(209 65% 10%)",
              opacity: sending || !message.trim() ? 0.6 : 1,
            }}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Request
          </button>
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-xl text-sm font-medium"
            style={{
              background: "hsl(209 65% 21% / 0.4)",
              color: "hsl(210 30% 62%)",
              border: "1px solid hsl(209 65% 30% / 0.4)",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function DescriptionPage() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string>("not_submitted");
  const [adminComment, setAdminComment] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [exhibitorId, setExhibitorId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showRequest, setShowRequest] = useState(false);

  // Website state
  const [website, setWebsite] = useState("");

  // Logo state
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoS3Key, setLogoS3Key] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const ex = await apiFetch<{
          id: number;
          description: string;
          description_status: string;
          company_admin_comment?: string;
          section_company_locked?: boolean;
        }>("/portal/me/exhibitor");
        setExhibitorId(ex.id);
        setDescription(ex.description || "");
        setStatus(ex.description_status || "not_submitted");
        setAdminComment(ex.company_admin_comment || null);
        setIsLocked(!!ex.section_company_locked);

        // Load company profile (logo + website)
        try {
          const cp = await apiFetch<{ logo_s3_key?: string; website?: string }>(`/portal/exhibitors/${ex.id}/company`);
          if (cp.logo_s3_key) {
            setLogoS3Key(cp.logo_s3_key);
          }
          if (cp.website) {
            setWebsite(cp.website);
          }
        } catch {}
      } catch {
        toast.error("Failed to load description");
      }
    }
    fetchData();
  }, []);

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5 MB");
      return;
    }
    setIsUploadingLogo(true);
    try {
      const { upload_url, s3_key } = await apiFetch<{ upload_url: string; s3_key: string }>(
        "/portal/me/exhibitor/logo/presign",
        { method: "POST" }
      );
      await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      // Save s3_key
      await apiFetch("/portal/me/exhibitor/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_s3_key: s3_key }),
      });
      setLogoS3Key(s3_key);
      setLogoUrl(URL.createObjectURL(file));
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiFetch("/portal/me/exhibitor/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_description: description, website }),
      });
      setSavedAt(new Date());
      toast.success("Draft saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await apiFetch("/portal/me/exhibitor/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_description: description, website }),
      });
      await apiFetch("/portal/me/exhibitor/description/submit", { method: "POST" });
      setStatus("UNDER_REVIEW");
      toast.success("Description submitted — under review");
      router.push("/tasks");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const charCount     = description.length;
  const charPercent   = Math.min((charCount / MAX_CHARS) * 100, 100);
  const isNearLimit   = charCount > MAX_CHARS * 0.85;
  const isOverLimit   = charCount > MAX_CHARS;
  const isUnderReview = status === "UNDER_REVIEW";
  const isApproved    = status === "APPROVED";
  // canEdit: not locked by admin, not under review, not approved
  const canEdit     = !isLocked && !isUnderReview && !isApproved;
  const canSubmit   = !isSubmitting && !isOverLimit && canEdit && description.trim().length > 0;

  return (
    <div className="space-y-6 animate-fade-up max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="page-title">Company Description</h1>
        <p className="page-description">
          This text will appear in the official exhibition catalogue.
        </p>
      </div>

      {/* Admin-locked banner */}
      {isLocked && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium"
          style={{
            background: "hsl(45 96% 48% / 0.08)",
            border: "1px solid hsl(45 96% 48% / 0.25)",
            color: "hsl(45 80% 35%)",
          }}
        >
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 shrink-0" />
            <span>This section is locked. Contact ATO COMM to request changes.</span>
          </div>
          {exhibitorId && (
            <button
              onClick={() => setShowRequest(true)}
              className="shrink-0 h-8 px-3 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: "hsl(45 96% 48% / 0.15)",
                color: "hsl(45 80% 35%)",
                border: "1px solid hsl(45 96% 48% / 0.3)",
              }}
            >
              Request Changes
            </button>
          )}
        </div>
      )}

      {/* Under review banner */}
      {isUnderReview && !isLocked && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium animate-fade-up"
          style={{
            background: "hsl(209 65% 21% / 0.07)",
            border: "1px solid hsl(209 65% 21% / 0.2)",
            color: "hsl(209 65% 28%)",
          }}
        >
          <Eye className="h-5 w-5 shrink-0" />
          Your description has been submitted and is under review. Editing is disabled until reviewed.
        </div>
      )}

      {/* Approved banner */}
      {isApproved && !isLocked && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium animate-fade-up"
          style={{
            background: "hsl(154 80% 94%)",
            border: "1px solid hsl(154 60% 82%)",
            color: "hsl(154 60% 28%)",
          }}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          Your description has been approved.
        </div>
      )}

      {/* Admin comment (revision note) */}
      {adminComment && (
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
          style={{
            background: "hsl(0 72% 51% / 0.06)",
            border: "1px solid hsl(0 72% 51% / 0.2)",
          }}
        >
          <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(0 72% 51%)" }} />
          <div>
            <p className="font-medium text-xs uppercase tracking-wide mb-1" style={{ color: "hsl(0 60% 45%)" }}>
              Revision note from ATO COMM
            </p>
            <p style={{ color: "hsl(0 30% 35%)" }}>{adminComment}</p>
          </div>
        </div>
      )}

      {/* Guideline */}
      <div
        className="flex items-start gap-3 rounded-xl p-4 text-sm"
        style={{
          background: "hsl(209 65% 21% / 0.06)",
          border: "1px solid hsl(209 65% 21% / 0.12)",
        }}
      >
        <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(209 65% 38%)" }} />
        <p style={{ color: "hsl(209 50% 30%)" }}>
          Write a concise description of your company, products and services.
          Maximum <strong>{MAX_CHARS} characters</strong>. You can save a draft before submitting.
        </p>
      </div>

      {/* Logo upload card */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ImagePlus className="h-4 w-4" style={{ color: "hsl(209 65% 38%)" }} />
            Company Logo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleLogoUpload(f);
              e.target.value = "";
            }}
          />
          {logoUrl || logoS3Key ? (
            <div className="flex items-center gap-4">
              <div
                className="h-20 w-20 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
                style={{ background: "hsl(209 65% 21% / 0.1)", border: "1px solid hsl(209 65% 28% / 0.2)" }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain p-1" />
                ) : (
                  <ImagePlus className="h-8 w-8" style={{ color: "hsl(209 65% 38%)" }} />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">Logo uploaded</p>
                <p className="text-xs text-muted-foreground">
                  {logoS3Key?.split("/").pop() ?? "logo.png"}
                </p>
                {!isLocked && (
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    className="text-xs font-medium transition-colors"
                    style={{ color: "hsl(209 65% 38%)" }}
                  >
                    Replace logo
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => !isLocked && logoInputRef.current?.click()}
              disabled={isUploadingLogo || isLocked}
              className="w-full flex flex-col items-center gap-3 rounded-xl border-2 border-dashed py-8 transition-all duration-200"
              style={{
                borderColor: "hsl(var(--border))",
                color: "hsl(213 15% 50%)",
                cursor: isLocked ? "not-allowed" : "pointer",
                opacity: isLocked ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (isLocked) return;
                (e.currentTarget as HTMLElement).style.borderColor = "hsl(209 65% 21% / 0.3)";
                (e.currentTarget as HTMLElement).style.background = "hsl(209 65% 21% / 0.03)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "";
                (e.currentTarget as HTMLElement).style.background = "";
              }}
            >
              {isUploadingLogo ? (
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(209 65% 38%)" }} />
              ) : (
                <ImagePlus className="h-8 w-8" style={{ color: "hsl(209 65% 38%)" }} />
              )}
              <div className="text-center">
                <p className="text-sm font-medium">
                  {isUploadingLogo ? "Uploading…" : "Click to upload logo"}
                </p>
                <p className="text-xs mt-0.5 text-muted-foreground">PNG, JPG or SVG · max 5 MB</p>
              </div>
            </button>
          )}
        </CardContent>
      </Card>

      {/* Description text card */}
      <Card className="card-elevated">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" style={{ color: "hsl(209 65% 38%)" }} />
              Description Text
            </CardTitle>
            <StatusBadge status={status} />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description" className="text-sm font-medium text-foreground">
                Company Description
              </Label>
              {savedAt && canEdit && (
                <span className="text-xs text-muted-foreground">
                  Saved {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your company — what you do, your key products, services, and areas of expertise in the aviation MRO industry…"
              rows={9}
              disabled={!canEdit}
              className="resize-none text-sm leading-relaxed"
              style={isOverLimit ? { borderColor: "hsl(0 72% 51%)" } : undefined}
            />

            {/* Character counter */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 h-1 rounded-full overflow-hidden bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${charPercent}%`,
                    background: isOverLimit
                      ? "hsl(0 72% 51%)"
                      : isNearLimit
                      ? "hsl(45 96% 48%)"
                      : "hsl(154 100% 49%)",
                  }}
                />
              </div>
              <span
                className="text-xs font-medium tabular-nums shrink-0"
                style={{
                  color: isOverLimit
                    ? "hsl(0 72% 51%)"
                    : isNearLimit
                    ? "hsl(45 80% 35%)"
                    : "hsl(213 15% 48%)",
                }}
              >
                {charCount} / {MAX_CHARS}
                {isOverLimit && " · over limit"}
              </span>
            </div>
          </div>

          {/* Website */}
          <div className="space-y-1.5 pt-2" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            <Label htmlFor="website" className="text-sm font-medium text-foreground">
              Company Website
            </Label>
            <Input
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://your-company.com"
              disabled={!canEdit}
            />
          </div>

          {/* Actions */}
          {canEdit && (
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || isOverLimit || !description.trim()}
                className="gap-2"
              >
                {isSaving ? (
                  <>
                    <span className="h-3 w-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save Draft
                  </>
                )}
              </Button>

              <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2 flex-1 sm:flex-none">
                {isSubmitting ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Save & Submit
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Changes Modal */}
      {showRequest && exhibitorId && (
        <RequestModal exhibitorId={exhibitorId} onClose={() => setShowRequest(false)} />
      )}
    </div>
  );
}
