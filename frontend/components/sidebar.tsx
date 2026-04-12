"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  FileImage,
  FileText,
  Users,
  LayoutDashboard,
  LogOut,
  BarChart3,
  ClipboardList,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  role: "exhibitor" | "admin" | "both";
}

const navItems: NavItem[] = [
  { title: "Dashboard",    href: "/dashboard",      icon: LayoutDashboard, role: "exhibitor" },
  { title: "Graphics",     href: "/graphics",       icon: FileImage,       role: "exhibitor" },
  { title: "Description",  href: "/description",    icon: FileText,        role: "exhibitor" },
  { title: "Participants", href: "/participants",    icon: Users,           role: "exhibitor" },
  { title: "Events",       href: "/admin/events",   icon: Calendar,        role: "admin" },
  { title: "Audit Log",    href: "/admin/audit",    icon: ClipboardList,   role: "admin" },
  { title: "Analytics",    href: "/admin/analytics",icon: BarChart3,       role: "admin" },
];

interface SidebarProps {
  userRole: "admin" | "exhibitor";
  userEmail?: string;
  companyName?: string;
}

export function Sidebar({ userRole, userEmail, companyName }: SidebarProps) {
  const pathname = usePathname();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  };

  const filteredItems = navItems.filter(
    (item) => item.role === userRole || item.role === "both"
  );

  const displayName = companyName || userEmail || "";
  const initials = displayName
    .split(" ")
    .map((w) => w[0]?.toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <aside
      className="fixed left-0 top-0 z-40 h-screen w-64 flex flex-col"
      style={{ background: "hsl(209 65% 21%)" }}
    >
      {/* ── Logo ────────────────────────────────────────────────── */}
      <div className="flex h-16 items-center px-5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Green dot accent */}
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0"
            style={{ background: "hsl(154 100% 49%)", color: "hsl(209 65% 14%)" }}
          >
            A
          </div>
          <div>
            <p className="text-white text-sm font-bold leading-tight tracking-wide">
              ATO COMM
            </p>
            <p className="text-[10px] leading-tight" style={{ color: "hsl(210 50% 65%)" }}>
              {userRole === "admin" ? "Admin Panel" : "Exhibitor Portal"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <p
          className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "hsl(210 50% 50%)" }}
        >
          {userRole === "admin" ? "Administration" : "My Exhibition"}
        </p>
        <ul className="space-y-0.5">
          {filteredItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                    "transition-all duration-150 relative",
                    isActive
                      ? "text-white"
                      : "text-[hsl(210_50%_72%)] hover:text-white"
                  )}
                  style={
                    isActive
                      ? { background: "hsl(209 70% 16%)" }
                      : undefined
                  }
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background =
                        "hsl(209 70% 16% / 0.6)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = "";
                    }
                  }}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                      style={{ background: "hsl(154 100% 49%)" }}
                    />
                  )}
                  <Icon
                    className="h-4 w-4 shrink-0 transition-colors"
                    style={
                      isActive ? { color: "hsl(154 100% 49%)" } : undefined
                    }
                  />
                  <span className="flex-1">{item.title}</span>
                  {isActive && (
                    <ChevronRight
                      className="h-3 w-3 opacity-50"
                      style={{ color: "hsl(154 100% 49%)" }}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── User Profile ────────────────────────────────────────── */}
      <div
        className="shrink-0 p-4 border-t"
        style={{ borderColor: "hsl(209 60% 16%)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          {/* Avatar */}
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{
              background: "hsl(154 100% 49% / 0.15)",
              color: "hsl(154 100% 49%)",
              border: "1px solid hsl(154 100% 49% / 0.3)",
            }}
          >
            {initials || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate leading-tight">
              {companyName || "My Account"}
            </p>
            <p className="text-xs truncate leading-tight" style={{ color: "hsl(210 50% 55%)" }}>
              {userEmail}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
            "transition-all duration-150",
            "text-[hsl(210_50%_60%)] hover:text-white"
          )}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "hsl(0 72% 51% / 0.12)";
            (e.currentTarget as HTMLElement).style.color = "hsl(0 72% 65%)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "";
            (e.currentTarget as HTMLElement).style.color = "";
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
