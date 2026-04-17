"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Upload, CheckCircle2, Clock, AlertCircle, RefreshCw } from "lucide-react";

// ─── Zone definitions (mirrors backend stand_matrix.py) ──────────────────────
interface ZoneDef {
  x: number; y: number; w: number; h: number; // percent of image dimensions
  label: string;
  color: string; // HSL highlight color
}

type ZoneMap = Record<string, ZoneDef>;

const ZONES: Record<string, ZoneMap> = {
  LINEAR: {
    fascia_1:        { x:11.5, y: 4.5, w:48.0, h:11.5, label:"Fascia (Left)",    color:"196 100% 50%" },
    fascia_2:        { x:59.5, y: 4.5, w:29.0, h:11.5, label:"Fascia (Center)",  color:"196 100% 50%" },
    fascia_3:        { x:76.0, y: 4.5, w:14.0, h:11.5, label:"Fascia (Right)",   color:"196 100% 50%" },
    banner_eyelet_1: { x:13.0, y:17.5, w:24.0, h:54.0, label:"Banner 1",         color:"154 100% 49%" },
    banner_eyelet_2: { x:38.0, y:17.5, w:23.0, h:54.0, label:"Banner 2",         color:"154 100% 49%" },
    banner_eyelet_3: { x:52.0, y:17.5, w:19.5, h:44.0, label:"Banner 3",         color:"154 100% 49%" },
    information_desk:{ x:54.5, y:53.0, w:24.5, h:21.0, label:"Information Desk", color:"45 96% 48%"   },
  },
  ANGULAR: {
    fascia_1:        { x: 5.0, y: 9.0, w:43.0, h: 9.5, label:"Fascia (Left Wall)",  color:"196 100% 50%" },
    fascia_2:        { x:47.5, y: 6.0, w:47.5, h: 9.5, label:"Fascia (Right Wall)", color:"196 100% 50%" },
    banner_eyelet_1: { x: 5.0, y:19.0, w:43.0, h:66.0, label:"Banner (Left Wall)",  color:"154 100% 49%" },
    banner_eyelet_2: { x:47.5, y:15.5, w:47.5, h:64.5, label:"Banner (Right Wall)", color:"154 100% 49%" },
    information_desk:{ x:35.0, y:57.0, w:26.0, h:24.0, label:"Information Desk",    color:"45 96% 48%"   },
  },
  PENINSULA: {
    fascia_1:        { x: 5.0, y: 4.5, w:30.0, h:10.5, label:"Fascia (Left)",    color:"196 100% 50%" },
    fascia_2:        { x:35.0, y: 4.5, w:30.0, h:10.5, label:"Fascia (Center)",  color:"196 100% 50%" },
    fascia_3:        { x:65.0, y: 4.5, w:18.0, h:10.5, label:"Fascia (Right)",   color:"196 100% 50%" },
    banner_eyelet_1: { x: 5.0, y:16.0, w:28.0, h:52.0, label:"Banner (Left)",    color:"154 100% 49%" },
    banner_eyelet_2: { x:36.0, y:16.0, w:28.0, h:52.0, label:"Banner (Right)",   color:"154 100% 49%" },
    information_desk:{ x:40.0, y:55.0, w:20.0, h:22.0, label:"Information Desk", color:"45 96% 48%"   },
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface GraphicSlot {
  id: string;        // slot key, e.g. "banner_eyelet_1"
  label: string;
  status: string;    // "not_uploaded" | "under_review" | "approved" | "revision"
  preview_url?: string;
}

interface Props {
  backdropUrl: string | null;   // presigned S3 URL for the wireframe backdrop
  standConfiguration: string;   // "LINEAR" | "ANGULAR" | "PENINSULA"
  slots: GraphicSlot[];
  onUpload: (slotId: string, file: File) => void;
  uploading: string | null;     // slotId currently uploading, or null
  uploadProgress: Record<string, number>;
  locked: boolean;
}

// ─── Status helpers ───────────────────────────────────────────────────────────
function slotStatusColor(status: string) {
  if (status === "approved")     return "154 100% 49%";
  if (status === "under_review") return "45 96% 48%";
  if (status === "revision")     return "0 72% 51%";
  return null;
}

function SlotStatusIcon({ status, size = 14 }: { status: string; size?: number }) {
  const s = { width: size, height: size };
  if (status === "approved")     return <CheckCircle2 style={{ ...s, color: `hsl(154 100% 49%)` }} />;
  if (status === "under_review") return <Clock        style={{ ...s, color: `hsl(45 96% 48%)`  }} />;
  if (status === "revision")     return <AlertCircle  style={{ ...s, color: `hsl(0 72% 51%)`   }} />;
  return <Upload style={{ ...s, color: "hsl(213 20% 55%)" }} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function StandZoneOverlay({
  backdropUrl,
  standConfiguration,
  slots,
  onUpload,
  uploading,
  uploadProgress,
  locked,
}: Props) {
  const imgRef          = useRef<HTMLImageElement>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [dragOver, setDragOver]         = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const config = standConfiguration?.toUpperCase() ?? "LINEAR";
  const zoneMap: ZoneMap = ZONES[config] ?? ZONES.LINEAR;

  // Compute zone rects in pixel space once image dimensions are known
  const recalc = useCallback(() => {
    const el = imgRef.current;
    if (!el) return;
    setImgSize({ w: el.offsetWidth, h: el.offsetHeight });
  }, []);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    if (el.complete) recalc();
    return () => ro.disconnect();
  }, [recalc, backdropUrl]);

  // Slot lookup by id
  const slotById: Record<string, GraphicSlot> = {};
  for (const s of slots) slotById[s.id] = s;

  const handleZoneClick = (zoneId: string) => {
    if (locked) return;
    const slot = slotById[zoneId];
    if (!slot) return;
    if (slot.status === "approved") return;
    setSelectedZone(zoneId);
    fileInputRefs.current[zoneId]?.click();
  };

  const handleFilePicked = (zoneId: string, file: File) => {
    setSelectedZone(null);
    onUpload(zoneId, file);
  };

  const handleDrop = (zoneId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    if (locked) return;
    const slot = slotById[zoneId];
    if (!slot || slot.status === "approved") return;
    const file = e.dataTransfer.files[0];
    if (file) handleFilePicked(zoneId, file);
  };

  if (!backdropUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-16 rounded-2xl gap-3"
        style={{ border: "2px dashed hsl(213 20% 82%)", background: "hsl(213 20% 97%)" }}>
        <div className="h-12 w-12 rounded-2xl flex items-center justify-center"
          style={{ background: "hsl(213 20% 92%)" }}>
          <Upload className="h-5 w-5" style={{ color: "hsl(213 20% 52%)" }} />
        </div>
        <p className="text-sm font-medium" style={{ color: "hsl(213 20% 40%)" }}>
          Stand backdrop not yet configured
        </p>
        <p className="text-xs" style={{ color: "hsl(213 20% 58%)" }}>
          Ask the organiser to upload the stand wireframe template
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Canvas area ── */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          border: "1px solid hsl(213 20% 84%)",
          background: "hsl(213 20% 97%)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}
      >
        {/* ── Backdrop image ── */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={backdropUrl}
          alt="Stand wireframe"
          onLoad={recalc}
          className="block w-full"
          style={{ display: "block", userSelect: "none", pointerEvents: "none" }}
          draggable={false}
        />

        {/* ── SVG Zone Overlay ── */}
        {imgSize && (
          <svg
            width={imgSize.w}
            height={imgSize.h}
            style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
          >
            {Object.entries(zoneMap).map(([zoneId, zone]) => {
              const slot   = slotById[zoneId];
              if (!slot) return null;

              const px = (zone.x / 100) * imgSize.w;
              const py = (zone.y / 100) * imgSize.h;
              const pw = (zone.w / 100) * imgSize.w;
              const ph = (zone.h / 100) * imgSize.h;

              const isHovered   = hoveredZone === zoneId;
              const isDragOver  = dragOver === zoneId;
              const isUploading = uploading === zoneId;
              const isApproved  = slot.status === "approved";
              const hasFile     = slot.status !== "not_uploaded";
              const isInteractive = !locked && !isApproved;

              const statusColor = slotStatusColor(slot.status);
              const zoneColor   = zone.color;

              const fillOpacity = isUploading ? 0.18
                : isDragOver    ? 0.22
                : isHovered     ? 0.14
                : hasFile       ? 0.06
                : 0.0;

              const strokeOpacity = isUploading ? 0.9
                : isDragOver    ? 1.0
                : isHovered     ? 0.85
                : hasFile       ? 0.55
                : 0.35;

              const strokeColor = statusColor
                ? `hsl(${statusColor})`
                : isHovered || isDragOver
                  ? `hsl(${zoneColor})`
                  : "hsl(213 20% 60%)";

              return (
                <g key={zoneId}>
                  {/* ── Uploaded image preview clipped to zone ── */}
                  {slot.preview_url && (
                    <foreignObject x={px} y={py} width={pw} height={ph}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={slot.preview_url}
                        alt={slot.label}
                        style={{
                          width:  "100%",
                          height: "100%",
                          objectFit: "fill",
                          opacity: isHovered ? 0.75 : 0.9,
                          display: "block",
                        }}
                        draggable={false}
                      />
                    </foreignObject>
                  )}

                  {/* ── Zone fill & border ── */}
                  <rect
                    x={px} y={py} width={pw} height={ph}
                    fill={`hsl(${zoneColor})`}
                    fillOpacity={fillOpacity}
                    stroke={strokeColor}
                    strokeWidth={isHovered || isDragOver ? 2 : 1.5}
                    strokeDasharray={hasFile ? "none" : "6 3"}
                    strokeOpacity={strokeOpacity}
                    rx={3}
                    style={{
                      cursor: isInteractive ? "pointer" : "default",
                      transition: "fill-opacity 0.15s, stroke-opacity 0.15s",
                    }}
                    onMouseEnter={() => setHoveredZone(zoneId)}
                    onMouseLeave={() => setHoveredZone(null)}
                    onClick={() => handleZoneClick(zoneId)}
                    onDragOver={(e) => { if (isInteractive) { e.preventDefault(); setDragOver(zoneId); }}}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => handleDrop(zoneId, e)}
                  />

                  {/* ── Upload spinner overlay ── */}
                  {isUploading && (
                    <foreignObject x={px} y={py} width={pw} height={ph} style={{ pointerEvents: "none" }}>
                      <div
                        style={{
                          width: "100%", height: "100%",
                          display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center",
                          gap: 8,
                          background: `hsl(${zoneColor} / 0.08)`,
                        }}
                      >
                        <div style={{
                          width: 28, height: 28,
                          border: `3px solid hsl(${zoneColor} / 0.25)`,
                          borderTopColor: `hsl(${zoneColor})`,
                          borderRadius: "50%",
                          animation: "spin 0.8s linear infinite",
                        }} />
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: `hsl(${zoneColor})`,
                          letterSpacing: "0.02em",
                          textShadow: "0 1px 3px rgba(255,255,255,0.8)",
                        }}>
                          {uploadProgress[zoneId] ?? 0}%
                        </span>
                      </div>
                    </foreignObject>
                  )}

                  {/* ── Zone label tooltip on hover ── */}
                  {isHovered && !isUploading && (
                    <foreignObject
                      x={Math.max(4, Math.min(px + pw / 2 - 70, imgSize.w - 148))}
                      y={py > 60 ? py - 38 : py + 6}
                      width={140}
                      height={32}
                      style={{ pointerEvents: "none" }}
                    >
                      <div style={{
                        background: "hsl(209 65% 12%)",
                        border: `1px solid hsl(${zoneColor} / 0.4)`,
                        borderRadius: 8,
                        padding: "4px 10px",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                        whiteSpace: "nowrap",
                      }}>
                        {isInteractive
                          ? <Upload style={{ width: 11, height: 11, color: `hsl(${zoneColor})`, flexShrink: 0 }} />
                          : <CheckCircle2 style={{ width: 11, height: 11, color: `hsl(154 100% 49%)`, flexShrink: 0 }} />
                        }
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          color: "white",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>
                          {isInteractive ? `Upload ${zone.label}` : zone.label}
                        </span>
                      </div>
                    </foreignObject>
                  )}

                  {/* ── Status badge corner ── */}
                  {hasFile && !isUploading && (
                    <foreignObject
                      x={px + pw - 26}
                      y={py + 4}
                      width={22}
                      height={22}
                      style={{ pointerEvents: "none" }}
                    >
                      <div style={{
                        width: 22, height: 22,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.95)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                      }}>
                        <SlotStatusIcon status={slot.status} size={13} />
                      </div>
                    </foreignObject>
                  )}

                  {/* ── "Replace" button on hover for uploaded zones ── */}
                  {isHovered && isInteractive && hasFile && !isUploading && (
                    <foreignObject
                      x={px + pw / 2 - 44}
                      y={py + ph / 2 - 15}
                      width={88}
                      height={30}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleZoneClick(zoneId)}
                    >
                      <div style={{
                        background: "hsl(209 65% 12% / 0.92)",
                        border: `1px solid hsl(${zoneColor} / 0.5)`,
                        borderRadius: 20,
                        padding: "4px 12px",
                        display: "flex", alignItems: "center", gap: 5,
                        cursor: "pointer",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
                      }}>
                        <RefreshCw style={{ width: 11, height: 11, color: `hsl(${zoneColor})` }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: "white" }}>Replace</span>
                      </div>
                    </foreignObject>
                  )}

                  {/* ── Click-to-upload hint for empty zones ── */}
                  {isHovered && isInteractive && !hasFile && !isUploading && (
                    <foreignObject
                      x={px + pw / 2 - 55}
                      y={py + ph / 2 - 15}
                      width={110}
                      height={30}
                      style={{ pointerEvents: "none" }}
                    >
                      <div style={{
                        background: `hsl(${zoneColor} / 0.12)`,
                        border: `1px solid hsl(${zoneColor} / 0.4)`,
                        borderRadius: 20,
                        padding: "4px 12px",
                        display: "flex", alignItems: "center", gap: 5,
                        backdropFilter: "blur(4px)",
                      }}>
                        <Upload style={{ width: 11, height: 11, color: `hsl(${zoneColor})` }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: `hsl(${zoneColor})` }}>
                          Click to upload
                        </span>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {/* ── Hint pill ── */}
        {!locked && (
          <div
            style={{
              position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
              background: "hsl(209 65% 12% / 0.85)",
              border: "1px solid hsl(209 65% 30% / 0.4)",
              borderRadius: 20, padding: "5px 14px",
              fontSize: 11, fontWeight: 600, color: "hsl(210 30% 72%)",
              backdropFilter: "blur(8px)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            Click a zone to upload · or drag & drop a file
          </div>
        )}
      </div>

      {/* ── Zone Legend ── */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
      >
        {Object.entries(zoneMap).map(([zoneId, zone]) => {
          const slot = slotById[zoneId];
          if (!slot) return null;
          const isUploading = uploading === zoneId;
          const isInteractive = !locked && slot.status !== "approved";

          return (
            <button
              key={zoneId}
              onClick={() => isInteractive && handleZoneClick(zoneId)}
              onMouseEnter={() => setHoveredZone(zoneId)}
              onMouseLeave={() => setHoveredZone(null)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderRadius: 10,
                background: hoveredZone === zoneId
                  ? `hsl(${zone.color} / 0.08)`
                  : "hsl(213 20% 97%)",
                border: `1px solid ${hoveredZone === zoneId ? `hsl(${zone.color} / 0.35)` : "hsl(213 20% 88%)"}`,
                cursor: isInteractive ? "pointer" : "default",
                textAlign: "left",
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              {/* Color dot */}
              <span style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: `hsl(${zone.color})`,
                boxShadow: `0 0 6px hsl(${zone.color} / 0.5)`,
              }} />
              <span style={{
                flex: 1, fontSize: 12, fontWeight: 500,
                color: "hsl(213 15% 35%)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {zone.label}
              </span>
              <span style={{ flexShrink: 0 }}>
                {isUploading
                  ? <span style={{ fontSize: 10, color: `hsl(${zone.color})`, fontWeight: 700 }}>
                      {uploadProgress[zoneId] ?? 0}%
                    </span>
                  : <SlotStatusIcon status={slot.status} size={13} />
                }
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Hidden file inputs per zone ── */}
      {Object.keys(zoneMap).map((zoneId) => (
        <input
          key={zoneId}
          type="file"
          accept=".tiff,.tif,.pdf"
          style={{ display: "none" }}
          ref={(el) => { fileInputRefs.current[zoneId] = el; }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFilePicked(zoneId, f);
            // reset so same file can be re-selected
            if (e.target) e.target.value = "";
          }}
        />
      ))}

      {/* CSS for spinner */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
