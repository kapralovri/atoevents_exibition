"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  FileImage,
  FileText,
  Users,
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
}

const navItems: NavItem[] = [
  // Exhibitor
  { title: "Dashboard",       href: "/dashboard",       icon: LayoutDashboard, role: "exhibitor" },
  { title: "Events",          href: "/events",           icon: Calendar,        role: "exhibitor" },
  { title: "Tasks",           href: "/tasks",            icon: CheckSquare,     role: "exhibitor" },
  { title: "Equipment",       href: "/equipment",        icon: ShoppingCart,    role: "exhibitor" },
  { title: "Exb Manuals",     href: "/manuals",          icon: BookOpen,        role: "exhibitor" },
  { title: "Setup Schedule",  href: "/setup-schedule",   icon: CalendarDays,    role: "exhibitor" },
  // Admin
  { title: "Events",          href: "/admin/events",     icon: Calendar,        role: "admin" },
  { title: "Tasks",           href: "/admin/tasks",      icon: CheckSquare,     role: "admin" },
  { title: "Audit Log",       href: "/admin/audit",      icon: ClipboardList,   role: "admin" },
  { title: "Analytics",       href: "/admin/analytics",  icon: BarChart3,       role: "admin" },
];

interface SidebarProps {
  userRole: "admin" | "exhibitor";
  userEmail?: string;
  companyName?: string;
  collapsed?: boolean;
  onCollapsedChange?: (v: boolean) => void;
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
    .split(" ")
    .map((w) => w[0]?.toUpperCase())
    .slice(0, 2)
    .join("") || "?";

  const w = isCollapsed ? "w-16" : "w-64";

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col transition-all duration-300 overflow-hidden",
        w
      )}
      style={{
        background: "linear-gradient(180deg, hsl(209 65% 22%) 0%, hsl(209 65% 17%) 100%)",
        borderRight: "1px solid hsl(209 60% 16%)",
      }}
    >
      {/* Ambient radial glow behind logo */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: "160px",
          background:
            "radial-gradient(ellipse at 50% -10%, hsl(154 100% 49% / 0.08) 0%, transparent 70%)",
        }}
      />

      {/* ── Header ──────────────────────────────────────────────── */}
      <div
        className="relative flex h-16 items-center px-3 shrink-0"
        style={{ borderBottom: "1px solid hsl(209 60% 16%)" }}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-8">
            <div
              className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg"
              style={{
                background: "hsl(154 100% 49% / 0.08)",
                border: "1px solid hsl(154 100% 49% / 0.18)",
                boxShadow: "0 0 16px hsl(154 100% 49% / 0.07)",
              }}
            >
              <svg width="18" height="14" viewBox="0 0 36 20" fill="none">
                <text
                  x="0" y="15"
                  fontFamily="system-ui"
                  fontSize="12"
                  fontWeight="300"
                  letterSpacing="1"
                  fill="#e8e8e8"
                >
                  a/c
                </text>
                <line
                  x1="17" y1="2" x2="20" y2="19"
                  stroke="#00fc90"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold leading-tight tracking-wide truncate">
                Exhibition Management
              </p>
              <p
                className="text-[10px] leading-tight truncate"
                style={{ color: "hsl(210 40% 42%)" }}
              >
                Platform
              </p>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="flex items-center justify-center w-full">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: "hsl(154 100% 49% / 0.08)",
                border: "1px solid hsl(154 100% 49% / 0.18)",
              }}
            >
              <svg width="18" height="14" viewBox="0 0 36 20" fill="none">
                <text
                  x="0" y="15"
                  fontFamily="system-ui"
                  fontSize="12"
                  fontWeight="300"
                  letterSpacing="1"
                  fill="#e8e8e8"
                >
                  a/c
                </text>
                <line
                  x1="17" y1="2" x2="20" y2="19"
                  stroke="#00fc90"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center hover:bg-[hsl(209_65%_30%/0.35)] hover:text-[hsl(210_40%_62%)] active:scale-95"
          style={{
            color: "hsl(210 40% 42%)",
            transition: "background-color 120ms cubic-bezier(0.23,1,0.32,1), color 120ms cubic-bezier(0.23,1,0.32,1), transform 100ms cubic-bezier(0.23,1,0.32,1)",
          }}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed
            ? <ChevronRight className="h-3.5 w-3.5" />
            : <ChevronLeft className="h-3.5 w-3.5" />
          }
        </button>
      </div>

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav className="relative flex-1 overflow-y-auto py-3 px-2">
        {!isCollapsed && (
          <p
            className="px-3 mb-2 text-[9px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "hsl(210 40% 36%)" }}
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
                    isActive
                      ? "text-white font-semibold"
                      : "font-medium text-[hsl(210_40%_55%)] hover:text-[hsl(210_40%_78%)] hover:bg-[hsl(209_65%_16%/0.45)] active:scale-[0.98]"
                  )}
                  style={{
                    transition: "background-color 120ms cubic-bezier(0.23,1,0.32,1), color 120ms cubic-bezier(0.23,1,0.32,1), transform 100ms cubic-bezier(0.23,1,0.32,1)",
                    ...(isActive
                      ? {
                          background: "hsl(209 65% 13%)",
                          boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.03)",
                        }
                      : {}),
                  }}
                >
                  {/* Active green left bar with glow */}
                  {isActive && !isCollapsed && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full"
                      style={{
                        background:
                          "linear-gradient(180deg, hsl(154 100% 49%), hsl(170 80% 44%))",
                        boxShadow: "0 0 8px hsl(154 100% 49% / 0.45)",
                      }}
                    />
                  )}
                  <Icon
                    className="h-4 w-4 shrink-0 transition-colors"
                    style={isActive ? { color: "hsl(154 100% 49%)" } : undefined}
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
      <div
        className="relative shrink-0 p-2"
        style={{ borderTop: "1px solid hsl(209 60% 13%)" }}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                background: "hsl(154 100% 49% / 0.1)",
                color: "hsl(154 80% 42%)",
                border: "1px solid hsl(154 100% 49% / 0.18)",
              }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {companyName || "My Account"}
              </p>
              <p
                className="text-[10px] truncate leading-tight"
                style={{ color: "hsl(210 40% 40%)" }}
              >
                {userEmail}
              </p>
            </div>
            {/* Live connection indicator */}
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0 animate-pulse-dot"
              style={{
                background: "hsl(154 100% 49%)",
                boxShadow: "0 0 5px hsl(154 100% 49% / 0.55)",
              }}
            />
          </div>
        )}

        <button
          onClick={handleLogout}
          title={isCollapsed ? "Sign Out" : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg py-2 text-sm font-medium",
            "hover:bg-[hsl(0_72%_51%/0.07)] hover:text-[hsl(0_72%_60%)] active:scale-[0.97]",
            isCollapsed ? "justify-center px-0" : "px-3",
            "text-[hsl(210_40%_40%)]"
          )}
          style={{
            transition: "background-color 120ms cubic-bezier(0.23,1,0.32,1), color 120ms cubic-bezier(0.23,1,0.32,1), transform 100ms cubic-bezier(0.23,1,0.32,1)",
          }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCollapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );
}
