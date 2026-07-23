"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus, ShoppingCart, Trash2, BadgePercent, Send, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface CatalogItem {
  sku: string;
  name: string;
  price: number;
  note?: string;
}

interface CatalogCategory {
  category: string;
  items: CatalogItem[];
}

interface Catalog {
  discount_percent: number;
  categories: CatalogCategory[];
}

interface ExhibitorData {
  id: number;
  company_name: string;
  event_name: string;
}

type CartMap = Record<string, number>; // sku -> quantity

const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export default function EquipmentPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [exhibitor, setExhibitor] = useState<ExhibitorData | null>(null);
  const [cart, setCart] = useState<CartMap>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Catalog>("/portal/shop/catalog"),
      apiFetch<ExhibitorData>("/portal/me/exhibitor"),
    ])
      .then(([cat, ex]) => {
        setCatalog(cat);
        setExhibitor(ex);
      })
      .catch(() => toast.error("Failed to load the catalogue"))
      .finally(() => setLoading(false));
  }, []);

  const itemsBySku = useMemo(() => {
    const map: Record<string, CatalogItem> = {};
    catalog?.categories.forEach((c) => c.items.forEach((i) => (map[i.sku] = i)));
    return map;
  }, [catalog]);

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([sku, qty]) => ({ item: itemsBySku[sku], qty }))
        .filter((l) => l.item),
    [cart, itemsBySku],
  );

  const subtotal = cartLines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const discountPct = catalog?.discount_percent ?? 20;
  const discounted = Math.round(subtotal * (1 - discountPct / 100));

  const setQty = (sku: string, qty: number) =>
    setCart((c) => ({ ...c, [sku]: Math.max(0, Math.min(999, qty)) }));

  const submitOrder = async () => {
    if (!exhibitor || cartLines.length === 0) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ order_id: number }>(`/portal/exhibitors/${exhibitor.id}/equipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartLines.map((l) => ({ sku: l.item.sku, name: l.item.name, quantity: l.qty })),
          notes: notes.trim() || null,
        }),
      });
      setOrderId(res.order_id);
      setCart({});
      setNotes("");
      toast.success("Order sent to your manager");
    } catch {
      toast.error("Failed to send the order — please try again");
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="page-title">Equipment &amp; Sponsorship</h1>
        <p className="page-description">
          Marketing partnership packages, branded items and sponsorship opportunities
        </p>
      </div>

      {/* ── Sale banner ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-5 py-4 flex items-center gap-3 text-white shadow-[0_8px_24px_rgba(220,38,38,0.25)]"
        style={{ background: "linear-gradient(100deg, hsl(0 72% 45%), hsl(14 85% 52%))" }}
      >
        <BadgePercent className="h-7 w-7 shrink-0" />
        <div className="min-w-0">
          <p className="font-bold text-[15px] leading-tight">{discountPct}% discount on any package</p>
          <p className="text-[13px] text-white/85 leading-tight mt-0.5">
            The discount is applied by your manager on the final invoice
          </p>
        </div>
      </div>

      {orderId !== null && (
        <Card className="card-elevated border-emerald-200">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-6 w-6 shrink-0" style={{ color: "hsl(154 60% 38%)" }} />
            <div>
              <p className="font-semibold text-foreground">Order #{orderId} sent</p>
              <p className="text-sm text-muted-foreground">
                Your manager will prepare an invoice with the {discountPct}% discount and contact you shortly.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px] items-start">
        {/* ── Catalogue ───────────────────────────────────────── */}
        <div className="space-y-6 min-w-0">
          {catalog?.categories.map((cat) => (
            <Card key={cat.category} className="card-elevated">
              <CardContent className="pt-5 pb-2">
                <h2 className="font-semibold text-foreground mb-3">{cat.category}</h2>
                <ul className="divide-y divide-slate-100">
                  {cat.items.map((item) => {
                    const qty = cart[item.sku] || 0;
                    return (
                      <li key={item.sku} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground leading-snug">{item.name}</p>
                          {item.note && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>
                          )}
                        </div>
                        <span className="text-sm font-semibold whitespace-nowrap tabular-nums text-foreground">
                          {eur(item.price)}
                        </span>
                        {qty === 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => setQty(item.sku, 1)}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Add
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setQty(item.sku, qty - 1)}>
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-8 text-center text-sm font-semibold tabular-nums">{qty}</span>
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setQty(item.sku, qty + 1)}>
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Cart ────────────────────────────────────────────── */}
        <Card className="card-elevated lg:sticky lg:top-4">
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" style={{ color: "hsl(209 65% 38%)" }} />
              <h2 className="font-semibold text-foreground">Your order</h2>
              {cartLines.length > 0 && (
                <span className="ml-auto text-xs font-semibold rounded-full px-2 py-0.5 bg-slate-100 text-slate-600">
                  {cartLines.reduce((s, l) => s + l.qty, 0)} item(s)
                </span>
              )}
            </div>

            {cartLines.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Cart is empty — add items from the catalogue
              </p>
            ) : (
              <>
                <ul className="space-y-2">
                  {cartLines.map((l) => (
                    <li key={l.item.sku} className="flex items-start gap-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="leading-snug text-foreground">{l.item.name}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {l.qty} × {eur(l.item.price)}
                        </p>
                      </div>
                      <span className="font-medium whitespace-nowrap tabular-nums">{eur(l.item.price * l.qty)}</span>
                      <button
                        aria-label={`Remove ${l.item.name}`}
                        className="text-slate-400 hover:text-red-500 transition-colors mt-0.5"
                        onClick={() => setQty(l.item.sku, 0)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{eur(subtotal)}</span>
                  </div>
                  <div className="flex justify-between font-medium" style={{ color: "hsl(0 72% 45%)" }}>
                    <span>Discount −{discountPct}%</span>
                    <span className="tabular-nums">−{eur(subtotal - discounted)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground text-base pt-1">
                    <span>Estimated total</span>
                    <span className="tabular-nums">{eur(discounted)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    Final price is confirmed in the invoice issued by your manager.
                  </p>
                </div>

                <Textarea
                  placeholder="Notes for your manager (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />

                <Button className="w-full" disabled={submitting} onClick={submitOrder}>
                  <Send className="h-4 w-4 mr-2" />
                  {submitting ? "Sending…" : "Send order to manager"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
