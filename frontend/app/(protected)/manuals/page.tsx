"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Download, FileText } from "lucide-react";
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

const isPdfDoc = (d: EventDoc) => {
  if (!d.download_url && !d.s3_key) return false;
  const name = (d.download_url || d.s3_key || "").toLowerCase();
  return name.includes(".pdf");
};

export default function ManualsPage() {
  const [docs, setDocs] = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<{ event_id: number }>("/portal/me/exhibitor")
      .then((ex) =>
        apiFetch<EventDoc[]>(`/portal/events/${ex.event_id}/documents`)
      )
      .then((list) => {
        setDocs(list);
        if (list.length) setSelectedId(list[0].id);
      })
      .catch(() => toast.error("Failed to load documents"))
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(
    () => docs.find((d) => d.id === selectedId) ?? null,
    [docs, selectedId]
  );

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

  // No documents at all
  if (docs.length === 0) {
    return (
      <div className="space-y-6 animate-fade-up">
        <div>
          <h1 className="page-title">Exhibitor Manuals</h1>
          <p className="page-description">Official documentation and guidelines for your exhibition</p>
        </div>
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-20 gap-4"
          style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
        >
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: "hsl(209 65% 21% / 0.07)" }}
          >
            <BookOpen className="h-7 w-7" style={{ color: "hsl(209 65% 38%)" }} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">No documents yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Exhibition manuals will appear here once published
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="page-title">Exhibitor Manuals</h1>
        <p className="page-description">Official documentation · viewer opens immediately</p>
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: docs.length > 1 ? "260px 1fr" : "1fr" }}
      >
        {/* ── Sidebar list (only when multiple documents) ── */}
        {docs.length > 1 && (
          <aside
            className="rounded-2xl overflow-hidden h-[calc(100vh-220px)] min-h-[520px] flex flex-col"
            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
          >
            <div
              className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ color: "hsl(210 10% 55%)", borderBottom: "1px solid hsl(var(--border))" }}
            >
              {docs.length} document{docs.length !== 1 ? "s" : ""}
            </div>
            <ul className="flex-1 overflow-y-auto p-2 space-y-1">
              {docs.map((doc) => {
                const active = doc.id === selectedId;
                return (
                  <li key={doc.id}>
                    <button
                      onClick={() => setSelectedId(doc.id)}
                      className="w-full text-left rounded-lg px-3 py-2.5 flex items-start gap-2.5 transition-colors"
                      style={{
                        background: active ? "hsl(154 80% 94%)" : "transparent",
                        border: active
                          ? "1px solid hsl(154 60% 78%)"
                          : "1px solid transparent",
                        color: active ? "hsl(154 70% 24%)" : "hsl(210 12% 30%)",
                      }}
                    >
                      <div
                        className="h-7 w-7 rounded-md flex items-center justify-center shrink-0"
                        style={{
                          background: active
                            ? "hsl(154 70% 38% / 0.15)"
                            : "hsl(209 65% 21% / 0.07)",
                        }}
                      >
                        <FileText
                          className="h-3.5 w-3.5"
                          style={{
                            color: active ? "hsl(154 70% 30%)" : "hsl(209 65% 38%)",
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-xs font-semibold truncate"
                          style={{ color: active ? "hsl(154 70% 22%)" : "hsl(209 65% 22%)" }}
                        >
                          {doc.title}
                        </p>
                        <p
                          className="text-[10px] mt-0.5 capitalize"
                          style={{ color: active ? "hsl(154 40% 34%)" : "hsl(210 10% 52%)" }}
                        >
                          {doc.doc_type.replace(/_/g, " ")} · v{doc.version_label}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}

        {/* ── PDF viewer ── */}
        <section
          className="rounded-2xl overflow-hidden flex flex-col h-[calc(100vh-220px)] min-h-[520px]"
          style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
        >
          {selected && (
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom: "1px solid hsl(var(--border))" }}
            >
              <div className="min-w-0">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: "hsl(209 65% 22%)" }}
                >
                  {selected.title}
                </p>
                <p className="text-[11px] mt-0.5 capitalize" style={{ color: "hsl(210 10% 52%)" }}>
                  {selected.doc_type.replace(/_/g, " ")} · v{selected.version_label}
                </p>
              </div>
              {selected.download_url && (
                <a
                  href={selected.download_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                  style={{
                    background: "hsl(210 18% 96%)",
                    color: "hsl(209 65% 28%)",
                    border: "1px solid hsl(210 18% 86%)",
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              )}
            </div>
          )}

          <div className="flex-1 min-h-0" style={{ background: "hsl(210 18% 96%)" }}>
            {selected?.download_url ? (
              isPdfDoc(selected) ? (
                <iframe
                  key={selected.id}
                  src={`${selected.download_url}#view=FitH&toolbar=1`}
                  title={selected.title}
                  className="w-full h-full"
                  style={{ border: 0, background: "white" }}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center"
                    style={{ background: "hsl(209 65% 21% / 0.07)" }}
                  >
                    <FileText className="h-7 w-7" style={{ color: "hsl(209 65% 38%)" }} />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    Inline preview not supported for this file type
                  </p>
                  <a
                    href={selected.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
                    style={{
                      background: "hsl(154 70% 38%)",
                      color: "white",
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download to view
                  </a>
                </div>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Select a document to preview
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
