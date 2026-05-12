"use client";

import { useState } from "react";
import { BookOpen, CheckCircle2, Clock, X, FileText, Calendar, Users, Image } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface OnboardingModalProps {
  exhibitorId: number;
  companyName: string;
  onClose: () => void;
}

const TASKS = [
  { icon: Image,    label: "Upload booth graphics",        desc: "TIFF files for each stand element — validated automatically" },
  { icon: FileText, label: "Company description",          desc: "Up to 1 000 characters for the exhibition catalogue" },
  { icon: Users,    label: "Participant list",             desc: "Register your team and badge types (Complimentary / Additional)" },
];

export function OnboardingModal({ exhibitorId, companyName, onClose }: OnboardingModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function ack(acknowledged: boolean) {
    setIsLoading(true);
    try {
      await apiFetch(`/portal/exhibitors/${exhibitorId}/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledged }),
      });
      onClose();
      if (!acknowledged) {
        toast.info("We'll remind you next time you sign in.");
      }
    } catch {
      // silently close even on error
      onClose();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    /* backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8, 14, 26, 0.78)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-hidden animate-fade-up"
        style={{
          background: "hsl(209 65% 14%)",
          border: "1px solid hsl(209 65% 28% / 0.4)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px hsl(154 100% 49% / 0.06)",
        }}
      >
        {/* top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: "linear-gradient(90deg, hsl(154 100% 49%), hsl(170 80% 55%), transparent)" }}
        />

        {/* close */}
        <button
          onClick={() => ack(false)}
          disabled={isLoading}
          className="absolute top-4 right-4 h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: "hsl(210 30% 55%)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "hsl(209 65% 21% / 0.6)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "")}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* header */}
        <div className="px-7 pt-8 pb-5">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "hsl(154 100% 49% / 0.1)",
                border: "1px solid hsl(154 100% 49% / 0.2)",
              }}
            >
              <BookOpen className="h-5 w-5" style={{ color: "hsl(154 100% 49%)" }} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white leading-tight">
                Welcome, {companyName}!
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "hsl(210 30% 55%)" }}>
                Exhibitor Portal — Getting Started
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed" style={{ color: "hsl(210 25% 70%)" }}>
            Before you begin, please review the exhibition manual and complete
            the tasks below. All materials must be submitted before the deadlines.
          </p>
        </div>

        {/* tasks list */}
        <div className="px-7 pb-5 space-y-2">
          {TASKS.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-start gap-3 rounded-xl p-3"
              style={{
                background: "hsl(209 65% 10% / 0.7)",
                border: "1px solid hsl(209 65% 25% / 0.25)",
              }}
            >
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: "hsl(209 65% 21% / 0.6)" }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: "hsl(154 100% 49%)" }} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="text-xs mt-0.5" style={{ color: "hsl(210 25% 55%)" }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* divider */}
        <div className="mx-7 h-px" style={{ background: "hsl(209 65% 25% / 0.3)" }} />

        {/* actions */}
        <div className="px-7 py-5 flex items-center gap-3">
          <button
            onClick={() => ack(true)}
            disabled={isLoading}
            className="flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-150"
            style={{
              background: "linear-gradient(135deg, hsl(154 100% 42%), hsl(154 80% 36%))",
              color: "hsl(209 65% 10%)",
              boxShadow: "0 4px 16px hsl(154 100% 49% / 0.22)",
            }}
            onMouseEnter={(e) => !isLoading && ((e.currentTarget as HTMLElement).style.opacity = "0.9")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
          >
            {isLoading ? (
              <span className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                I have read the manual
              </>
            )}
          </button>

          <button
            onClick={() => ack(false)}
            disabled={isLoading}
            className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors"
            style={{
              background: "hsl(209 65% 21% / 0.4)",
              color: "hsl(210 30% 62%)",
              border: "1px solid hsl(209 65% 30% / 0.4)",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "hsl(210 40% 78%)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "hsl(210 30% 62%)")}
          >
            <Clock className="h-3.5 w-3.5" />
            View later
          </button>
        </div>
      </div>
    </div>
  );
}
