"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ReceiptText, ChevronDown, ChevronUp } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  unit_price: number | null;
  line_total: number;
}

interface Order {
  id: number;
  status: string;
  notes: string | null;
  created_at: string;
  company_name: string;
  exhibitor_id: number;
  event_id: number;
  event_name: string;
  items: OrderItem[];
  total: number;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  SUBMITTED: {
    label: "New",
    color: "hsl(209 65% 38%)",
    bg: "hsl(209 65% 21% / 0.08)",
    border: "hsl(209 65% 21% / 0.2)",
  },
  INVOICE_SENT: {
    label: "Invoice sent — awaiting payment",
    color: "hsl(45 80% 30%)",
    bg: "hsl(45 100% 94%)",
    border: "hsl(45 80% 82%)",
  },
  PAID: {
    label: "Paid",
    color: "hsl(154 60% 35%)",
    bg: "hsl(154 80% 94%)",
    border: "hsl(154 60% 82%)",
  },
};

const STATUS_OPTIONS = ["SUBMITTED", "INVOICE_SENT", "PAID"] as const;

const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("All");

  useEffect(() => {
    apiFetch<Order[]>("/admin/orders")
      .then(setOrders)
      .catch(() => toast.error("Failed to load orders"))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () => (statusFilter === "All" ? orders : orders.filter((o) => o.status === statusFilter)),
    [orders, statusFilter],
  );

  const toggle = (id: number) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setStatus = async (order: Order, status: string) => {
    const prev = order.status;
    setOrders((os) => os.map((o) => (o.id === order.id ? { ...o, status } : o)));
    try {
      await apiFetch(`/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      toast.success(`Order #${order.id}: ${STATUS_META[status]?.label ?? status}`);
    } catch {
      setOrders((os) => os.map((o) => (o.id === order.id ? { ...o, status: prev } : o)));
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="page-title">Orders</h1>
        <p className="page-description">
          Sponsorship and equipment orders from exhibitors. Invoices are issued manually with the discount applied.
        </p>
      </div>

      {/* ── Status filter ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {["All", ...STATUS_OPTIONS].map((s) => {
          const active = statusFilter === s;
          const meta = STATUS_META[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors"
              style={
                active
                  ? { background: "hsl(209 65% 21%)", color: "#fff", borderColor: "hsl(209 65% 21%)" }
                  : { background: "#fff", color: "hsl(215 15% 40%)", borderColor: "hsl(214 20% 88%)" }
              }
            >
              {s === "All" ? "All" : meta?.label ?? s}
              {s !== "All" && (
                <span className="ml-1.5 opacity-70">{orders.filter((o) => o.status === s).length}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <span
            className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "hsl(209 65% 21% / 0.2)", borderTopColor: "hsl(209 65% 21%)" }}
          />
        </div>
      ) : visible.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center"
              style={{ background: "hsl(209 65% 21% / 0.07)" }}
            >
              <ReceiptText className="h-7 w-7" style={{ color: "hsl(209 65% 38%)" }} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">No orders yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Orders sent by exhibitors from the Equipment section will appear here
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((o) => {
            const meta = STATUS_META[o.status] ?? STATUS_META.SUBMITTED;
            const isOpen = expanded.has(o.id);
            return (
              <Card key={o.id} className="card-elevated overflow-hidden">
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <button
                      onClick={() => toggle(o.id)}
                      className="flex items-center gap-2 text-left min-w-0 flex-1"
                    >
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          #{o.id} · {o.company_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {o.event_name} · {new Date(o.created_at).toLocaleString("en-GB")}
                        </p>
                      </div>
                    </button>

                    <span className="font-bold tabular-nums whitespace-nowrap">{eur(o.total)}</span>

                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-semibold border whitespace-nowrap"
                      style={{ color: meta.color, background: meta.bg, borderColor: meta.border }}
                    >
                      {meta.label}
                    </span>

                    <select
                      value={o.status}
                      onChange={(e) => setStatus(o, e.target.value)}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_META[s].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isOpen && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="py-1.5 font-semibold">Item</th>
                            <th className="py-1.5 font-semibold text-right">Qty</th>
                            <th className="py-1.5 font-semibold text-right">Unit price</th>
                            <th className="py-1.5 font-semibold text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {o.items.map((it) => (
                            <tr key={it.sku} className="border-t border-slate-50">
                              <td className="py-1.5 pr-2">{it.name}</td>
                              <td className="py-1.5 text-right tabular-nums">{it.quantity}</td>
                              <td className="py-1.5 text-right tabular-nums">
                                {it.unit_price != null ? eur(it.unit_price) : "—"}
                              </td>
                              <td className="py-1.5 text-right tabular-nums font-medium">{eur(it.line_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {o.notes && (
                        <p className="mt-3 text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">Notes: </span>
                          {o.notes}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
