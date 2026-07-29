"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Video,
  Send,
  Info,
  Lock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Pencil,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export default function CompanyVideoPage() {
  const router = useRouter();
  const [status, setStatus] = useState("NOT_STARTED");
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [locked, setLocked] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    apiFetch<{
      company_video_status?: string;
      company_video_url?: string;
      fully_locked?: boolean;
    }>("/portal/me/exhibitor")
      .then((ex) => {
        setStatus(ex.company_video_status || "NOT_STARTED");
        setSavedUrl(ex.company_video_url || null);
        setUrl(ex.company_video_url || "");
        setLocked(!!ex.fully_locked);
      })
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("Please enter a video URL, or use “Not required” instead");
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      toast.error("URL must start with http:// or https://");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/portal/me/exhibitor/video/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      setStatus("SUBMITTED");
      setSavedUrl(trimmed);
      setEditing(false);
      toast.success("Company video link saved");
      router.push("/tasks");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save the link");
    } finally {
      setSubmitting(false);
    }
  };

  const dismiss = async () => {
    setDismissing(true);
    try {
      await apiFetch("/portal/me/exhibitor/video/not-required", { method: "POST" });
      setStatus("NOT_REQUIRED");
      setSavedUrl(null);
      setUrl("");
      setEditing(false);
      toast.success("Marked as not required");
      router.push("/tasks");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setDismissing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span
          className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "hsl(209 65% 21% / 0.2)", borderTopColor: "hsl(209 65% 21%)" }}
        />
      </div>
    );
  }

  const isSubmitted = status === "SUBMITTED" && savedUrl && !editing;
  const isNotRequired = status === "NOT_REQUIRED" && !editing;
  const showForm = !locked && (editing || (!isSubmitted && !isNotRequired));

  return (
    <div className="space-y-6 animate-fade-up max-w-2xl">
      <div>
        <h1 className="page-title">Company Video</h1>
        <p className="page-description">
          Optional — share a link to a video about your company, or let us know it&apos;s not needed.
        </p>
      </div>

      {locked && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
          style={{
            background: "hsl(45 96% 48% / 0.08)",
            border: "1px solid hsl(45 96% 48% / 0.25)",
            color: "hsl(45 80% 35%)",
          }}
        >
          <Lock className="h-4 w-4 shrink-0" />
          <span>This exhibitor profile is locked. Contact ATO COMM to make changes.</span>
        </div>
      )}

      {!locked && (
        <div
          className="flex items-start gap-3 rounded-xl p-4 text-sm"
          style={{
            background: "hsl(209 65% 21% / 0.06)",
            border: "1px solid hsl(209 65% 21% / 0.12)",
          }}
        >
          <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(209 65% 38%)" }} />
          <p style={{ color: "hsl(209 50% 30%)" }}>
            This task is entirely optional. Link a company video (YouTube, Vimeo, your website — any
            public URL) if you have one, or dismiss it as not required. No review needed on our side.
          </p>
        </div>
      )}

      <Card className="card-elevated">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="h-4 w-4" style={{ color: "hsl(209 65% 38%)" }} />
              Video Link
            </CardTitle>
            <StatusBadge status={status} />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isSubmitted && (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
              style={{ background: "hsl(154 80% 94%)", border: "1px solid hsl(154 60% 82%)" }}
            >
              <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "hsl(154 60% 28%)" }} />
              <a
                href={savedUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 truncate font-medium flex items-center gap-1.5"
                style={{ color: "hsl(154 60% 24%)" }}
              >
                {savedUrl}
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
              {!locked && (
                <button
                  onClick={() => setEditing(true)}
                  className="shrink-0 flex items-center gap-1 text-xs font-semibold"
                  style={{ color: "hsl(154 60% 28%)" }}
                >
                  <Pencil className="h-3 w-3" /> Change
                </button>
              )}
            </div>
          )}

          {isNotRequired && (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
              style={{ background: "hsl(213 20% 96%)", border: "1px solid hsl(213 20% 90%)", color: "hsl(213 15% 40%)" }}
            >
              <XCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="flex-1">Marked as not required.</span>
              {!locked && (
                <button
                  onClick={() => setEditing(true)}
                  className="shrink-0 text-xs font-semibold"
                  style={{ color: "hsl(209 65% 38%)" }}
                >
                  Provide a link instead
                </button>
              )}
            </div>
          )}

          {showForm && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="video-url" className="text-sm font-medium text-foreground">
                  Video URL
                </Label>
                <Input
                  id="video-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=…"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button onClick={submit} disabled={submitting} className="gap-2">
                  {submitting ? (
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Submit link
                </Button>
                <Button variant="outline" onClick={dismiss} disabled={dismissing} className="gap-2">
                  {dismissing ? (
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  Not required
                </Button>
                {editing && (
                  <button
                    onClick={() => {
                      setEditing(false);
                      setUrl(savedUrl || "");
                    }}
                    className="text-sm text-muted-foreground"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
