"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { OnboardingModal } from "@/components/onboarding-modal";
import { apiFetch } from "@/lib/api";

interface ExhibitorInfo {
  id: number;
  company_name: string;
  needs_manual_modal: boolean;
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [userRole, setUserRole] = useState<"admin" | "exhibitor" | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [collapsed, setCollapsed] = useState(false);
  const [exhibitorInfo, setExhibitorInfo] = useState<ExhibitorInfo | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem("access_token");
      if (!token) { router.push("/login"); return; }
      try {
        const me = await apiFetch<{ role: string; email: string; company_name?: string }>("/portal/me");
        setUserRole(me.role as "admin" | "exhibitor");
        setUserEmail(me.email);
        setCompanyName(me.company_name || "");

        // For exhibitors — check if onboarding modal needs to show
        if (me.role === "exhibitor") {
          try {
            const ex = await apiFetch<ExhibitorInfo>("/portal/me/exhibitor");
            setExhibitorInfo(ex);
            if (ex.needs_manual_modal) setShowOnboarding(true);
          } catch {}
        }
      } catch {
        localStorage.removeItem("access_token");
        router.push("/login");
      }
    }
    checkAuth();
  }, [router]);

  if (!userRole) {
    return (
      <div className="flex h-screen items-center justify-center scene-light">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg animate-pulse"
            style={{ background: "hsl(209 65% 21%)", color: "hsl(154 100% 49%)" }}>
            <svg width="24" height="18" viewBox="0 0 36 20" fill="none">
              <text x="0" y="15" fontFamily="system-ui" fontSize="12" fontWeight="300" fill="#e8e8e8">a/c</text>
              <line x1="17" y1="2" x2="20" y2="19" stroke="#00fc90" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "hsl(209 65% 21% / 0.2)", borderTopColor: "hsl(209 65% 21%)" }} />
            <span className="text-sm text-muted-foreground font-medium">Loading portal…</span>
          </div>
        </div>
      </div>
    );
  }

  // Sidebar is floating (left-4, w-[72] or w-[240]) — leave room + 16px gap
  const sidebarW = collapsed ? "ml-[104px]" : "ml-[272px]";

  return (
    <div className="flex h-screen scene-light relative overflow-hidden">
      {/* ── Subtle ambient blobs (very low opacity) ───────────────── */}
      <div
        aria-hidden
        className="blob"
        style={{
          width: 620,
          height: 620,
          top: -220,
          left: -180,
          background: "hsl(168 55% 55% / 0.08)",
        }}
      />
      <div
        aria-hidden
        className="blob"
        style={{
          width: 500,
          height: 500,
          bottom: -160,
          right: -120,
          background: "hsl(212 50% 55% / 0.07)",
        }}
      />

      <Sidebar
        userRole={userRole}
        userEmail={userEmail}
        companyName={companyName}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />
      <main className={`relative flex-1 min-w-0 ${sidebarW} overflow-y-auto overflow-x-hidden transition-all duration-300`}>
        <div className="px-4 md:px-8 py-6 md:py-8 mx-auto max-w-[1440px] animate-fade-up">
          {children}
        </div>
      </main>

      {/* Onboarding modal — shown on first login for exhibitors */}
      {showOnboarding && exhibitorInfo && (
        <OnboardingModal
          exhibitorId={exhibitorInfo.id}
          companyName={exhibitorInfo.company_name}
          onClose={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}
