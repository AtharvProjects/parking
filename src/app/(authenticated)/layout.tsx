"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useSite } from "@/providers/site-provider";
import { useLanguage } from "@/providers/language-provider";
import { useTheme } from "@/providers/theme-provider";
import { LANGUAGES } from "@/lib/i18n";
import { SiteSwitcherModal } from "@/components/site-switcher-modal";
import { OperatorSwitchModal } from "@/components/operator-switch-modal";
import {
  LayoutGrid,
  Plus,
  Car,
  BarChart3,
  Search,
  Settings,
  WifiOff,
  ChevronDown,
  Building2,
  Globe,
  Sun,
  Moon,
  Users,
  HelpCircle,
  LogOut,
  Bell,
  Sparkles,
  Layers,
  ArrowRight,
  X,
  CreditCard,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { hasPermission, type AppFeature } from "@/lib/constants";
import { useBackHandler } from "@/providers/back-button-provider";

interface NavItemConfig {
  href: string;
  icon: any;
  labelKey: string;
  requiredFeature?: AppFeature;
}

const DESKTOP_NAV_ITEMS: NavItemConfig[] = [
  { href: "/dashboard/", icon: LayoutGrid, labelKey: "nav.activity" },
  { href: "/gate/active/", icon: Car, labelKey: "nav.vehicles", requiredFeature: "VEHICLES" },
  { href: "/reports/", icon: BarChart3, labelKey: "nav.analytics", requiredFeature: "REPORTS" },
  { href: "/search/", icon: Search, labelKey: "nav.parking", requiredFeature: "SEARCH" },
  { href: "/employees/", icon: Users, labelKey: "dashboard.staffPayroll", requiredFeature: "EMPLOYEES" },
  { href: "/settings/", icon: Settings, labelKey: "settings.title", requiredFeature: "SETTINGS" },
];

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { status, employee, isOffline } = useAuth();
  const { currentSite, currentSiteId } = useSite();
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const pathname = usePathname() || "/dashboard/";

  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useBackHandler(isMoreMenuOpen, () => setIsMoreMenuOpen(false), 30);

  // Nav indicator tracking
  const navContainerRef = useRef<HTMLDivElement>(null);
  const railContainerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; top: number; width: number; height: number; opacity: number }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    opacity: 0,
  });
  const [railIndicatorStyle, setRailIndicatorStyle] = useState<{ top: number; height: number; opacity: number }>({
    top: 0,
    height: 40,
    opacity: 0,
  });

  const visibleNavItems = DESKTOP_NAV_ITEMS.filter(
    (item) => !item.requiredFeature || hasPermission(employee?.role, item.requiredFeature)
  );

  const siteDisplayName =
    currentSiteId === "ALL"
      ? t("nav.allSites")
      : (currentSite?.name || t("nav.selectSite"));

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login/");
    }
  }, [status, router]);

  // Determine single active nav item (exact match beats prefix match; longest prefix wins)
  const getActiveNavItemHref = () => {
    const pathClean = pathname.replace(/\/$/, "");
    let bestMatch: string | null = null;
    let bestLen = -1;

    for (const item of visibleNavItems) {
      const itemClean = item.href.replace(/\/$/, "");
      if (pathClean === itemClean) {
        return item.href;
      }
      if (itemClean !== "/dashboard" && pathClean.startsWith(itemClean + "/")) {
        if (itemClean.length > bestLen) {
          bestMatch = item.href;
          bestLen = itemClean.length;
        }
      }
    }
    return bestMatch || (pathClean === "" || pathClean === "/" ? "/dashboard/" : null);
  };

  const activeNavHref = getActiveNavItemHref();

  // Update sliding indicator for Top Nav
  useEffect(() => {
    const updateIndicator = () => {
      if (!navContainerRef.current) return;
      const targetHref = getActiveNavItemHref();
      if (!targetHref) {
        setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
        return;
      }
      
      const activeBtn = navContainerRef.current.querySelector<HTMLAnchorElement>(`a[data-href="${targetHref}"]`);

      if (activeBtn) {
        setIndicatorStyle({
          left: (activeBtn as HTMLElement).offsetLeft,
          top: (activeBtn as HTMLElement).offsetTop,
          width: (activeBtn as HTMLElement).offsetWidth,
          height: (activeBtn as HTMLElement).offsetHeight,
          opacity: 1,
        });
      } else {
        setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
      }
    };

    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    const timeout = setTimeout(updateIndicator, 50);
    return () => {
      window.removeEventListener("resize", updateIndicator);
      clearTimeout(timeout);
    };
  }, [pathname, visibleNavItems.length]);

  // Update vertical sliding indicator for Rail
  useEffect(() => {
    const updateRailIndicator = () => {
      if (!railContainerRef.current) return;
      const targetHref = getActiveNavItemHref();
      if (!targetHref) {
        setRailIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
        return;
      }

      const activeBtn = railContainerRef.current.querySelector<HTMLAnchorElement>(`a[data-href="${targetHref}"]`);

      if (activeBtn) {
        setRailIndicatorStyle({
          top: (activeBtn as HTMLElement).offsetTop,
          height: (activeBtn as HTMLElement).offsetHeight,
          opacity: 1,
        });
      } else {
        setRailIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
      }
    };

    updateRailIndicator();
    const timeout = setTimeout(updateRailIndicator, 50);
    return () => clearTimeout(timeout);
  }, [pathname, visibleNavItems.length]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--page)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-3 border-[var(--accent)] border-t-transparent animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink3)]">Loading Vertix...</span>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <div className="vx-page-wrapper">
      <div className="vx-frame">
        {/* ────────── VERTIX TOP PILL HEADER (MATCHING REFERENCE) ────────── */}
        <header className="hidden md:flex items-center justify-between gap-3 relative z-30 pb-4 w-full">
          {/* Brand Logo */}
          <Link href="/dashboard/" className="flex items-center gap-2.5 shrink-0 select-none group" style={{ ["--i" as any]: 0 }}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f25c27] to-[#e64a19] flex items-center justify-center text-white font-black text-xl shadow-md shadow-orange-500/25 transition-transform group-hover:scale-105">
              V
            </div>
            <div className="flex items-center text-xl font-black tracking-tight">
              <span className="text-slate-900 dark:text-white">Vertix</span>
              <span className="text-[#f25c27] ml-0.5">Parking</span>
            </div>
          </Link>

          {/* Desktop Nav Pills with Sliding Capsule Indicator */}
          <nav
            ref={navContainerRef}
            className="pill vx-nav rv shrink-0 !bg-white dark:!bg-zinc-900 !p-1.5 !border-slate-200/80 dark:!border-zinc-800 shadow-sm"
            style={{ ["--i" as any]: 1 }}
          >
            {/* Smooth animated sliding capsule indicator */}
            <span
              className="ind !bg-[#141416]"
              style={{
                left: `${indicatorStyle.left}px`,
                top: `${indicatorStyle.top}px`,
                width: `${indicatorStyle.width}px`,
                height: `${indicatorStyle.height}px`,
                opacity: indicatorStyle.opacity,
              }}
            />
            {visibleNavItems.map((item) => {
              const isActive = activeNavHref === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-href={item.href}
                  className={cn(
                    "px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors text-slate-600 hover:text-slate-900 dark:text-zinc-400",
                    isActive && "on !text-white font-bold"
                  )}
                  title={t(item.labelKey)}
                >
                  <item.icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Site Selector Pill */}
          <div className="flex items-center gap-2.5 shrink-0" style={{ ["--i" as any]: 2 }}>
            <button
              type="button"
              onClick={() => setIsSiteModalOpen(true)}
              className="pill flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 hover:bg-slate-50 border border-slate-200/80 dark:border-zinc-800 shadow-sm transition-all active:scale-95 shrink-0"
            >
              <Building2 className="w-4 h-4 text-[#f25c27] shrink-0" />
              <span className="truncate max-w-[140px] font-bold text-slate-800 dark:text-zinc-200">{siteDisplayName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          </div>
        </header>

        {/* ────────── MOBILE SLIM HEADER (MD:HIDDEN) ────────── */}
        <header className="flex md:hidden items-center justify-between gap-2 relative z-30 pb-3">
          {/* Brand + Site Pill */}
          <div className="flex items-center gap-1.5 min-w-0">
            <Link href="/dashboard/" className="flex items-center gap-1.5 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#f25c27] to-[#e64a19] flex items-center justify-center text-white font-black text-sm">V</div>
              <span className="font-extrabold text-sm tracking-tight text-slate-900">Vertix</span>
            </Link>

            {/* Tap to switch site directly on mobile */}
            <button
              type="button"
              onClick={() => setIsSiteModalOpen(true)}
              className="pill flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm transition-colors active:scale-95 truncate max-w-[130px]"
            >
              <Building2 className="w-3 h-3 text-[#f25c27] shrink-0" />
              <span className="truncate text-[11px]">{siteDisplayName}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>
          </div>

          {/* Right Mobile Actions: Theme, Search, Operator Avatar */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={(e) => toggle(e)}
              className="pill w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 bg-white border border-slate-200 transition-transform active:scale-90"
              title="Toggle Theme"
            >
              {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
            </button>

            <button
              type="button"
              onClick={() => router.push("/search/")}
              className="pill w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 bg-white border border-slate-200 transition-transform active:scale-90"
              title="Search Vehicle"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsSwitchModalOpen(true)}
              className="relative flex items-center p-0.5 rounded-full border border-slate-200 bg-white transition-transform active:scale-90"
              title="Operator Profile"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#f25c27] to-[#e64a19] text-white flex items-center justify-center text-[11px] font-extrabold shadow-sm">
                {employee?.name?.charAt(0).toUpperCase() || "O"}
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
            </button>
          </div>
        </header>

        {/* ────────── MAIN BODY: LEFT RAIL + CONTENT ────────── */}
        <div className="flex gap-4 md:gap-5 flex-1 min-h-0 relative">
          {/* Sticky Left Rail Matching Reference Design */}
          <aside className="hidden md:flex flex-col items-center justify-between bg-white dark:bg-zinc-900 rounded-3xl p-2.5 lg:p-3 border border-slate-200/80 dark:border-zinc-800 shadow-sm w-[76px] lg:w-[84px] shrink-0 min-h-[85vh] py-6 sticky top-4 select-none">
            {/* Top Navigation Items */}
            <div className="flex flex-col items-center gap-5 w-full">
              {/* Dashboard */}
              <Link
                href="/dashboard/"
                className="flex flex-col items-center gap-1.5 group w-full"
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                    activeNavHref === "/dashboard/"
                      ? "bg-gradient-to-br from-[#f25c27] to-[#e64a19] text-white shadow-md shadow-orange-500/30 scale-105"
                      : "text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  )}
                >
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <span
                  className={cn(
                    "text-[10px] tracking-tight leading-none transition-colors",
                    activeNavHref === "/dashboard/" ? "font-bold text-slate-900 dark:text-white" : "font-medium text-slate-500 group-hover:text-slate-800"
                  )}
                >
                  Dashboard
                </span>
              </Link>

              {/* Vehicles */}
              <Link
                href="/gate/active/"
                className="flex flex-col items-center gap-1.5 group w-full"
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                    activeNavHref === "/gate/active/"
                      ? "bg-gradient-to-br from-[#f25c27] to-[#e64a19] text-white shadow-md shadow-orange-500/30 scale-105"
                      : "text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  )}
                >
                  <Car className="w-5 h-5" />
                </div>
                <span
                  className={cn(
                    "text-[10px] tracking-tight leading-none transition-colors",
                    activeNavHref === "/gate/active/" ? "font-bold text-slate-900 dark:text-white" : "font-medium text-slate-500 group-hover:text-slate-800"
                  )}
                >
                  Vehicles
                </span>
              </Link>

              {/* Reports */}
              <Link
                href="/reports/"
                className="flex flex-col items-center gap-1.5 group w-full"
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                    activeNavHref === "/reports/"
                      ? "bg-gradient-to-br from-[#f25c27] to-[#e64a19] text-white shadow-md shadow-orange-500/30 scale-105"
                      : "text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  )}
                >
                  <BarChart3 className="w-5 h-5" />
                </div>
                <span
                  className={cn(
                    "text-[10px] tracking-tight leading-none transition-colors",
                    activeNavHref === "/reports/" ? "font-bold text-slate-900 dark:text-white" : "font-medium text-slate-500 group-hover:text-slate-800"
                  )}
                >
                  Reports
                </span>
              </Link>

              {/* Users */}
              <Link
                href="/employees/"
                className="flex flex-col items-center gap-1.5 group w-full"
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                    activeNavHref === "/employees/"
                      ? "bg-gradient-to-br from-[#f25c27] to-[#e64a19] text-white shadow-md shadow-orange-500/30 scale-105"
                      : "text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  )}
                >
                  <Users className="w-5 h-5" />
                </div>
                <span
                  className={cn(
                    "text-[10px] tracking-tight leading-none transition-colors",
                    activeNavHref === "/employees/" ? "font-bold text-slate-900 dark:text-white" : "font-medium text-slate-500 group-hover:text-slate-800"
                  )}
                >
                  Users
                </span>
              </Link>

              {/* Settings */}
              <Link
                href="/settings/"
                className="flex flex-col items-center gap-1.5 group w-full"
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                    activeNavHref === "/settings/"
                      ? "bg-gradient-to-br from-[#f25c27] to-[#e64a19] text-white shadow-md shadow-orange-500/30 scale-105"
                      : "text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  )}
                >
                  <Settings className="w-5 h-5" />
                </div>
                <span
                  className={cn(
                    "text-[10px] tracking-tight leading-none transition-colors",
                    activeNavHref === "/settings/" ? "font-bold text-slate-900 dark:text-white" : "font-medium text-slate-500 group-hover:text-slate-800"
                  )}
                >
                  Settings
                </span>
              </Link>
            </div>

            {/* Bottom Actions: Help & Logout */}
            <div className="flex flex-col items-center gap-4 w-full pt-4 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => showToast("Sant Wamanbhau Parking Terminal v2.4 (Vertix Edition)")}
                className="flex flex-col items-center gap-1 group text-slate-400 hover:text-slate-800 transition-colors w-full"
                title="Help & System Info"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium text-slate-500">Help</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSwitchModalOpen(true)}
                className="flex flex-col items-center gap-1 group text-slate-400 hover:text-red-500 transition-colors w-full"
                title="Handover & Sign Out"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                  <LogOut className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium text-slate-500 group-hover:text-red-500">Logout</span>
              </button>
            </div>
          </aside>

          {/* Main Scrollable Canvas */}
          <main className="flex-1 min-w-0 overflow-y-auto hide-scrollbar pb-28 sm:pb-32 md:pb-8">
            <PullToRefresh>
              {children}
            </PullToRefresh>
          </main>
        </div>
      </div>

      {/* ────────── MOBILE FLOATING PILL DOCK (MD:HIDDEN) ────────── */}
      <div className="fixed bottom-3 inset-x-0 z-40 safe-bottom flex justify-center px-3 pointer-events-none md:hidden">
        <nav className="w-full max-w-md pointer-events-auto pill relative overflow-visible shadow-2xl backdrop-blur-xl bg-[var(--card)]/95 border border-[var(--line)]">
          <div className="flex items-center justify-around h-[64px] px-1 relative z-10">
            {/* 1. Dashboard */}
            <Link
              href="/dashboard/"
              className="flex flex-col items-center gap-0.5 min-w-[50px] transition-all group pt-1"
            >
              <div
                className={cn(
                  "p-1.5 rounded-full transition-all",
                  pathname.replace(/\/$/, "") === "/dashboard"
                    ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "text-[var(--ink3)] group-hover:text-[var(--ink)]"
                )}
              >
                <LayoutGrid className="w-5 h-5" strokeWidth={pathname.replace(/\/$/, "") === "/dashboard" ? 2.5 : 2} />
              </div>
              <span
                className={cn(
                  "text-[9.5px] tracking-wide transition-colors leading-none",
                  pathname.replace(/\/$/, "") === "/dashboard" ? "font-bold text-[var(--accent)]" : "font-medium text-[var(--ink3)]"
                )}
              >
                {t("nav.activity")}
              </span>
            </Link>

            {/* 2. Live Lot */}
            <Link
              href="/gate/active/"
              className="flex flex-col items-center gap-0.5 min-w-[50px] transition-all group pt-1"
            >
              <div
                className={cn(
                  "p-1.5 rounded-full transition-all relative",
                  pathname.includes("/gate/active")
                    ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "text-[var(--ink3)] group-hover:text-[var(--ink)]"
                )}
              >
                <Car className="w-5 h-5" strokeWidth={pathname.includes("/gate/active") ? 2.5 : 2} />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
              </div>
              <span
                className={cn(
                  "text-[9.5px] tracking-wide transition-colors leading-none",
                  pathname.includes("/gate/active") ? "font-bold text-[var(--accent)]" : "font-medium text-[var(--ink3)]"
                )}
              >
                {t("nav.vehicles")}
              </span>
            </Link>

            {/* 3. Center Elevated Action Button (Check-in) */}
            <div className="relative flex justify-center w-[58px] -mt-6">
              <Link
                href="/gate/"
                className="flex items-center justify-center w-[54px] h-[54px] rounded-full transition-transform active:scale-90 bg-gradient-to-br from-[var(--accent)] to-[var(--accent2)] shadow-lg shadow-[var(--accent)]/40 border-2 border-[var(--card)] text-white"
                title={t("nav.entry")}
              >
                <Plus className="w-6 h-6 stroke-[3]" />
              </Link>
            </div>

            {/* 4. Reports */}
            <Link
              href="/reports/"
              className="flex flex-col items-center gap-0.5 min-w-[50px] transition-all group pt-1"
            >
              <div
                className={cn(
                  "p-1.5 rounded-full transition-all",
                  pathname.includes("/reports")
                    ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "text-[var(--ink3)] group-hover:text-[var(--ink)]"
                )}
              >
                <BarChart3 className="w-5 h-5" strokeWidth={pathname.includes("/reports") ? 2.5 : 2} />
              </div>
              <span
                className={cn(
                  "text-[9.5px] tracking-wide transition-colors leading-none",
                  pathname.includes("/reports") ? "font-bold text-[var(--accent)]" : "font-medium text-[var(--ink3)]"
                )}
              >
                {t("nav.analytics")}
              </span>
            </Link>

            {/* 5. More / Menu */}
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen(true)}
              className="flex flex-col items-center gap-0.5 min-w-[50px] transition-all group pt-1"
            >
              <div
                className={cn(
                  "p-1.5 rounded-full transition-all",
                  isMoreMenuOpen
                    ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "text-[var(--ink3)] group-hover:text-[var(--ink)]"
                )}
              >
                <Menu className="w-5 h-5" />
              </div>
              <span
                className={cn(
                  "text-[9.5px] tracking-wide transition-colors leading-none",
                  isMoreMenuOpen ? "font-bold text-[var(--accent)]" : "font-medium text-[var(--ink3)]"
                )}
              >
                More
              </span>
            </button>
          </div>
        </nav>
      </div>

      {/* ────────── MOBILE "MORE" SERVICES BOTTOM SHEET ────────── */}
      {isMoreMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-[var(--card)] border-t border-[var(--line)] rounded-t-[32px] p-5 pb-8 safe-bottom z-10 shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-8 duration-300">
            {/* Handle bar */}
            <div className="w-12 h-1.5 rounded-full bg-[var(--line)] mx-auto mb-4" />

            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--line)]">
              <div>
                <h3 className="text-base font-extrabold text-[var(--ink)]">Vertix Services</h3>
                <p className="text-[11px] text-[var(--ink3)] font-medium">Sant Wamanbhau Parking Terminal</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-[var(--soft)] flex items-center justify-center text-[var(--ink3)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Terminal Switcher Pill */}
            <div className="p-3 bg-[var(--soft)] rounded-2xl border border-[var(--line)] flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[var(--card)] flex items-center justify-center text-[var(--accent)] shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-[var(--ink3)] tracking-wider">Active Lot</span>
                  <p className="text-xs font-bold text-[var(--ink)] truncate">{siteDisplayName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setIsSiteModalOpen(true);
                }}
                className="vx-btn soft !py-1.5 !px-3 text-xs font-bold shrink-0"
              >
                Switch
              </button>
            </div>

            {/* Navigation Grid */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  router.push("/search/");
                }}
                className="p-3.5 bg-[var(--soft)] hover:bg-[var(--soft2)] rounded-2xl border border-[var(--line)] text-left flex items-center gap-3 transition-colors active:scale-95"
              >
                <div className="w-9 h-9 rounded-xl bg-[var(--card)] flex items-center justify-center text-[var(--accent)] shrink-0">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--ink)]">Search Vehicle</div>
                  <div className="text-[10px] text-[var(--ink3)]">Lookup by plate / id</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  router.push("/employees/");
                }}
                className="p-3.5 bg-[var(--soft)] hover:bg-[var(--soft2)] rounded-2xl border border-[var(--line)] text-left flex items-center gap-3 transition-colors active:scale-95"
              >
                <div className="w-9 h-9 rounded-xl bg-[var(--card)] flex items-center justify-center text-emerald-600 shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--ink)]">Staff & Payroll</div>
                  <div className="text-[10px] text-[var(--ink3)]">Shifts, wages, cash</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  router.push("/rates/");
                }}
                className="p-3.5 bg-[var(--soft)] hover:bg-[var(--soft2)] rounded-2xl border border-[var(--line)] text-left flex items-center gap-3 transition-colors active:scale-95"
              >
                <div className="w-9 h-9 rounded-xl bg-[var(--card)] flex items-center justify-center text-blue-600 shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--ink)]">Rate Cards</div>
                  <div className="text-[10px] text-[var(--ink3)]">Hourly & daily pricing</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  router.push("/settings/");
                }}
                className="p-3.5 bg-[var(--soft)] hover:bg-[var(--soft2)] rounded-2xl border border-[var(--line)] text-left flex items-center gap-3 transition-colors active:scale-95"
              >
                <div className="w-9 h-9 rounded-xl bg-[var(--card)] flex items-center justify-center text-purple-600 shrink-0">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--ink)]">Settings</div>
                  <div className="text-[10px] text-[var(--ink3)]">Terminals, alerts, users</div>
                </div>
              </button>
            </div>

            {/* Language Selection Row */}
            <div className="p-3 bg-[var(--soft)] rounded-2xl border border-[var(--line)] mb-4">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--ink)] mb-2">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Language</span>
                </span>
                <span className="text-[10px] text-[var(--ink3)] uppercase">{language}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => {
                      setLanguage(l.code);
                    }}
                    className={cn(
                      "py-2 px-2.5 rounded-xl text-center text-xs font-bold transition-all",
                      language === l.code
                        ? "bg-[var(--btn)] text-[var(--on-ink)] shadow-sm"
                        : "bg-[var(--card)] text-[var(--ink)] hover:bg-[var(--soft2)]"
                    )}
                  >
                    {l.nativeLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Toggle & Handover Actions */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={(e) => toggle(e)}
                className="vx-btn soft !py-3 text-xs font-bold flex items-center justify-center gap-2"
              >
                {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
                <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  setIsSwitchModalOpen(true);
                }}
                className="vx-btn !py-3 text-xs font-bold flex items-center justify-center gap-2 !bg-rose-500/10 !text-rose-600 dark:!text-rose-400 border border-rose-500/20"
              >
                <LogOut className="w-4 h-4" />
                <span>Handover / Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Pill Toast */}
      {toastMessage && (
        <div className="fixed left-1/2 bottom-7 -translate-x-1/2 bg-[var(--ink)] text-[var(--card)] px-5 py-2.5 rounded-full text-xs font-semibold shadow-2xl z-50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      <SiteSwitcherModal isOpen={isSiteModalOpen} onClose={() => setIsSiteModalOpen(false)} />
      <OperatorSwitchModal isOpen={isSwitchModalOpen} onClose={() => setIsSwitchModalOpen(false)} />
    </div>
  );
}
