"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
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
    <div className="min-h-screen flex" style={{ background: "#0a0f1a" }}>

      {/* ── Left: Hero image panel ─────────────────────────────── */}
      <div className="hidden lg:block lg:w-[55%] relative overflow-hidden">
        {/* Background — uses hero.jpg if placed in /public, otherwise CSS fallback */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/hero.jpg'), linear-gradient(135deg, hsl(215 60% 8%) 0%, hsl(209 65% 14%) 50%, hsl(200 50% 18%) 100%)",
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
          }}
        />
        {/* Overlay gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, hsl(209 65% 8% / 0.88) 0%, hsl(209 65% 10% / 0.55) 55%, hsl(209 40% 15% / 0.3) 100%)",
          }}
        />
        {/* Dot pattern */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, hsl(154 100% 49% / 0.35) 1.5px, transparent 1.5px)",
            backgroundSize: "38px 38px",
            maskImage: "linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)",
          }}
        />


        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-between p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            {/* SVG Logo */}
            <svg width="120" height="28" viewBox="0 0 180 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text x="0" y="28" fontFamily="system-ui,-apple-system,sans-serif" fontSize="28" fontWeight="300" letterSpacing="4" fill="#f0f0f0">ato</text>
              <text x="88" y="28" fontFamily="system-ui,-apple-system,sans-serif" fontSize="28" fontWeight="300" letterSpacing="4" fill="#f0f0f0">comm</text>
              <line x1="82" y1="4" x2="87" y2="34" stroke="#00fc90" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Hero text */}
          <div className="space-y-6">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                background: "hsl(154 100% 49% / 0.12)",
                color: "hsl(154 100% 49%)",
                border: "1px solid hsl(154 100% 49% / 0.2)",
                backdropFilter: "blur(8px)",
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              MRO &amp; Aviation Exhibitions
            </div>

            <h1 className="text-5xl font-extralight text-white leading-[1.1] tracking-tight">
              Exhibition
              <br />
              <span
                className="font-light"
                style={{
                  background: "linear-gradient(90deg, hsl(154 100% 49%), hsl(170 80% 60%))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Management
              </span>
              <br />
              Platform
            </h1>

            <p className="text-base leading-relaxed max-w-sm" style={{ color: "hsl(210 30% 70%)" }}>
              Submit graphics, manage your company profile, and register participants — all in one workspace.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2">
              {["Graphics upload", "Deadline tracking", "Participant management", "Real-time status"].map((f) => (
                <span
                  key={f}
                  className="text-xs px-3 py-1.5 rounded-full"
                  style={{
                    background: "hsl(209 65% 21% / 0.4)",
                    color: "hsl(210 40% 80%)",
                    border: "1px solid hsl(209 65% 35% / 0.4)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs" style={{ color: "hsl(210 30% 45%)" }}>
            © 2026 ATO COMM · atocomm.eu
          </p>
        </div>
      </div>

      {/* ── Right: Login form ──────────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center px-6 py-12 relative"
        style={{ background: "#0d1520" }}
      >
        {/* Subtle background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 70% 50% at 50% 80%, hsl(154 100% 49% / 0.04) 0%, transparent 70%)",
          }}
        />

        <div className="relative w-full max-w-sm animate-fade-up">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <svg width="110" height="24" viewBox="0 0 180 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text x="0" y="28" fontFamily="system-ui" fontSize="28" fontWeight="300" letterSpacing="4" fill="#f0f0f0">ato</text>
              <text x="88" y="28" fontFamily="system-ui" fontSize="28" fontWeight="300" letterSpacing="4" fill="#f0f0f0">comm</text>
              <line x1="82" y1="4" x2="87" y2="34" stroke="#00fc90" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-light tracking-tight" style={{ color: "#f0f0f0" }}>
              Sign in
            </h2>
            <p className="mt-1.5 text-sm" style={{ color: "hsl(210 25% 55%)" }}>
              Access your exhibitor workspace
            </p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wide"
                style={{ color: "hsl(210 25% 55%)" }}>
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
                className="h-12 text-sm"
                style={{
                  background: "hsl(209 65% 21% / 0.15)",
                  border: "1px solid hsl(209 65% 35% / 0.3)",
                  color: "#f0f0f0",
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide"
                style={{ color: "hsl(210 25% 55%)" }}>
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="h-12 pr-10 text-sm"
                  style={{
                    background: "hsl(209 65% 21% / 0.15)",
                    border: "1px solid hsl(209 65% 35% / 0.3)",
                    color: "#f0f0f0",
                  }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "hsl(210 25% 50%)" }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 mt-2 rounded-xl flex items-center justify-center gap-2.5 text-sm font-semibold transition-all duration-200"
              style={{
                background: isLoading
                  ? "hsl(154 60% 38%)"
                  : "linear-gradient(135deg, hsl(154 100% 42%), hsl(154 80% 36%))",
                color: "hsl(209 65% 10%)",
                boxShadow: isLoading ? "none" : "0 4px 20px hsl(154 100% 49% / 0.25)",
              }}
              onMouseEnter={(e) => !isLoading && ((e.currentTarget as HTMLElement).style.transform = "translateY(-1px)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.transform = "")}
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs" style={{ color: "hsl(210 20% 40%)" }}>
            Need access?{" "}
            <a href="mailto:portal@atocomm.eu"
              className="font-medium transition-colors"
              style={{ color: "hsl(154 80% 55%)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "hsl(154 100% 49%)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "hsl(154 80% 55%)")}
            >
              Contact ATO COMM
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
