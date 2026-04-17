"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface EventDoc {
  id: number;
  doc_type: string;
  title: string;
  s3_key: string;
  version_label: string;
  download_url?: string;
}

export default function ManualsPage() {
  const [docs, setDocs] = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ event_id: number }>("/portal/me/exhibitor")
      .then((ex) =>
        apiFetch<EventDoc[]>(`/portal/events/${ex.event_id}/documents`)
      )
      .then(setDocs)
      .catch(() => toast.error("Failed to load documents"))
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
        <h1 className="page-title">Exhibitor Manuals</h1>
        <p className="page-description">Official documentation and guidelines for your exhibition</p>
      </div>

      {docs.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
              style={{ background: "hsl(209 65% 21% / 0.07)" }}>
              <BookOpen className="h-7 w-7" style={{ color: "hsl(209 65% 38%)" }} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">No documents yet</p>
              <p className="text-sm text-muted-foreground mt-1">Exhibition manuals will appear here once published</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <div key={doc.id}
              className="flex items-center gap-4 rounded-xl p-4"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
            >
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "hsl(209 65% 21% / 0.07)" }}>
                <FileText className="h-5 w-5" style={{ color: "hsl(209 65% 38%)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{doc.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                  {doc.doc_type.replace(/_/g, " ")} · v{doc.version_label}
                </p>
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
    </div>
  );
}
