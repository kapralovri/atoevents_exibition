"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  LogOut,
  BarChart3,
  ClipboardList,
  CheckSquare,
  ShoppingCart,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  role: "exhibitor" | "admin" | "both";
  section?: "main" | "workspace";
}

const navItems: NavItem[] = [
  // Exhibitor
  { title: "Dashboard",       href: "/dashboard",       icon: LayoutDashboard, role: "exhibitor", section: "main" },
  { title: "Events",          href: "/events",           icon: Calendar,        role: "exhibitor", section: "main" },
  { title: "Tasks",           href: "/tasks",            icon: CheckSquare,     role: "exhibitor", section: "main" },
  { title: "Equipment",       href: "/equipment",        icon: ShoppingCart,    role: "exhibitor", section: "main" },
  { title: "Exb Manuals",     href: "/manuals",          icon: BookOpen,        role: "exhibitor", section: "main" },
  { title: "Setup Schedule",  href: "/setup-schedule",   icon: CalendarDays,    role: "exhibitor", section: "main" },
  // Admin
  { title: "Events",          href: "/admin/events",     icon: Calendar,        role: "admin", section: "main" },
  { title: "Tasks",           href: "/admin/tasks",      icon: CheckSquare,     role: "admin", section: "main" },
  { title: "Audit Log",       href: "/admin/audit",      icon: ClipboardList,   role: "admin", section: "main" },
  { title: "Analytics",       href: "/admin/analytics",  icon: BarChart3,       role: "admin", section: "main" },
];

interface SidebarProps {
  userRole: "admin" | "exhibitor";
  userEmail?: string;
  companyName?: string;
  collapsed?: boolean;
  onCollapsedChange?: (v: boolean) => void;
}

// ── Brand mark: rounded square + chevron (wing) + orbit circle ───────────────
function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="10" fill="hsl(209 65% 21%)" />
      <rect x="1" y="1" width="38" height="38" rx="10" stroke="url(#bm-stroke)" strokeWidth="1.2" />
      <path d="M10 27 L20 11 L30 27" stroke="hsl(154 100% 49%)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="20" cy="24" r="3.2" stroke="hsl(154 100% 49%)" strokeWidth="2.2" fill="none" />
      <defs>
        <linearGradient id="bm-stroke" x1="0" y1="0" x2="40" y2="40">
          <stop stopColor="hsl(154 100% 49%)" stopOpacity="0.55" />
          <stop offset="1" stopColor="hsl(154 100% 49%)" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Sidebar({
  userRole,
  userEmail,
  companyName,
  collapsed = false,
  onCollapsedChange,
}: SidebarProps) {
  const pathname = usePathname();
  const [localCollapsed, setLocalCollapsed] = useState(collapsed);

  const isCollapsed = onCollapsedChange ? collapsed : localCollapsed;
  const toggle = () => {
    if (onCollapsedChange) onCollapsedChange(!collapsed);
    else setLocalCollapsed((v) => !v);
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  };

  const filteredItems = navItems.filter(
    (item) => item.role === userRole || item.role === "both"
  );

  const displayName = companyName || userEmail || "";
  const initials = displayName
    .split(/[ @]/)
    .map((w) => w[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join("") || "?";

  return (
    <aside
      className={cn(
        "fixed left-4 top-4 bottom-4 z-40 flex flex-col transition-all duration-300 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-[0_4px_24px_rgba(15,23,42,0.06)]",
        isCollapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      {/* ── Floating toggle on the outer edge (never overlaps logo) ── */}
      <button
        onClick={toggle}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-20 z-10 h-6 w-6 rounded-full flex items-center justify-center bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 shadow-sm transition-all active:scale-90"
      >
        {isCollapsed
          ? <ChevronRight className="h-3 w-3" />
          : <ChevronLeft className="h-3 w-3" />
        }
      </button>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="relative flex h-[64px] items-center shrink-0 border-b border-slate-100 px-4">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <BrandMark size={30} />
            <div className="min-w-0 leading-tight">
              <p
                className="text-[14px] font-extrabold tracking-tight text-[hsl(212_40%_16%)] truncate"
                style={{ fontFamily: "Manrope, Inter, system-ui, sans-serif" }}
              >
                ato<span className="text-[hsl(168_55%_38%)]">/</span>comm
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400 mt-0.5 truncate">
                Exhibitor Portal
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full">
            <BrandMark size={30} />
          </div>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav className="relative flex-1 overflow-y-auto py-3 px-2">
        {!isCollapsed && (
          <p
            className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "hsl(210 10% 55%)" }}
          >
            {userRole === "admin" ? "Administration" : "My Exhibition"}
          </p>
        )}
        <ul className="space-y-px">
          {filteredItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={isCollapsed ? item.title : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg text-sm",
                    isCollapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5",
                    "active:scale-[0.98]"
                  )}
                  style={{
                    transition: "background-color 120ms, color 120ms, transform 100ms",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "hsl(168 55% 28%)" : "hsl(215 15% 40%)",
                    background: isActive ? "hsl(168 55% 96%)" : "transparent",
                    border: isActive ? "1px solid hsl(168 45% 85%)" : "1px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = "hsl(214 20% 96%)";
                      (e.currentTarget as HTMLElement).style.color = "hsl(212 40% 20%)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "hsl(215 15% 40%)";
                    }
                  }}
                >
                  {isActive && !isCollapsed && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                      style={{ background: "hsl(168 55% 42%)" }}
                    />
                  )}
                  <Icon
                    className="h-4 w-4 shrink-0"
                    style={isActive ? { color: "hsl(168 55% 34%)" } : undefined}
                  />
                  {!isCollapsed && (
                    <span className="flex-1 truncate">{item.title}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

      </nav>

      {/* ── User / Logout ─────────────────────────────────────────── */}
      <div className="relative shrink-0 p-2 border-t border-slate-100">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1 min-w-0">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                background: "linear-gradient(135deg, hsl(168 55% 42%), hsl(190 50% 40%))",
                color: "#ffffff",
              }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate leading-tight text-[hsl(212_40%_18%)]">
                {companyName || "My Account"}
              </p>
              <p className="text-[10px] truncate leading-tight text-slate-500">
                {userEmail}
              </p>
            </div>
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{
                background: "hsl(168 55% 42%)",
                boxShadow: "0 0 5px hsl(154 70% 42% / 0.55)",
              }}
              title="Online"
            />
          </div>
        )}

        <button
          onClick={handleLogout}
          title={isCollapsed ? "Sign Out" : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg py-2 text-sm font-medium active:scale-[0.97]",
            isCollapsed ? "justify-center px-0" : "px-3"
          )}
          style={{
            color: "hsl(210 10% 42%)",
            transition: "background-color 120ms, color 120ms, transform 100ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "hsl(0 80% 96%)";
            (e.currentTarget as HTMLElement).style.color = "hsl(0 72% 48%)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "";
            (e.currentTarget as HTMLElement).style.color = "hsl(210 10% 42%)";
          }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCollapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );
}
