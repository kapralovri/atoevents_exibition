"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Users, Plus, Trash2, Send, CheckCircle2, Info, User,
  Lock, MessageSquare, X, Loader2, Eye,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface Participant {
  id?: string;
  full_name: string;
  email: string;
  job_title: string;
  phone: string;
  badge_type?: string;
}

const EMPTY_PARTICIPANT: Participant = {
  full_name: "", email: "", job_title: "", phone: "",
};

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
        body: JSON.stringify({ section: "participants", message: message.trim() }),
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
              <p className="text-xs mt-0.5" style={{ color: "hsl(210 30% 55%)" }}>Participants section</p>
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
export default function ParticipantsPage() {
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [status, setStatus] = useState<string>("not_submitted");
  const [adminComment, setAdminComment] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [exhibitorId, setExhibitorId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [complimentaryQuota, setComplimentaryQuota] = useState<number>(1);
  const [showRequest, setShowRequest] = useState(false);
  const isUnderReview = status === "UNDER_REVIEW" || status === "under_review";

  useEffect(() => {
    async function fetchParticipants() {
      try {
        const data = await apiFetch<{
          id: number;
          participants: Participant[];
          participants_status: string;
          participants_admin_comment?: string;
          section_participants_locked?: boolean;
          area_m2?: number;
          quota_complimentary?: number;
        }>("/portal/me/exhibitor");
        setExhibitorId(data.id);
        setParticipants(data.participants || []);
        setStatus(data.participants_status);
        setAdminComment(data.participants_admin_comment || null);
        setIsLocked(!!data.section_participants_locked);
        if (data.quota_complimentary != null) {
          setComplimentaryQuota(data.quota_complimentary);
        } else if (data.area_m2 != null) {
          setComplimentaryQuota(Math.max(1, Math.floor(data.area_m2 / 9)));
        }
      } catch {
        toast.error("Failed to load participants");
      }
    }
    fetchParticipants();
  }, []);

  const addParticipant = () =>
    setParticipants([...participants, { ...EMPTY_PARTICIPANT }]);

  const removeParticipant = (index: number) =>
    setParticipants(participants.filter((_, i) => i !== index));

  const updateParticipant = (index: number, field: keyof Participant, value: string) => {
    const updated = [...participants];
    updated[index] = { ...updated[index], [field]: value };
    setParticipants(updated);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await apiFetch("/portal/me/exhibitor/participants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants }),
      });
      setStatus("UNDER_REVIEW");
      toast.success("Participants submitted — under review");
      router.push("/tasks");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmitted = status === "submitted" || status === "SUBMITTED";
  const canEdit = !isLocked && !isSubmitted && !isUnderReview;

  return (
    <div className="space-y-6 animate-fade-up">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Participants</h1>
          <p className="page-description">
            Register your team members for badge issuance
          </p>
        </div>
        <div
          className="hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{
            background: "hsl(209 65% 21% / 0.07)",
            color: "hsl(209 65% 28%)",
            border: "1px solid hsl(209 65% 21% / 0.15)",
          }}
        >
          <Users className="h-3.5 w-3.5" />
          {participants.length} registered
        </div>
      </div>

      {/* Locked banner */}
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
          Your participants list has been submitted and is under review. Editing is disabled until reviewed.
        </div>
      )}

      {/* Submitted (not locked) banner */}
      {isSubmitted && !isLocked && !isUnderReview && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
          style={{
            background: "hsl(154 80% 94%)",
            border: "1px solid hsl(154 60% 82%)",
            color: "hsl(154 60% 28%)",
          }}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          Participants list submitted · {participants.length} members registered
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

      {/* Quota info */}
      <div
        className="flex items-start gap-3 rounded-xl p-4 text-sm"
        style={{
          background: "hsl(209 65% 21% / 0.06)",
          border: "1px solid hsl(209 65% 21% / 0.12)",
        }}
      >
        <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(209 65% 38%)" }} />
        <p style={{ color: "hsl(209 50% 30%)" }}>
          Your booth includes{" "}
          <strong>
            {complimentaryQuota} complimentary badge{complimentaryQuota !== 1 ? "s" : ""}
          </strong>{" "}
          (1 per 9 m²). Additional participants are marked <em>Additional</em> — contact your ATO COMM manager for pricing.
          Names and details will appear on official badges.
        </p>
      </div>

      {/* Participants list */}
      <Card className="card-elevated">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" style={{ color: "hsl(209 65% 38%)" }} />
              Participants List
            </CardTitle>
            <StatusBadge status={status} />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {participants.length === 0 && (
            <div
              className="flex flex-col items-center gap-3 py-10 rounded-xl border-2 border-dashed"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center"
                style={{ background: "hsl(209 65% 21% / 0.07)" }}
              >
                <User className="h-6 w-6" style={{ color: "hsl(209 65% 38%)" }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">No participants yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add your first team member below
                </p>
              </div>
            </div>
          )}

          {participants.map((participant, index) => (
            <div
              key={index}
              className="rounded-xl border p-4 space-y-3 relative"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: "hsl(213 15% 50%)" }}>
                  Participant {index + 1}
                  {(participant.badge_type === "COMPLIMENTARY" ||
                    (!participant.badge_type && index < complimentaryQuota)) && (
                    <span
                      className="ml-2 text-[10px] rounded px-1.5 py-0.5"
                      style={{ background: "hsl(154 100% 49% / 0.12)", color: "hsl(154 60% 35%)" }}
                    >
                      Complimentary
                    </span>
                  )}
                  {(participant.badge_type === "ADDITIONAL" ||
                    (!participant.badge_type && index >= complimentaryQuota)) && (
                    <span
                      className="ml-2 text-[10px] rounded px-1.5 py-0.5"
                      style={{ background: "hsl(45 100% 90%)", color: "hsl(45 80% 30%)" }}
                    >
                      Additional
                    </span>
                  )}
                </span>
                {canEdit && (
                  <button
                    onClick={() => removeParticipant(index)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
                    style={{ color: "hsl(213 15% 60%)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "hsl(0 80% 97%)";
                      (e.currentTarget as HTMLElement).style.color = "hsl(0 72% 51%)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "";
                      (e.currentTarget as HTMLElement).style.color = "";
                    }}
                    aria-label="Remove participant"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Full Name *
                  </Label>
                  <Input
                    value={participant.full_name}
                    onChange={(e) => updateParticipant(index, "full_name", e.target.value)}
                    placeholder="John Smith"
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Job Title *
                  </Label>
                  <Input
                    value={participant.job_title}
                    onChange={(e) => updateParticipant(index, "job_title", e.target.value)}
                    placeholder="Engineering Manager"
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Email *
                  </Label>
                  <Input
                    type="email"
                    value={participant.email}
                    onChange={(e) => updateParticipant(index, "email", e.target.value)}
                    placeholder="john@company.com"
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Phone
                  </Label>
                  <Input
                    type="tel"
                    value={participant.phone}
                    onChange={(e) => updateParticipant(index, "phone", e.target.value)}
                    placeholder="+7 999 000 00 00"
                    disabled={!canEdit}
                  />
                </div>
              </div>
            </div>
          ))}

          {canEdit && (
            <button
              onClick={addParticipant}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-sm font-medium transition-all duration-200"
              style={{ borderColor: "hsl(var(--border))", color: "hsl(213 15% 50%)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "hsl(209 65% 21% / 0.3)";
                (e.currentTarget as HTMLElement).style.background = "hsl(209 65% 21% / 0.03)";
                (e.currentTarget as HTMLElement).style.color = "hsl(209 65% 28%)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "";
                (e.currentTarget as HTMLElement).style.background = "";
                (e.currentTarget as HTMLElement).style.color = "";
              }}
            >
              <Plus className="h-4 w-4" />
              Add Participant
            </button>
          )}

          {canEdit && participants.length > 0 && (
            <Button
              className="w-full gap-2 mt-2"
              size="lg"
              onClick={handleSubmit}
              disabled={isSubmitting || participants.length === 0}
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit {participants.length} Participant{participants.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
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
