"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  X,
  UsersRound,
  Mail,
  KeyRound,
  Copy,
  Check,
  UserX,
  UserCheck,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

interface Manager {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at?: string | null;
}

interface NewManagerForm {
  full_name: string;
  email: string;
  send_welcome: boolean;
}

interface CreatedCredentials {
  email: string;
  password: string;
}

function blankForm(): NewManagerForm {
  return { full_name: "", email: "", send_welcome: true };
}

function validateEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function initials(name: string, email: string): string {
  const src = (name || email || "").trim();
  return (
    src
      .split(/[\s@.]+/)
      .filter(Boolean)
      .map((w) => w[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "?"
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminManagersPage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewManagerForm>(blankForm());
  const [errors, setErrors] = useState<{ full_name?: string; email?: string }>({});
  const [isCreating, setIsCreating] = useState(false);
  const [created, setCreated] = useState<CreatedCredentials | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    loadManagers();
  }, []);

  async function loadManagers() {
    setLoading(true);
    try {
      const data = await apiFetch<Manager[]>("/admin/managers");
      setManagers(data);
    } catch {
      toast.error("Failed to load managers");
    } finally {
      setLoading(false);
    }
  }

  function validate(): boolean {
    const e: { full_name?: string; email?: string } = {};
    if (!form.email || !validateEmail(form.email)) e.email = "Valid email required";
    if (form.full_name && form.full_name.trim().length < 2) e.full_name = "Too short";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsCreating(true);
    try {
      const res = await apiFetch<Manager & { temporary_password: string }>("/admin/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          full_name: form.full_name.trim() || null,
          send_welcome: form.send_welcome,
        }),
      });
      toast.success("Manager added");
      setCreated({ email: res.email, password: res.temporary_password });
      setForm(blankForm());
      setShowCreate(false);
      await loadManagers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add manager");
    } finally {
      setIsCreating(false);
    }
  }

  async function toggleActive(m: Manager) {
    setBusyId(m.id);
    try {
      if (m.is_active) {
        await apiFetch(`/admin/managers/${m.id}`, { method: "DELETE" });
        toast.success(`${m.full_name || m.email} deactivated`);
      } else {
        await apiFetch(`/admin/managers/${m.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: true }),
        });
        toast.success(`${m.full_name || m.email} reactivated`);
      }
      await loadManagers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(m: Manager) {
    if (!confirm(`Reset password for ${m.full_name || m.email}?`)) return;
    setBusyId(m.id);
    try {
      const res = await apiFetch<{ temporary_password: string }>(
        `/admin/managers/${m.id}/reset-password`,
        { method: "POST" },
      );
      setCreated({ email: m.email, password: res.temporary_password });
      toast.success("Password reset");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusyId(null);
    }
  }

  async function copyCreds() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(`${created.email} / ${created.password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copy failed");
    }
  }

  const activeCount = managers.filter((m) => m.is_active).length;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 animate-fade-up">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Managers</h1>
          <p className="page-description">
            {managers.length} manager{managers.length !== 1 ? "s" : ""} · {activeCount} active ·
            assignable as event responsible / observers
          </p>
        </div>
        <Button
          onClick={() => {
            setShowCreate((v) => !v);
            setErrors({});
            if (showCreate) setForm(blankForm());
          }}
          className="gap-2"
        >
          {showCreate ? (
            <><X className="h-4 w-4" />Cancel</>
          ) : (
            <><Plus className="h-4 w-4" />Add Manager</>
          )}
        </Button>
      </div>

      {/* ── Just-created credentials banner ── */}
      {created && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3 animate-fade-up"
          style={{ background: "hsl(154 80% 95%)", border: "1px solid hsl(154 55% 78%)" }}
        >
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "hsl(154 60% 88%)" }}
          >
            <KeyRound className="h-4 w-4" style={{ color: "hsl(154 60% 26%)" }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold" style={{ color: "hsl(154 60% 22%)" }}>
              Temporary credentials — share securely
            </p>
            <p className="text-sm font-mono truncate" style={{ color: "hsl(154 60% 18%)" }}>
              {created.email} / {created.password}
            </p>
          </div>
          <button
            onClick={copyCreds}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5"
            style={{ background: "hsl(154 60% 88%)", color: "hsl(154 60% 22%)" }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={() => setCreated(null)}
            className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center hover:bg-black/5"
          >
            <X className="h-4 w-4" style={{ color: "hsl(154 30% 35%)" }} />
          </button>
        </div>
      )}

      {/* ── Create form ── */}
      {showCreate && (
        <Card className="card-elevated animate-fade-up" style={{ borderColor: "hsl(209 65% 21% / 0.2)" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "hsl(209 65% 21% / 0.08)" }}
              >
                <Plus className="h-4 w-4" style={{ color: "hsl(209 65% 38%)" }} />
              </div>
              Add Manager
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Full Name
                  </Label>
                  <Input
                    id="full_name"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Anastasia Zamotina"
                    className={errors.full_name ? "border-red-400" : ""}
                  />
                  {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Email<span className="text-red-500 ml-0.5">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="name@atocomm.eu"
                    className={errors.email ? "border-red-400" : ""}
                  />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.send_welcome}
                  onChange={(e) => setForm({ ...form, send_welcome: e.target.checked })}
                  className="h-4 w-4 rounded border-input accent-[hsl(209_65%_38%)]"
                />
                Send a welcome email with login credentials
              </label>

              <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-xs"
                style={{ background: "hsl(209 65% 21% / 0.05)", border: "1px solid hsl(209 65% 21% / 0.12)", color: "hsl(209 50% 35%)" }}>
                <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "hsl(209 65% 38%)" }} />
                <span>
                  Managers get full admin-panel access. A temporary password is generated and shown after creation.
                </span>
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={isCreating} className="gap-2">
                  {isCreating ? (
                    <>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Adding…
                    </>
                  ) : (
                    "Add Manager"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreate(false);
                    setForm(blankForm());
                    setErrors({});
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── List ── */}
      {loading ? (
        <Card className="card-elevated">
          <CardContent className="py-12 flex items-center justify-center">
            <span className="h-5 w-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "hsl(209 65% 21% / 0.25)", borderTopColor: "hsl(209 65% 38%)" }} />
          </CardContent>
        </Card>
      ) : managers.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: "hsl(154 80% 94%)" }}>
              <UsersRound className="h-8 w-8" style={{ color: "hsl(154 70% 34%)" }} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">No managers yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add your first manager to assign them to events
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowCreate(true)} className="gap-2 mt-1">
              <Plus className="h-4 w-4" />
              Add Manager
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid hsl(210 18% 90%)" }}>
          <div
            className="hidden md:grid items-center gap-4 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{
              background: "hsl(210 20% 97%)",
              color: "hsl(210 10% 48%)",
              borderBottom: "1px solid hsl(210 18% 90%)",
              gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1.6fr) 90px 150px",
            }}
          >
            <div>Manager</div>
            <div>Email</div>
            <div>Status</div>
            <div className="text-right">Actions</div>
          </div>

          {managers.map((m, i) => (
            <div
              key={m.id}
              className="grid items-center gap-4 px-4 py-3"
              style={{
                borderTop: i === 0 ? "none" : "1px solid hsl(210 18% 93%)",
                gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1.6fr) 90px 150px",
                opacity: m.is_active ? 1 : 0.6,
              }}
            >
              {/* Manager */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    background: m.is_active
                      ? "linear-gradient(135deg, hsl(209 55% 32%), hsl(190 50% 38%))"
                      : "hsl(210 12% 70%)",
                    color: "#fff",
                  }}
                >
                  {initials(m.full_name, m.email)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">
                    {m.full_name || <span className="text-muted-foreground">—</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Manager</p>
                </div>
              </div>

              {/* Email */}
              <div className="min-w-0 text-xs flex items-center gap-1.5 text-foreground">
                <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{m.email}</span>
              </div>

              {/* Status */}
              <div>
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={
                    m.is_active
                      ? { background: "hsl(154 80% 94%)", color: "hsl(154 70% 28%)" }
                      : { background: "hsl(210 16% 93%)", color: "hsl(210 10% 45%)" }
                  }
                >
                  {m.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => resetPassword(m)}
                  disabled={busyId === m.id || !m.is_active}
                  title="Reset password"
                  className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted disabled:opacity-40 transition-colors"
                  style={{ color: "hsl(210 12% 45%)" }}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => toggleActive(m)}
                  disabled={busyId === m.id}
                  title={m.is_active ? "Deactivate" : "Reactivate"}
                  className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted disabled:opacity-40 transition-colors"
                  style={{ color: m.is_active ? "hsl(0 65% 52%)" : "hsl(154 60% 32%)" }}
                >
                  {m.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
