"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Download, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface ExhibitorData {
  event_id: number;
  event_name: string;
  deadline_graphics: string | null;
  deadline_company_profile: string | null;
  deadline_participants: string | null;
  deadline_final_graphics: string | null;
}

interface EventDoc {
  id: number;
  doc_type: string;
  title: string;
  download_url?: string;
}

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.floor(diff / 86400000);
  if (diff < 0) return "Expired";
  if (days === 0) return "Today";
  return `${days}d remaining`;
}

export default function SetupSchedulePage() {
  const [data, setData] = useState<ExhibitorData | null>(null);
  const [scheduleDocs, setScheduleDocs] = useState<EventDoc[]>([]);

  useEffect(() => {
    apiFetch<ExhibitorData>("/portal/me/exhibitor")
      .then(async (ex) => {
        setData(ex);
        try {
          const docs = await apiFetch<EventDoc[]>(`/portal/events/${ex.event_id}/documents`);
          setScheduleDocs(docs.filter((d) => d.doc_type === "setup_schedule"));
        } catch {
          // no docs yet
        }
      })
      .catch(() => toast.error("Failed to load schedule"));
  }, []);

  const deadlines = data ? [
    { label: "Initial Graphics", date: data.deadline_graphics, color: "hsl(209 65% 45%)" },
    { label: "Company Profile", date: data.deadline_company_profile, color: "hsl(209 65% 45%)" },
    { label: "Participants List", date: data.deadline_participants, color: "hsl(209 65% 45%)" },
    { label: "Final Graphics", date: data.deadline_final_graphics, color: "hsl(154 60% 38%)" },
  ] : [];

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="page-title">Setup Schedule</h1>
        <p className="page-description">
          Arrival schedule and key deadlines for{" "}
          <span className="font-semibold text-foreground">{data?.event_name ?? "your event"}</span>
        </p>
      </div>

      {/* Arrival schedule document */}
      {scheduleDocs.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documents</p>
          {scheduleDocs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-4 rounded-xl p-4"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "hsl(209 65% 21% / 0.07)" }}>
                <FileText className="h-5 w-5" style={{ color: "hsl(209 65% 38%)" }} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{doc.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Arrival & setup schedule PDF</p>
              </div>
              {doc.download_url && (
                <Button variant="outline" size="sm" asChild className="gap-2 shrink-0">
                  <a href={doc.download_url} target="_blank" rel="noreferrer">
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Deadlines timeline */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key Deadlines</p>
        {deadlines.map((dl, i) => (
          <div key={i} className="relative flex items-center gap-4 rounded-xl p-4"
            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
            <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
              style={{ background: dl.color }} />
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "hsl(209 65% 21% / 0.06)" }}>
              <Clock className="h-5 w-5" style={{ color: "hsl(209 65% 38%)" }} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">{dl.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {dl.date ? new Date(dl.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "Not set"}
              </p>
            </div>
            <span className="text-xs font-semibold shrink-0 tabular-nums"
              style={{ color: dl.date && new Date(dl.date) < new Date() ? "hsl(0 72% 51%)" : "hsl(154 60% 35%)" }}>
              {daysUntil(dl.date)}
            </span>
          </div>
        ))}
      </div>

      {!data && (
        <Card className="card-elevated">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
              style={{ background: "hsl(209 65% 21% / 0.07)" }}>
              <CalendarDays className="h-7 w-7" style={{ color: "hsl(209 65% 38%)" }} />
            </div>
            <p className="text-sm text-muted-foreground">Loading schedule…</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
