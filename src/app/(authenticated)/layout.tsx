"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Car,
  BarChart3,
  Activity,
  ParkingCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", icon: Activity, label: "Activity" },
  { href: "/search", icon: ParkingCircle, label: "Parking" },
  { href: "/gate", icon: Plus, label: "Entry", isAction: true },
  { href: "/gate/active", icon: Car, label: "Vehicles" },
  { href: "/reports", icon: BarChart3, label: "Analytics" },
];

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { status, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden relative">
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24">
        {children}
      </main>

      {/* Advanced Liquid Glass SVG Filter Definition */}
      <svg className="w-0 h-0 absolute pointer-events-none">
        <defs>
          <filter id="liquid-glass-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="24" result="blur" />
            <feColorMatrix type="matrix" values="
              1.2 0 0 0 0  
              0 1.2 0 0 0  
              0 0 1.2 0 0  
              0 0 0 1 0" in="blur" result="boost" />
            <feComposite in="SourceGraphic" in2="boost" operator="over" />
          </filter>
        </defs>
      </svg>

      {/* Dock Navigation */}
      <div className="fixed bottom-6 inset-x-0 z-50 safe-bottom flex justify-center px-4 pointer-events-none">
        {/* The Liquid Glass Pill */}
        <nav 
          className="w-full max-w-md pointer-events-auto relative rounded-[40px] overflow-visible"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%)',
            backdropFilter: 'blur(32px) saturate(200%)',
            WebkitBackdropFilter: 'blur(32px) saturate(200%)',
            boxShadow: `
              0 24px 48px -12px rgba(0,0,0,0.15),
              0 8px 16px -4px rgba(0,0,0,0.1),
              inset 0 1px 1px rgba(255,255,255,0.8),
              inset 0 -1px 1px rgba(255,255,255,0.3),
              inset 1px 0 1px rgba(255,255,255,0.4),
              inset -1px 0 1px rgba(255,255,255,0.4)
            `,
            border: '1px solid rgba(255,255,255,0.3)'
          }}
        >
          {/* Internal reflection highlight */}
          <div className="absolute inset-0 rounded-[40px] border border-white/20 pointer-events-none mix-blend-overlay" />
          
          <div className="flex items-center justify-around h-[80px] px-2 relative z-10">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
              
              if (item.isAction) {
                return (
                  <div key={item.href} className="relative flex justify-center w-[72px] -mt-10">
                    <Link
                      href={item.href}
                      className="flex items-center justify-center w-[64px] h-[64px] rounded-full transition-all duration-300 relative group active:scale-95"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,115,59,0.95) 0%, rgba(240,80,17,0.9) 100%)',
                        boxShadow: `
                          0 12px 32px -8px rgba(240,80,17,0.6),
                          inset 0 2px 2px rgba(255,255,255,0.4),
                          inset 0 -2px 4px rgba(0,0,0,0.2)
                        `,
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.2)'
                      }}
                    >
                      <Plus className="w-8 h-8 text-white drop-shadow-md group-hover:rotate-90 transition-transform duration-300" strokeWidth={2.5} />
                    </Link>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center gap-1.5 min-w-[64px] transition-all duration-300 group pt-1"
                >
                  <div className={cn(
                    "p-2.5 rounded-2xl transition-all duration-300 relative overflow-hidden",
                    isActive 
                      ? "bg-white/20 dark:bg-white/10 text-gray-900 dark:text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" 
                      : "text-gray-500/90 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 group-hover:bg-white/10"
                  )}>
                    {isActive && <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />}
                    <item.icon className="w-6 h-6 relative z-10 drop-shadow-sm" strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={cn(
                    "text-[11px] font-bold tracking-wide transition-all duration-300 drop-shadow-sm",
                    isActive ? "text-gray-900 dark:text-white" : "text-gray-500/90 dark:text-gray-400"
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
