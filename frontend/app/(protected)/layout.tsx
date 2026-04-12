"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { apiFetch } from "@/lib/api";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [userRole, setUserRole] = useState<"admin" | "exhibitor" | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem("access_token");
      if (!token) {
        router.push("/login");
        return;
      }
      try {
        const me = await apiFetch<{
          role: string;
          email: string;
          company_name?: string;
        }>("/portal/me");
        setUserRole(me.role as "admin" | "exhibitor");
        setUserEmail(me.email);
        setCompanyName(me.company_name || "");
      } catch {
        localStorage.removeItem("access_token");
        router.push("/login");
      }
    }
    checkAuth();
  }, [router]);

  if (!userRole) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: "hsl(213 25% 97%)" }}
      >
        <div className="flex flex-col items-center gap-4">
          {/* Animated logo */}
          <div
            className="h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg animate-pulse"
            style={{
              background: "hsl(209 65% 21%)",
              color: "hsl(154 100% 49%)",
            }}
          >
            A
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "hsl(209 65% 21% / 0.2)", borderTopColor: "hsl(209 65% 21%)" }}
            />
            <span className="text-sm text-muted-foreground font-medium">
              Loading portal…
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen" style={{ background: "hsl(213 25% 97%)" }}>
      <Sidebar
        userRole={userRole}
        userEmail={userEmail}
        companyName={companyName}
      />
      <main className="flex-1 ml-64 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 animate-fade-up">
          {children}
        </div>
      </main>
    </div>
  );
}
