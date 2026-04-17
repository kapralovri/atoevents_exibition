"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Calendar, MapPin, Globe, ArrowRight, Layers } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";

interface MyEvent {
  id: number;
  event_id: number;
  event_name: string;
  deadline_graphics: string | null;
  deadline_participants: string | null;
  stand_package: string;
  area_m2: number;
  graphics_status: string;
  description_status: string;
  participants_status: string;
}

export default function ExhibitorEventsPage() {
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<MyEvent>("/portal/me/exhibitor")
      .then((data) => setEvents([data]))
      .catch(() => toast.error("Failed to load events"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "hsl(209 65% 21% / 0.2)", borderTopColor: "hsl(209 65% 21%)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="page-title">My Exhibitions</h1>
        <p className="page-description">{events.length} event{events.length !== 1 ? "s" : ""} you are registered for</p>
      </div>

      {events.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
              style={{ background: "hsl(209 65% 21% / 0.07)" }}>
              <Layers className="h-7 w-7" style={{ color: "hsl(209 65% 38%)" }} />
            </div>
            <p className="text-sm text-muted-foreground">No exhibitions assigned yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <Link key={ev.event_id} href="/tasks">
              <div className="group relative flex items-center gap-5 rounded-xl cursor-pointer overflow-hidden transition-all duration-200"
                style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", padding: "16px 20px" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "hsl(209 65% 21% / 0.3)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px hsl(209 65% 21% / 0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "";
                  (e.currentTarget as HTMLElement).style.boxShadow = "";
                }}
              >
                {/* Left accent */}
                <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full"
                  style={{ background: "linear-gradient(180deg, hsl(154 100% 49%), hsl(209 65% 45%))" }} />

                {/* Icon */}
                <div className="shrink-0 h-12 w-12 rounded-xl flex items-center justify-center"
                  style={{ background: "hsl(209 65% 21% / 0.08)" }}>
                  <Calendar className="h-6 w-6" style={{ color: "hsl(209 65% 38%)" }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{ev.event_name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground capitalize">
                      {ev.stand_package?.replace("_", " ")} · {ev.area_m2} m²
                    </span>
                  </div>
                </div>

                {/* Statuses */}
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={ev.graphics_status} />
                  <StatusBadge status={ev.description_status} />
                  <StatusBadge status={ev.participants_status} />
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
