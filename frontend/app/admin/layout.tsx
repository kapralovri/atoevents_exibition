"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { apiFetch } from "@/lib/api";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem("access_token");
      if (!token) { router.push("/login"); return; }
      try {
        const me = await apiFetch<{ role: string; email: string }>("/portal/me");
        if (me.role !== "admin") { router.push("/dashboard"); return; }
        setUserEmail(me.email);
        setReady(true);
      } catch {
        localStorage.removeItem("access_token");
        router.push("/login");
      }
    }
    checkAuth();
  }, [router]);

  if (!ready) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: "hsl(213 25% 97%)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg animate-pulse"
            style={{ background: "hsl(209 65% 21%)", color: "hsl(154 100% 49%)" }}
          >
            <svg width="24" height="18" viewBox="0 0 36 20" fill="none">
              <text x="0" y="15" fontFamily="system-ui" fontSize="12" fontWeight="300" fill="#e8e8e8">a/c</text>
              <line x1="17" y1="2" x2="20" y2="19" stroke="#00fc90" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin"
              style={{
                borderColor: "hsl(209 65% 21% / 0.2)",
                borderTopColor: "hsl(209 65% 21%)",
              }}
            />
            <span className="text-sm text-muted-foreground font-medium">Loading portal…</span>
          </div>
        </div>
      </div>
    );
  }

  const sidebarW = collapsed ? "ml-16" : "ml-64";

  return (
    <div className="flex h-screen" style={{ background: "hsl(210 25% 98%)" }}>
      <Sidebar
        userRole="admin"
        userEmail={userEmail}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />
      <main className={`flex-1 ${sidebarW} overflow-auto transition-all duration-300`}>
        {children}
      </main>
    </div>
  );
}
