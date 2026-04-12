"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Save, Send, CheckCircle2, Info } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

const MAX_CHARS = 500;

export default function DescriptionPage() {
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string>("not_submitted");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    async function fetchDescription() {
      try {
        const data = await apiFetch<{
          description: string;
          description_status: string;
        }>("/portal/me/exhibitor");
        setDescription(data.description || "");
        setStatus(data.description_status);
      } catch {
        toast.error("Failed to load description");
      }
    }
    fetchDescription();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiFetch("/portal/me/exhibitor/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_description: description }),
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
        body: JSON.stringify({ company_description: description }),
      });
      await apiFetch("/portal/me/exhibitor/description/submit", {
        method: "POST",
      });
      setStatus("submitted");
      toast.success("Description submitted successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const charCount    = description.length;
  const charPercent  = Math.min((charCount / MAX_CHARS) * 100, 100);
  const isNearLimit  = charCount > MAX_CHARS * 0.85;
  const isOverLimit  = charCount > MAX_CHARS;
  const isSubmitted  = status === "submitted";
  const canSubmit    = !isSubmitting && !isOverLimit && !isSubmitted && description.trim().length > 0;

  return (
    <div className="space-y-6 animate-fade-up max-w-2xl">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <h1 className="page-title">Company Description</h1>
        <p className="page-description">
          This text will appear in the official exhibition catalogue.
        </p>
      </div>

      {/* ── Submitted banner ────────────────────────────────────── */}
      {isSubmitted && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium animate-fade-up"
          style={{
            background: "hsl(154 80% 94%)",
            border: "1px solid hsl(154 60% 82%)",
            color: "hsl(154 60% 28%)",
          }}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          Your description has been submitted and is under review.
        </div>
      )}

      {/* ── Guideline ───────────────────────────────────────────── */}
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

      {/* ── Form card ───────────────────────────────────────────── */}
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
              <Label
                htmlFor="description"
                className="text-sm font-medium text-foreground"
              >
                Company Description
              </Label>
              {savedAt && !isSubmitted && (
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
              disabled={isSubmitted}
              className="resize-none text-sm leading-relaxed"
              style={
                isOverLimit
                  ? { borderColor: "hsl(0 72% 51%)" }
                  : undefined
              }
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

          {/* Actions */}
          {!isSubmitted && (
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

              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="gap-2 flex-1 sm:flex-none"
              >
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
    </div>
  );
}
