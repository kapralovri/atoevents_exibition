"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, Trash2, Send, CheckCircle2, Info, User } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface Participant {
  id?: string;
  full_name: string;
  email: string;
  job_title: string;
  phone: string;
}

const EMPTY_PARTICIPANT: Participant = {
  full_name: "", email: "", job_title: "", phone: "",
};

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [status, setStatus] = useState<string>("not_submitted");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const complimentaryQuota = 3;

  useEffect(() => {
    async function fetchParticipants() {
      try {
        const data = await apiFetch<{
          participants: Participant[];
          participants_status: string;
        }>("/portal/me/exhibitor");
        setParticipants(data.participants || []);
        setStatus(data.participants_status);
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

  const updateParticipant = (
    index: number,
    field: keyof Participant,
    value: string
  ) => {
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
      setStatus("submitted");
      toast.success("Participants submitted successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmitted = status === "submitted";

  return (
    <div className="space-y-6 animate-fade-up">

      {/* ── Header ──────────────────────────────────────────────── */}
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

      {/* ── Submitted banner ────────────────────────────────────── */}
      {isSubmitted && (
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

      {/* ── Quota info ──────────────────────────────────────────── */}
      <div
        className="flex items-start gap-3 rounded-xl p-4 text-sm"
        style={{
          background: "hsl(209 65% 21% / 0.06)",
          border: "1px solid hsl(209 65% 21% / 0.12)",
        }}
      >
        <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(209 65% 38%)" }} />
        <p style={{ color: "hsl(209 50% 30%)" }}>
          Your booth includes <strong>{complimentaryQuota} complimentary badges</strong>.
          Additional badges can be requested — contact your ATO COMM manager.
          Provide accurate details as they will appear on official badges.
        </p>
      </div>

      {/* ── Participants list ────────────────────────────────────── */}
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
              {/* Row number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-xs font-semibold"
                  style={{ color: "hsl(213 15% 50%)" }}
                >
                  Participant {index + 1}
                  {index < complimentaryQuota && (
                    <span
                      className="ml-2 text-[10px] rounded px-1.5 py-0.5"
                      style={{
                        background: "hsl(154 100% 49% / 0.12)",
                        color: "hsl(154 60% 35%)",
                      }}
                    >
                      Complimentary
                    </span>
                  )}
                </span>
                {!isSubmitted && (
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
                    disabled={isSubmitted}
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
                    disabled={isSubmitted}
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
                    disabled={isSubmitted}
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
                    disabled={isSubmitted}
                  />
                </div>
              </div>
            </div>
          ))}

          {!isSubmitted && (
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

          {!isSubmitted && participants.length > 0 && (
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
    </div>
  );
}
