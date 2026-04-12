"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, ArrowRight, Plane } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data = await apiFetch<{ access_token: string }>("/auth/login", {
        method: "POST",
        auth: false,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("access_token", data.access_token);
      const me = await apiFetch<{ role: string }>("/portal/me");
      toast.success("Welcome back!");
      router.push(me.role === "admin" ? "/admin/events" : "/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "hsl(213 25% 97%)" }}>

      {/* ── Left panel: Brand ───────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "hsl(209 65% 21%)" }}
      >
        {/* Background decoration */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 110%, hsl(154 100% 49% / 0.12) 0%, transparent 70%), " +
              "radial-gradient(ellipse 60% 40% at 0% 50%, hsl(209 65% 14% / 0.6) 0%, transparent 60%)",
          }}
        />

        {/* Grid dots decoration */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle, hsl(154 100% 90%) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center font-black text-base"
              style={{
                background: "hsl(154 100% 49%)",
                color: "hsl(209 65% 14%)",
              }}
            >
              A
            </div>
            <div>
              <p className="text-white font-bold text-lg tracking-wide leading-tight">
                ATO COMM
              </p>
              <p className="text-xs leading-tight" style={{ color: "hsl(210 50% 60%)" }}>
                Exhibitor Portal
              </p>
            </div>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mb-6"
              style={{
                background: "hsl(154 100% 49% / 0.15)",
                color: "hsl(154 100% 49%)",
                border: "1px solid hsl(154 100% 49% / 0.25)",
              }}
            >
              <Plane className="h-3 w-3" />
              MRO &amp; Aviation Exhibitions
            </div>
            <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
              Exhibition
              <br />
              <span style={{ color: "hsl(154 100% 49%)" }}>Management</span>
              <br />
              Platform
            </h1>
            <p className="mt-4 text-base leading-relaxed" style={{ color: "hsl(210 40% 68%)" }}>
              Submit your graphics, company profile, and participant lists — all in one place.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-3">
            {[
              "Graphics upload with validation",
              "Real-time submission tracking",
              "Deadline management",
            ].map((feat) => (
              <li key={feat} className="flex items-center gap-3 text-sm" style={{ color: "hsl(210 40% 75%)" }}>
                <span
                  className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                  style={{
                    background: "hsl(154 100% 49% / 0.15)",
                    color: "hsl(154 100% 49%)",
                  }}
                >
                  ✓
                </span>
                {feat}
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-xs" style={{ color: "hsl(210 40% 45%)" }}>
            © 2026 ATO COMM · atocomm.eu
          </p>
        </div>
      </div>

      {/* ── Right panel: Form ───────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-fade-up">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center font-black text-sm"
              style={{ background: "hsl(209 65% 21%)", color: "hsl(154 100% 49%)" }}
            >
              A
            </div>
            <span className="text-lg font-bold text-foreground tracking-wide">
              ATO COMM
            </span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              Sign in to your account
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Enter your credentials to access the portal
            </p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 mt-2 text-base"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span
                    className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
                  />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Need access?{" "}
            <a
              href="mailto:portal@atocomm.eu"
              className="font-medium underline underline-offset-4 text-primary hover:text-primary/80"
            >
              Contact ATO COMM
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
