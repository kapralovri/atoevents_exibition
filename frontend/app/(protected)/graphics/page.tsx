"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { StandZoneOverlay } from "@/components/stand-zone-overlay";
import {
  Upload, FileImage, AlertCircle, CheckCircle2, Clock, Info,
  Eye, Pen, Download, Send, X, RotateCcw,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

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
  version_number?: number;
  preview_url?: string;
}


const REQUIRED_FILES: Record<string, number> = { SHELL_ONLY: 2, SYSTEM: 4, BESPOKE: 1 };
const PACKAGE_LABELS: Record<string, string>  = { SHELL_ONLY: "START", SYSTEM: "PRO", BESPOKE: "INDIVIDUAL" };

const fmt = (bytes?: number) => {
  if (!bytes) return "N/A";
  const mb = bytes / 1048576;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
};

function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void, contentType?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load",  () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.open("PUT", url);
    if (contentType) xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(file);
  });
}

// ─── Preview Modal (server-rendered composite) ───────────────────────────────
function PreviewModal({ exhibitorId, onClose }: { exhibitorId: number; onClose: () => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    const token   = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    fetch(`${apiBase}/portal/exhibitors/${exhibitorId}/preview/render`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail ?? `Server error ${res.status}`);
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to generate preview"))
      .finally(() => setLoading(false));

    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [exhibitorId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8,14,26,0.88)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden animate-fade-up"
        style={{ background: "hsl(209 65% 12%)", border: "1px solid hsl(209 65% 28% / 0.4)", maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid hsl(209 65% 22% / 0.4)" }}>
          <div className="flex items-center gap-3">
            <Eye className="h-4 w-4" style={{ color: "hsl(154 100% 49%)" }} />
            <h3 className="text-sm font-semibold text-white">Stand Preview</h3>
            {!loading && !error && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "hsl(154 100% 49% / 0.12)", color: "hsl(154 80% 60%)" }}>
                rendered
              </span>
            )}
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ color: "hsl(210 30% 55%)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 overflow-auto" style={{ maxHeight: "calc(92vh - 70px)" }}>
          <div
            className="relative w-full rounded-xl overflow-hidden flex items-center justify-center"
            style={{ minHeight: 320, background: "hsl(209 65% 8%)", border: "1px solid hsl(209 65% 20% / 0.4)" }}
          >
            {loading && (
              <div className="flex flex-col items-center gap-3 py-16">
                <span className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "hsl(154 100% 49% / 0.3)", borderTopColor: "hsl(154 100% 49%)" }} />
                <p className="text-xs" style={{ color: "hsl(210 30% 50%)" }}>Generating stand preview…</p>
              </div>
            )}
            {!loading && error && (
              <div className="text-center py-12 px-6">
                <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" style={{ color: "hsl(0 80% 60%)" }} />
                <p className="text-sm font-medium text-white mb-1">Preview unavailable</p>
                <p className="text-xs" style={{ color: "hsl(210 30% 50%)" }}>{error}</p>
              </div>
            )}
            {!loading && imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Stand preview" className="w-full object-contain rounded-xl"
                style={{ display: "block" }} />
            )}
          </div>

          {!loading && imageUrl && (
            <p className="mt-3 text-xs text-center" style={{ color: "hsl(210 30% 46%)" }}>
              Your graphics composited on the stand template · approximate placement
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Approve Modal ────────────────────────────────────────────────────────────
function ApproveModal({ exhibitorId, onClose, onApproved }: { exhibitorId: number; onClose: () => void; onApproved: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [signed, setSigned] = useState(false);
  const [loading, setLoading] = useState(false);

  async function confirmApprove() {
    if (!signed) return;
    setLoading(true);
    try {
      await apiFetch(`/portal/exhibitors/${exhibitorId}/graphics/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature_accepted: true }),
      });
      setStep(3);
      onApproved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8,14,26,0.88)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden animate-fade-up"
        style={{ background: "hsl(209 65% 12%)", border: "1px solid hsl(209 65% 28% / 0.4)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}
      >
        {/* top line */}
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, hsl(154 100% 49%), transparent)" }} />

        {/* step indicator */}
        <div className="flex items-center gap-2 px-6 pt-6 pb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: step >= s ? "hsl(154 100% 49% / 0.15)" : "hsl(209 65% 21% / 0.4)",
                  color: step >= s ? "hsl(154 100% 49%)" : "hsl(210 30% 45%)",
                  border: `1px solid ${step >= s ? "hsl(154 100% 49% / 0.3)" : "hsl(209 65% 28% / 0.3)"}`,
                }}
              >
                {step > s ? <CheckCircle2 className="h-3.5 w-3.5" /> : s}
              </div>
              {s < 3 && <div className="w-8 h-px" style={{ background: step > s ? "hsl(154 100% 49% / 0.4)" : "hsl(209 65% 25% / 0.4)" }} />}
            </div>
          ))}
          <span className="ml-auto text-xs" style={{ color: "hsl(210 30% 50%)" }}>Step {step} of 3</span>
        </div>

        <div className="px-6 pb-6">
          {/* ── STEP 1: Info ── */}
          {step === 1 && (
            <>
              <div className="mb-5">
                <h3 className="text-base font-semibold text-white">Approve Graphics</h3>
                <p className="text-sm mt-1" style={{ color: "hsl(210 25% 60%)" }}>
                  You are about to confirm your booth graphics. Please review the checklist.
                </p>
              </div>
              <div className="space-y-2.5 mb-6">
                {[
                  "All uploaded files match the booth specifications",
                  "File formats are TIFF, resolution 75–100 DPI",
                  "Dimensions match the mm sizes from the technical requirements",
                  "Content is final — no further edits after approval",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(154 80% 45%)" }} />
                    <span className="text-sm" style={{ color: "hsl(210 25% 68%)" }}>{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 h-10 rounded-xl text-sm font-medium" style={{ background: "hsl(209 65% 21% / 0.4)", color: "hsl(210 30% 60%)", border: "1px solid hsl(209 65% 28% / 0.3)" }}>
                  Cancel
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 h-10 rounded-xl text-sm font-semibold"
                  style={{ background: "linear-gradient(135deg, hsl(154 100% 42%), hsl(154 80% 36%))", color: "hsl(209 65% 10%)" }}
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2: Signature ── */}
          {step === 2 && (
            <>
              <div className="mb-5">
                <h3 className="text-base font-semibold text-white">Digital Signature</h3>
                <p className="text-sm mt-1" style={{ color: "hsl(210 25% 60%)" }}>
                  By confirming, you electronically sign and take full responsibility for the submitted materials.
                </p>
              </div>

              {/* Signature checkbox */}
              <label
                className="flex items-start gap-3 rounded-xl p-4 cursor-pointer mb-5"
                style={{
                  background: signed ? "hsl(154 100% 49% / 0.06)" : "hsl(209 65% 10% / 0.6)",
                  border: `1px solid ${signed ? "hsl(154 100% 49% / 0.3)" : "hsl(209 65% 28% / 0.3)"}`,
                  transition: "all 150ms",
                }}
              >
                <input
                  type="checkbox"
                  checked={signed}
                  onChange={(e) => setSigned(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-emerald-500 shrink-0"
                />
                <span className="text-sm leading-snug" style={{ color: signed ? "hsl(154 80% 65%)" : "hsl(210 25% 65%)" }}>
                  <strong style={{ color: signed ? "hsl(154 100% 49%)" : "hsl(210 30% 80%)" }}>I confirm and sign</strong>
                  {" "}that all uploaded graphics are final, correct, and comply with ATO COMM technical requirements.
                </span>
              </label>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 h-10 rounded-xl text-sm font-medium" style={{ background: "hsl(209 65% 21% / 0.4)", color: "hsl(210 30% 60%)", border: "1px solid hsl(209 65% 28% / 0.3)" }}>
                  Back
                </button>
                <button
                  onClick={confirmApprove}
                  disabled={!signed || loading}
                  className="flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
                  style={{
                    background: signed ? "linear-gradient(135deg, hsl(154 100% 42%), hsl(154 80% 36%))" : "hsl(209 65% 21% / 0.4)",
                    color: signed ? "hsl(209 65% 10%)" : "hsl(210 30% 40%)",
                    cursor: signed ? "pointer" : "not-allowed",
                  }}
                >
                  {loading
                    ? <span className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                    : <><Pen className="h-3.5 w-3.5" /> Sign &amp; Approve</>
                  }
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3: Success ── */}
          {step === 3 && (
            <div className="text-center py-4">
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "hsl(154 100% 49% / 0.12)", border: "1px solid hsl(154 100% 49% / 0.25)" }}
              >
                <CheckCircle2 className="h-7 w-7" style={{ color: "hsl(154 100% 49%)" }} />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Graphics Approved!</h3>
              <p className="text-sm" style={{ color: "hsl(210 25% 60%)" }}>
                Your graphics have been approved and locked. ATO COMM will send a confirmation email with your stand visualization PDF.
              </p>
              <button
                onClick={onClose}
                className="mt-6 w-full h-10 rounded-xl text-sm font-semibold"
                style={{ background: "linear-gradient(135deg, hsl(154 100% 42%), hsl(154 80% 36%))", color: "hsl(209 65% 10%)" }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Request Changes Modal ────────────────────────────────────────────────────
function RequestModal({ exhibitorId, section, onClose }: { exhibitorId: number; section: string; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    setLoading(true);
    try {
      await apiFetch(`/portal/exhibitors/${exhibitorId}/change-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, message }),
      });
      setSent(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send request");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8,14,26,0.85)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden animate-fade-up"
        style={{ background: "hsl(209 65% 12%)", border: "1px solid hsl(209 65% 28% / 0.4)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid hsl(209 65% 22% / 0.4)" }}>
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" style={{ color: "hsl(45 96% 58%)" }} />
            <h3 className="text-sm font-semibold text-white">Request Changes</h3>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ color: "hsl(210 30% 55%)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {sent ? (
            <div className="text-center py-4">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "hsl(45 100% 49% / 0.1)", border: "1px solid hsl(45 80% 60% / 0.3)" }}>
                <CheckCircle2 className="h-6 w-6" style={{ color: "hsl(45 96% 58%)" }} />
              </div>
              <p className="text-sm font-semibold text-white mb-1">Request sent!</p>
              <p className="text-xs" style={{ color: "hsl(210 25% 55%)" }}>
                ATO COMM will review and unlock the section if approved.
              </p>
              <button onClick={onClose} className="mt-5 w-full h-10 rounded-xl text-sm font-semibold"
                style={{ background: "hsl(209 65% 21% / 0.6)", color: "hsl(210 40% 75%)", border: "1px solid hsl(209 65% 30% / 0.4)" }}>
                Close
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm mb-4" style={{ color: "hsl(210 25% 65%)" }}>
                Explain why you need to make changes to the <strong className="text-white capitalize">{section}</strong> section. ATO COMM will unlock it manually.
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe what needs to be updated…"
                rows={4}
                className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none"
                style={{
                  background: "hsl(209 65% 10% / 0.7)",
                  border: "1px solid hsl(209 65% 28% / 0.35)",
                  color: "#e8eef4",
                }}
              />
              <div className="flex gap-3 mt-4">
                <button onClick={onClose} className="flex-1 h-10 rounded-xl text-sm font-medium"
                  style={{ background: "hsl(209 65% 21% / 0.4)", color: "hsl(210 30% 60%)", border: "1px solid hsl(209 65% 28% / 0.3)" }}>
                  Cancel
                </button>
                <button
                  onClick={send}
                  disabled={loading || !message.trim()}
                  className="flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{
                    background: message.trim() ? "hsl(45 96% 38%)" : "hsl(209 65% 21% / 0.4)",
                    color: message.trim() ? "hsl(38 90% 10%)" : "hsl(210 30% 40%)",
                  }}
                >
                  {loading
                    ? <span className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                    : <><Send className="h-3.5 w-3.5" /> Send Request</>
                  }
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GraphicsPage() {
  const [elements, setElements] = useState<GraphicElement[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [standPackage, setStandPackage] = useState<string>("");
  const [standConfiguration, setStandConfiguration] = useState<string>("LINEAR");
  const [exhibitorId, setExhibitorId] = useState<number | null>(null);
  const [graphicsLocked, setGraphicsLocked] = useState(false);
  const [backdropUrl, setBackdropUrl] = useState<string | null>(null);

  // modals
  const [showPreview, setShowPreview]     = useState(false);
  const [showApprove, setShowApprove]     = useState(false);
  const [showRequest, setShowRequest]     = useState(false);

  const reload = async () => {
    const data = await apiFetch<GraphicElement[]>("/portal/me/exhibitor/graphics");
    setElements(data);
  };

  const reloadPreview = async (exId: number) => {
    try {
      const preview = await apiFetch<{ backdrop_url: string | null }>(`/portal/exhibitors/${exId}/preview`);
      setBackdropUrl(preview.backdrop_url ?? null);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    async function fetchAll() {
      try {
        await reload();
      } catch { toast.error("Failed to load graphics elements"); }
      try {
        const ex = await apiFetch<{ stand_package: string; stand_configuration: string; id: number; locks: { graphics: boolean }; graphics_status: string }>("/portal/me/exhibitor");
        setStandPackage(ex.stand_package ?? "");
        setStandConfiguration(ex.stand_configuration ?? "LINEAR");
        setExhibitorId(ex.id);
        // Lock uploads if admin locked OR status is under review / approved
        const statusLocked = ["UNDER_REVIEW", "APPROVED"].includes((ex.graphics_status ?? "").toUpperCase());
        setGraphicsLocked((ex.locks?.graphics ?? false) || statusLocked);
        // Fetch backdrop URL for zone overlay
        try {
          const preview = await apiFetch<{ backdrop_url: string | null }>(`/portal/exhibitors/${ex.id}/preview`);
          setBackdropUrl(preview.backdrop_url ?? null);
        } catch { /* no backdrop yet */ }
      } catch {}
    }
    fetchAll();
  }, []);

  const handleFileUpload = async (elementId: string, file: File) => {
    if (!file.name.toLowerCase().match(/\.(tiff?|tif|pdf)$/)) {
      toast.error("Only TIFF (.tif, .tiff) or PDF files are accepted"); return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast.error("File size exceeds the 500 MB limit"); return;
    }
    setUploading(elementId);
    setUploadingFile(file);
    setUploadProgress((p) => ({ ...p, [elementId]: 0 }));
    try {
      const ct = file.type || "application/octet-stream";
      const { upload_url, s3_key, content_type } = await apiFetch<{ upload_url: string; s3_key: string; content_type: string }>(
        `/portal/me/exhibitor/graphics/${elementId}/presign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content_type: ct }),
        }
      );
      await uploadWithProgress(
        upload_url,
        file,
        (pct) => setUploadProgress((p) => ({ ...p, [elementId]: pct })),
        content_type || ct,
      );
      await apiFetch(`/portal/me/exhibitor/graphics/${elementId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3_key, original_filename: file.name }),
        auth: true,
      });
      toast.success("File uploaded — under review");
      await reload();
      if (exhibitorId) await reloadPreview(exhibitorId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(null); setUploadingFile(null);
      setUploadProgress((p) => { const n = { ...p }; delete n[elementId]; return n; });
    }
  };

  const openPreview = () => {
    if (!exhibitorId) return;
    setShowPreview(true);
  };

  const handleApproved = async () => {
    setGraphicsLocked(true);
    await reload();
  };

  const needsUpload = (el: GraphicElement) => el.status === "not_uploaded" || el.status === "revision";

  const approved    = elements.filter((e) => e.status === "approved").length;
  const required    = elements.filter((e) => e.required).length;
  const uploaded    = elements.filter((e) => e.status !== "not_uploaded").length;
  const reqCount    = standPackage ? (REQUIRED_FILES[standPackage] ?? required) : required;
  const allUploaded = uploaded >= reqCount;
  const allUnderReview = elements.length > 0 && elements.every((e) => ["under_review","approved"].includes(e.status));
  const canApprove  = allUnderReview && !graphicsLocked;

  return (
    <div className="space-y-6 animate-fade-up">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Graphics</h1>
          <p className="page-description">Upload TIFF or PDF files for each booth element · max 500 MB each</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Preview button */}
          {uploaded > 0 && exhibitorId && (
            <button
              onClick={openPreview}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: "hsl(209 65% 21% / 0.1)",
                color: "hsl(209 65% 38%)",
                border: "1px solid hsl(209 65% 21% / 0.2)",
              }}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview Stand
            </button>
          )}
          <div
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{ background: "hsl(154 80% 94%)", color: "hsl(154 60% 28%)", border: "1px solid hsl(154 60% 82%)" }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {approved} / {required} approved
          </div>
        </div>
      </div>

      {/* ── Info banner ─────────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-xl p-4 text-sm"
        style={{ background: "hsl(209 65% 21% / 0.06)", border: "1px solid hsl(209 65% 21% / 0.12)" }}>
        <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(209 65% 38%)" }} />
        <p style={{ color: "hsl(209 50% 30%)" }}>
          <strong>Accepted format:</strong> TIFF / TIF only · DPI 75–100 · Files are validated automatically after upload.
          If revision is requested, re-upload your corrected file.
        </p>
      </div>

      {/* ── Locked / Approve banner ──────────────────────────────── */}
      {graphicsLocked ? (
        <div className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
          style={{ background: "hsl(154 80% 94%)", border: "1px solid hsl(154 60% 78%)" }}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5" style={{ color: "hsl(154 60% 28%)" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "hsl(154 60% 22%)" }}>Graphics approved &amp; locked</p>
              <p className="text-xs mt-0.5" style={{ color: "hsl(154 50% 35%)" }}>
                Your stand visualization PDF will be sent by ATO COMM once production is confirmed.
              </p>
            </div>
          </div>
          {exhibitorId && (
            <button
              onClick={() => setShowRequest(true)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shrink-0"
              style={{ background: "hsl(45 100% 94%)", color: "hsl(38 80% 28%)", border: "1px solid hsl(45 80% 78%)" }}
            >
              <RotateCcw className="h-3 w-3" />
              Request Changes
            </button>
          )}
        </div>
      ) : canApprove ? (
        <div className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
          style={{ background: "hsl(209 65% 21% / 0.07)", border: "1px solid hsl(209 65% 21% / 0.15)" }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: "hsl(209 65% 22%)" }}>All files submitted — ready to approve</p>
            <p className="text-xs mt-0.5" style={{ color: "hsl(209 50% 40%)" }}>
              Review the checklist and digitally sign to approve your graphics.
            </p>
          </div>
          <button
            onClick={() => setShowApprove(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shrink-0"
            style={{ background: "linear-gradient(135deg, hsl(154 100% 42%), hsl(154 80% 36%))", color: "hsl(209 65% 10%)" }}
          >
            <Pen className="h-3.5 w-3.5" />
            Approve Graphics
          </button>
        </div>
      ) : standPackage ? (
        /* progress banner */
        <div className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
          style={{ background: allUploaded ? "hsl(154 80% 94%)" : "hsl(45 100% 92%)", border: `1px solid ${allUploaded ? "hsl(154 60% 78%)" : "hsl(45 80% 78%)"}` }}>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: allUploaded ? "hsl(154 60% 28% / 0.12)" : "hsl(45 80% 30% / 0.12)" }}>
              {allUploaded
                ? <CheckCircle2 className="h-4 w-4" style={{ color: "hsl(154 60% 28%)" }} />
                : <AlertCircle  className="h-4 w-4" style={{ color: "hsl(45 80% 28%)" }} />}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: allUploaded ? "hsl(154 60% 22%)" : "hsl(38 80% 24%)" }}>
                {PACKAGE_LABELS[standPackage] ?? standPackage} — {reqCount} file{reqCount !== 1 ? "s" : ""} required
              </p>
              <p className="text-xs mt-0.5" style={{ color: allUploaded ? "hsl(154 50% 35%)" : "hsl(38 60% 32%)" }}>
                {uploaded} of {reqCount} uploaded · {approved} of {required} approved
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            {Array.from({ length: reqCount }).map((_, i) => (
              <span key={i} className="h-2.5 w-2.5 rounded-full" style={{
                background: i < approved ? "hsl(154 100% 49%)" : i < uploaded ? "hsl(45 96% 48%)" : "hsl(213 20% 80%)",
                boxShadow: i < approved ? "0 0 4px hsl(154 100% 49% / 0.5)" : "none",
              }} />
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Interactive Stand Zone Overlay ──────────────────────── */}
      {(backdropUrl || elements.length > 0) && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid hsl(213 20% 88%)" }}>
          <div className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: "1px solid hsl(213 20% 90%)", background: "hsl(213 20% 98%)" }}>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" style={{ color: "hsl(213 50% 45%)" }} />
              <span className="text-sm font-semibold" style={{ color: "hsl(213 20% 28%)" }}>
                Stand Layout — Upload by Zone
              </span>
            </div>
            {standConfiguration && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide"
                style={{ background: "hsl(213 80% 94%)", color: "hsl(213 60% 38%)" }}>
                {standConfiguration}
              </span>
            )}
          </div>
          <div className="p-5" style={{ background: "hsl(213 20% 99%)" }}>
            <StandZoneOverlay
              backdropUrl={backdropUrl}
              standConfiguration={standConfiguration}
              slots={elements.map((e) => ({
                id: e.id,
                label: e.label,
                status: e.status,
                preview_url: e.preview_url,
              }))}
              onUpload={handleFileUpload}
              uploading={uploading}
              uploadProgress={uploadProgress}
              locked={graphicsLocked}
            />
          </div>
        </div>
      )}

      {/* ── Elements grid ────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {elements.map((element, i) => {
          const canUpload  = needsUpload(element) && !graphicsLocked;
          const isUploading = uploading === element.id;

          return (
            <Card key={element.id} className={["card-elevated relative overflow-hidden", `stagger-${Math.min(i + 1, 4)} animate-fade-up`].join(" ")}>
              <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{
                background:
                  element.status === "approved"     ? "linear-gradient(90deg, hsl(154 100% 49%), hsl(170 80% 44%))" :
                  element.status === "under_review" ? "hsl(45 96% 48%)" :
                  element.status === "revision"     ? "hsl(0 72% 51%)" :
                  "hsl(213 20% 80%)",
              }} />

              <CardHeader className="pb-3 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                      {element.label}
                      {element.required && (
                        <span className="text-[10px] font-bold rounded px-1.5 py-0.5 uppercase tracking-wide"
                          style={{ background: "hsl(209 65% 21% / 0.08)", color: "hsl(209 65% 28%)" }}>
                          Required
                        </span>
                      )}
                    </CardTitle>
                    {element.version_number !== undefined && (
                      <p className="text-xs text-muted-foreground">Version {element.version_number}</p>
                    )}
                  </div>
                  <StatusBadge status={element.status} />
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {element.file_name && (
                  <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2"
                    style={{ background: "hsl(213 20% 95%)", color: "hsl(213 15% 45%)" }}>
                    <FileImage className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate font-medium">{element.file_name}</span>
                    <span className="shrink-0">·</span>
                    <span className="shrink-0">{fmt(element.file_size)}</span>
                    {element.uploaded_at && (
                      <><span className="shrink-0">·</span>
                      <span className="shrink-0">{new Date(element.uploaded_at).toLocaleDateString("en-GB")}</span></>
                    )}
                  </div>
                )}

                {element.status === "revision" && element.admin_comment && (
                  <div className="flex items-start gap-2.5 rounded-lg p-3"
                    style={{ background: "hsl(0 80% 97%)", border: "1px solid hsl(0 72% 88%)" }}>
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(0 72% 51%)" }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "hsl(0 72% 38%)" }}>Revision required</p>
                      <p className="text-xs mt-0.5" style={{ color: "hsl(0 60% 48%)" }}>{element.admin_comment}</p>
                    </div>
                  </div>
                )}

                {element.status === "under_review" && (
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium"
                    style={{ background: "hsl(45 100% 94%)", color: "hsl(45 80% 30%)", border: "1px solid hsl(45 80% 82%)" }}>
                    <Clock className="h-4 w-4 shrink-0" />
                    File received — under admin review
                  </div>
                )}

                {element.status === "approved" && (
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium"
                    style={{ background: "hsl(154 80% 94%)", color: "hsl(154 60% 28%)", border: "1px solid hsl(154 60% 82%)" }}>
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Approved by admin
                  </div>
                )}

                {canUpload && (
                  <div>
                    <input type="file" id={`file-${element.id}`} className="hidden" accept=".tiff,.tif,.pdf"
                      disabled={isUploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(element.id, f); }}
                    />
                    <label htmlFor={`file-${element.id}`}
                      className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-6 cursor-pointer text-center transition-all duration-200"
                      style={{
                        borderColor: isUploading ? "hsl(154 100% 49%)" : "hsl(var(--border))",
                        background:  isUploading ? "hsl(154 100% 49% / 0.05)" : "hsl(213 20% 98%)",
                      }}
                      onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = "hsl(154 100% 49%)"; (e.currentTarget as HTMLElement).style.background = "hsl(154 100% 49% / 0.06)"; }}
                      onDragLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = ""; (e.currentTarget as HTMLElement).style.background = ""; }}
                      onDrop={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = ""; (e.currentTarget as HTMLElement).style.background = ""; const f = e.dataTransfer.files[0]; if (f) handleFileUpload(element.id, f); }}
                    >
                      {isUploading ? (
                        <div className="w-full space-y-3 py-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span style={{ color: "hsl(154 60% 35%)" }}>Uploading…</span>
                            <span style={{ color: "hsl(154 60% 35%)" }}>{uploadProgress[element.id] ?? 0}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(154 100% 49% / 0.15)" }}>
                            <div className="h-full rounded-full" style={{
                              width: `${uploadProgress[element.id] ?? 0}%`,
                              background: "hsl(154 100% 49%)",
                              boxShadow: "0 0 6px hsl(154 100% 49% / 0.5)",
                              transition: "width 80ms linear",
                            }} />
                          </div>
                          <p className="text-xs text-center" style={{ color: "hsl(154 50% 42%)" }}>
                            {uploadingFile ? fmt(uploadingFile.size) : ""}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "hsl(209 65% 21% / 0.08)" }}>
                            <Upload className="h-5 w-5" style={{ color: "hsl(209 65% 38%)" }} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {element.status === "revision" ? "Upload revised file" : "Upload TIFF file"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">Drag & drop or click · TIFF only · max 500 MB</p>
                          </div>
                        </>
                      )}
                    </label>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {elements.length === 0 && (
        <Card className="card-elevated">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: "hsl(209 65% 21% / 0.07)" }}>
              <FileImage className="h-8 w-8" style={{ color: "hsl(209 65% 38%)" }} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">No graphics slots configured</p>
              <p className="text-sm text-muted-foreground mt-1">Contact your ATO COMM manager to set up your booth graphics</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Modals ──────────────────────────────────────────────── */}
      {showPreview && exhibitorId && <PreviewModal exhibitorId={exhibitorId} onClose={() => setShowPreview(false)} />}
      {showApprove && exhibitorId && (
        <ApproveModal exhibitorId={exhibitorId} onClose={() => setShowApprove(false)} onApproved={handleApproved} />
      )}
      {showRequest && exhibitorId && (
        <RequestModal exhibitorId={exhibitorId} section="graphics" onClose={() => setShowRequest(false)} />
      )}
    </div>
  );
}
