"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { sessionsService } from "@/services/sessions.service";
import { useSite } from "@/providers/site-provider";
import { VEHICLE_TYPE_CONFIG, SESSION_STATUS_CONFIG } from "@/lib/constants";
import { formatDateTimeIST, formatINR, humanizeDuration } from "@/lib/formatters";
import { BillReceiptModal } from "@/components/bill-receipt-modal";
import { useBackHandler } from "@/providers/back-button-provider";
import { useLanguage } from "@/providers/language-provider";
import {
  Search,
  Loader2,
  FileText,
  CheckCircle2,
  ArrowLeft,
  Building2,
  Clock,
  Printer,
  Calendar,
  X,
  UserCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function SearchPage() {
  const router = useRouter();
  const { currentSite, currentSiteId, isAdmin } = useSite();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedReceiptSession, setSelectedReceiptSession] = useState<any | null>(null);

  useBackHandler(!!selectedReceiptSession, () => setSelectedReceiptSession(null), 20);
  useBackHandler(!!expandedId, () => setExpandedId(null), 10);

  const querySiteId = currentSiteId === "ALL" ? "" : currentSiteId;

  const { data: results, isLoading, isFetching } = useQuery({
    queryKey: ["search", debouncedQuery, querySiteId],
    queryFn: () => sessionsService.searchSessions(debouncedQuery, querySiteId),
    enabled: debouncedQuery.length >= 2,
    refetchInterval: 30_000,
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 pb-36 font-sans">
      
      {/* ────────── TOP BAR WITH BACK BUTTON & SITE INFO ────────── */}
      <div className="flex items-center justify-between rv" style={{ ["--i" as any]: 0 }}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/")}
            className="w-10 h-10 rounded-full bg-[var(--soft)] hover:bg-[var(--soft2)] border border-[var(--line)] flex items-center justify-center text-[var(--ink)] transition-colors active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight">{t.search.historyTitle}</h1>
            <p className="text-xs text-[var(--ink3)] flex items-center gap-1.5 mt-0.5">
              <Building2 className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>{t.search.scope}: <strong className="text-[var(--ink)]">{currentSiteId === "ALL" ? t.search.allSites : (currentSite?.name || t.dashboard.terminal)}</strong></span>
            </p>
          </div>
        </div>
      </div>

      {/* ────────── SEARCH INPUT ────────── */}
      <div className="relative rv" style={{ ["--i" as any]: 1 }}>
        <div className="vx-sbox !p-3 !rounded-2xl">
          <Search className="w-4 h-4 text-[var(--ink3)] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search.searchDetailedPlaceholder}
            autoFocus
            className="w-full text-xs sm:text-sm font-mono font-medium text-[var(--ink)] tracking-wider"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-[var(--ink3)] hover:text-[var(--ink)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {isFetching && (
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
          )}
        </div>
      </div>

      {/* ────────── RESULTS STATE ────────── */}
      {query.length < 2 ? (
        <div className="text-center py-16 vx-card p-8 text-xs text-[var(--ink3)] rv" style={{ ["--i" as any]: 2 }}>
          <Search className="w-10 h-10 mx-auto mb-3 text-[var(--accent)]" />
          <p className="font-bold text-sm text-[var(--ink)]">{t.search.searchRegister}</p>
          <p className="mt-1 max-w-sm mx-auto">{t.search.searchRegisterDesc}</p>
        </div>
      ) : results?.length === 0 && !isLoading ? (
        <div className="text-center py-16 vx-card p-8 rv" style={{ ["--i" as any]: 2 }}>
          <div className="text-3xl mb-2">🔍</div>
          <h3 className="text-base font-bold text-[var(--ink)] mb-1">{t.search.noRecordsFound}</h3>
          <p className="text-xs text-[var(--ink3)]">
            {t.search.noRecordsDesc} ({currentSiteId === "ALL" ? t.search.allSites : currentSite?.name || t.dashboard.terminal})
          </p>
        </div>
      ) : (
        <div className="space-y-3 rv" style={{ ["--i" as any]: 2 }}>
          <div className="text-xs font-bold text-[var(--ink3)] px-1 flex justify-between">
            <span>{t.search.matchesFound} ({results?.length || 0})</span>
            <span>{t.search.tapCardForDetails}</span>
          </div>

          {results?.map((s: any, idx: number) => {
            const isCompleted = s.status === "COMPLETED";
            const vConfig = VEHICLE_TYPE_CONFIG[s.vehicle_type as keyof typeof VEHICLE_TYPE_CONFIG];
            const sConfig = SESSION_STATUS_CONFIG[s.status as keyof typeof SESSION_STATUS_CONFIG];
            const isExpanded = expandedId === s.id;
            const payment = Array.isArray(s.payment) ? s.payment[0] : s.payment;
            
            return (
              <div 
                key={s.id} 
                className="vx-card p-4 flex flex-col gap-3.5 cursor-pointer hover:translate-y-[-2px] transition-transform"
                style={{ animationDelay: `${idx * 40}ms` }}
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-[var(--soft)] border border-[var(--line)] flex items-center justify-center text-xl shrink-0">
                      {vConfig?.icon || "🚗"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-mono font-black text-sm sm:text-base text-[var(--ink)] tracking-wide truncate">
                          {s.vehicle_number}
                        </h3>
                        <span className={cn(
                          "vx-badge",
                          isCompleted ? "vx-up" : "vx-down"
                        )}>
                          {sConfig?.label || s.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--ink3)] mt-0.5">
                        <span className="font-medium text-[var(--ink2)]">{s.site_name || t.gate.mainSite}</span>
                        <span>•</span>
                        <span>{t.search.entryTime}: {formatDateTimeIST(s.entry_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-black text-sm sm:text-base text-[var(--accent)]">
                      {payment?.amount ? formatINR(payment.amount) : (s.gross_amount ? formatINR(s.gross_amount) : "-")}
                    </div>
                    {payment?.method && (
                      <span className="text-[10px] text-[var(--ink3)] font-semibold uppercase">
                        {payment.method}
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="pt-3 border-t border-[var(--line)] space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 bg-[var(--soft)] p-3.5 rounded-2xl border border-[var(--line)]">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">{t.search.entryOperator}</span>
                        <span className="font-bold text-foreground">{s.entry_operator_name || "-"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">{t.search.exitOperator}</span>
                        <span className="font-bold text-foreground">{s.exit_operator_name || "-"}</span>
                      </div>
                      {s.exit_at && (
                        <div>
                          <span className="text-[10px] text-muted-foreground block">{t.search.exitTime}</span>
                          <span className="font-semibold text-foreground">{formatDateTimeIST(s.exit_at)}</span>
                        </div>
                      )}
                      {s.duration_minutes && (
                        <div>
                          <span className="text-[10px] text-muted-foreground block">{t.search.durationLabel}</span>
                          <span className="font-bold text-primary">{humanizeDuration(s.duration_minutes)}</span>
                        </div>
                      )}
                      {payment?.receipt_number && (
                        <div className="col-span-2">
                          <span className="text-[10px] text-muted-foreground block">{t.search.receiptNumber}</span>
                          <span className="font-mono font-bold text-foreground">{payment.receipt_number}</span>
                        </div>
                      )}
                      {s.driver_name && (
                        <div className="col-span-2">
                          <span className="text-[10px] text-muted-foreground block">{t.gate.driverName}</span>
                          <span className="font-bold text-foreground">👤 {s.driver_name}</span>
                        </div>
                      )}
                      {s.driver_number && (
                        <div className="col-span-2">
                          <span className="text-[10px] text-muted-foreground block">{t.gate.driverPhone}</span>
                          <span className="font-mono font-semibold text-foreground">📞 {s.driver_number}</span>
                        </div>
                      )}
                    </div>

                    {s.vehicle_photos && (
                      <div className="grid grid-cols-2 gap-2">
                        {s.vehicle_photos.front && (
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1 font-bold">{t.search.frontView}</p>
                            <img src={s.vehicle_photos.front} alt={t.search.frontView} className="w-full h-28 object-cover rounded-xl border" />
                          </div>
                        )}
                        {s.vehicle_photos.rear && (
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1 font-bold">{t.search.rearView}</p>
                            <img src={s.vehicle_photos.rear} alt={t.search.rearView} className="w-full h-28 object-cover rounded-xl border" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* View Receipt Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReceiptSession(s);
                      }}
                      className="w-full vx-btn soft !py-2.5 text-xs font-bold"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{t.search.viewPrintReceipt}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ────────── RECEIPT MODAL ────────── */}
      {selectedReceiptSession && (
        <BillReceiptModal
          session={selectedReceiptSession}
          onClose={() => setSelectedReceiptSession(null)}
        />
      )}

    </div>
  );
}
