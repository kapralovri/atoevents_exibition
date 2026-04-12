"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileImage,
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
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
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "N/A";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
};

export default function GraphicsPage() {
  const [elements, setElements] = useState<GraphicElement[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGraphics() {
      try {
        const data = await apiFetch<GraphicElement[]>("/portal/me/exhibitor/graphics");
        setElements(data);
      } catch {
        toast.error("Failed to load graphics elements");
      }
    }
    fetchGraphics();
  }, []);

  const handleFileUpload = async (elementId: string, file: File) => {
    if (!file.name.toLowerCase().match(/\.(tiff?|tif)$/)) {
      toast.error("Only TIFF files (.tif, .tiff) are accepted");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast.error("File size exceeds the 500 MB limit");
      return;
    }

    setUploading(elementId);
    try {
      const { upload_url, s3_key } = await apiFetch<{
        upload_url: string;
        s3_key: string;
      }>(`/portal/me/exhibitor/graphics/${elementId}/presign`, {
        method: "POST",
        auth: true,
      });

      await fetch(upload_url, { method: "PUT", body: file });

      await apiFetch(`/portal/me/exhibitor/graphics/${elementId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3_key, original_filename: file.name }),
        auth: true,
      });

      toast.success("File uploaded — under review");
      const data = await apiFetch<GraphicElement[]>("/portal/me/exhibitor/graphics");
      setElements(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const needsUpload = (el: GraphicElement) =>
    el.status === "not_uploaded" || el.status === "revision";

  const approved = elements.filter((e) => e.status === "approved").length;
  const required = elements.filter((e) => e.required).length;

  return (
    <div className="space-y-6 animate-fade-up">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Graphics</h1>
          <p className="page-description">Upload TIFF files for each booth element · max 500 MB each</p>
        </div>
        <div
          className="hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{
            background: "hsl(154 80% 94%)",
            color: "hsl(154 60% 28%)",
            border: "1px solid hsl(154 60% 82%)",
          }}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {approved} / {required} approved
        </div>
      </div>

      {/* ── Info banner ─────────────────────────────────────────── */}
      <div
        className="flex items-start gap-3 rounded-xl p-4 text-sm"
        style={{
          background: "hsl(209 65% 21% / 0.06)",
          border: "1px solid hsl(209 65% 21% / 0.12)",
        }}
      >
        <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(209 65% 38%)" }} />
        <p style={{ color: "hsl(209 50% 30%)" }}>
          <strong>Accepted format:</strong> TIFF / TIF only · DPI 75–100 · Files are validated automatically after upload.
          If revision is requested, re-upload your corrected file.
        </p>
      </div>

      {/* ── Elements ────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {elements.map((element, i) => {
          const canUpload = needsUpload(element);
          const isUploading = uploading === element.id;

          return (
            <Card
              key={element.id}
              className={[
                "card-elevated relative overflow-hidden",
                `stagger-${Math.min(i + 1, 4)} animate-fade-up`,
              ].join(" ")}
            >
              {/* Status stripe */}
              <div
                className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
                style={{
                  background:
                    element.status === "approved"
                      ? "linear-gradient(90deg, hsl(154 100% 49%), hsl(170 80% 44%))"
                      : element.status === "under_review"
                      ? "hsl(45 96% 48%)"
                      : element.status === "revision"
                      ? "hsl(0 72% 51%)"
                      : "hsl(213 20% 80%)",
                }}
              />

              <CardHeader className="pb-3 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
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
                    </CardTitle>
                    {element.version_number !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        Version {element.version_number}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={element.status} />
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Existing file info */}
                {element.file_name && (
                  <div
                    className="flex items-center gap-2 text-xs rounded-lg px-3 py-2"
                    style={{ background: "hsl(213 20% 95%)", color: "hsl(213 15% 45%)" }}
                  >
                    <FileImage className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate font-medium">{element.file_name}</span>
                    <span className="shrink-0">·</span>
                    <span className="shrink-0">{formatFileSize(element.file_size)}</span>
                    {element.uploaded_at && (
                      <>
                        <span className="shrink-0">·</span>
                        <span className="shrink-0">
                          {new Date(element.uploaded_at).toLocaleDateString("en-GB")}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Admin revision comment */}
                {element.status === "revision" && element.admin_comment && (
                  <div
                    className="flex items-start gap-2.5 rounded-lg p-3"
                    style={{
                      background: "hsl(0 80% 97%)",
                      border: "1px solid hsl(0 72% 88%)",
                    }}
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(0 72% 51%)" }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "hsl(0 72% 38%)" }}>
                        Revision required
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "hsl(0 60% 48%)" }}>
                        {element.admin_comment}
                      </p>
                    </div>
                  </div>
                )}

                {/* Under review */}
                {element.status === "under_review" && (
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium"
                    style={{
                      background: "hsl(45 100% 94%)",
                      color: "hsl(45 80% 30%)",
                      border: "1px solid hsl(45 80% 82%)",
                    }}
                  >
                    <Clock className="h-4 w-4 shrink-0" />
                    File received — under admin review
                  </div>
                )}

                {/* Approved */}
                {element.status === "approved" && (
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium"
                    style={{
                      background: "hsl(154 80% 94%)",
                      color: "hsl(154 60% 28%)",
                      border: "1px solid hsl(154 60% 82%)",
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Approved by admin
                  </div>
                )}

                {/* Upload zone */}
                {canUpload && (
                  <div>
                    <input
                      type="file"
                      id={`file-${element.id}`}
                      className="hidden"
                      accept=".tiff,.tif"
                      disabled={isUploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(element.id, f);
                      }}
                    />
                    <label
                      htmlFor={`file-${element.id}`}
                      className={[
                        "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-6",
                        "cursor-pointer text-center transition-all duration-200",
                      ].join(" ")}
                      style={{
                        borderColor: isUploading
                          ? "hsl(154 100% 49%)"
                          : "hsl(var(--border))",
                        background: isUploading
                          ? "hsl(154 100% 49% / 0.05)"
                          : "hsl(213 20% 98%)",
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        (e.currentTarget as HTMLElement).style.borderColor = "hsl(154 100% 49%)";
                        (e.currentTarget as HTMLElement).style.background = "hsl(154 100% 49% / 0.06)";
                      }}
                      onDragLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "";
                        (e.currentTarget as HTMLElement).style.background = "";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        (e.currentTarget as HTMLElement).style.borderColor = "";
                        (e.currentTarget as HTMLElement).style.background = "";
                        const f = e.dataTransfer.files[0];
                        if (f) handleFileUpload(element.id, f);
                      }}
                    >
                      {isUploading ? (
                        <>
                          <span
                            className="h-7 w-7 rounded-full border-2 border-t-transparent animate-spin"
                            style={{ borderColor: "hsl(154 100% 49% / 0.3)", borderTopColor: "hsl(154 100% 49%)" }}
                          />
                          <p className="text-sm font-medium" style={{ color: "hsl(154 60% 38%)" }}>
                            Uploading…
                          </p>
                        </>
                      ) : (
                        <>
                          <div
                            className="h-10 w-10 rounded-xl flex items-center justify-center"
                            style={{ background: "hsl(209 65% 21% / 0.08)" }}
                          >
                            <Upload className="h-5 w-5" style={{ color: "hsl(209 65% 38%)" }} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {element.status === "revision" ? "Upload revised file" : "Upload TIFF file"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Drag & drop or click · TIFF only · max 500 MB
                            </p>
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

      {/* Empty state */}
      {elements.length === 0 && (
        <Card className="card-elevated">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center"
              style={{ background: "hsl(209 65% 21% / 0.07)" }}
            >
              <FileImage className="h-8 w-8" style={{ color: "hsl(209 65% 38%)" }} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">No graphics slots configured</p>
              <p className="text-sm text-muted-foreground mt-1">
                Contact your ATO COMM manager to set up your booth graphics
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
