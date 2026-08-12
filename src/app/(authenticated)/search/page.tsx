"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { sessionsService } from "@/services/sessions.service";
import { useSite } from "@/providers/site-provider";
import { VEHICLE_TYPE_CONFIG, SESSION_STATUS_CONFIG } from "@/lib/constants";
import { formatDateTimeIST, formatINR, humanizeDuration } from "@/lib/formatters";
import { BillReceiptModal } from "@/components/bill-receipt-modal";
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
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedReceiptSession, setSelectedReceiptSession] = useState<any | null>(null);

  const querySiteId = currentSiteId === "ALL" ? "" : currentSiteId;

  const { data: results, isLoading, isFetching } = useQuery({
    queryKey: ["search", debouncedQuery, querySiteId],
    queryFn: () => sessionsService.searchSessions(debouncedQuery, querySiteId),
    enabled: debouncedQuery.length >= 2,
    refetchInterval: 30_000,
  });

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 pb-36 font-sans">
      
      {/* ────────── TOP BAR WITH BACK BUTTON & SITE INFO ────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="w-9 h-9 rounded-full bg-muted/80 hover:bg-muted border border-border flex items-center justify-center text-foreground transition-colors active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">Vehicle History & Search</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3 text-primary" />
              <span>Scope: <strong>{currentSiteId === "ALL" ? "All Sites" : (currentSite?.name || "Terminal")}</strong></span>
            </p>
          </div>
        </div>
      </div>

      {/* ────────── SEARCH INPUT ────────── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by vehicle no, mobile, receipt, date..."
          autoFocus
          className="w-full h-12 pl-10 pr-10 rounded-2xl border border-input bg-card text-xs font-mono font-medium focus:outline-none focus:border-primary text-foreground uppercase tracking-wider placeholder:normal-case placeholder:font-sans placeholder:text-muted-foreground/70 shadow-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {isFetching && (
          <div className="absolute right-9 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* ────────── RESULTS STATE ────────── */}
      {query.length < 2 ? (
        <div className="text-center py-16 bg-card border border-border/80 rounded-3xl p-6 shadow-sm text-xs text-muted-foreground">
          <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="font-semibold text-foreground">Search Vehicle Register</p>
          <p className="mt-1">Enter at least 2 characters to search across active and historical exited vehicles.</p>
        </div>
      ) : results?.length === 0 && !isLoading ? (
        <div className="text-center py-16 bg-card border border-border/80 rounded-3xl p-6 shadow-sm">
          <div className="text-3xl mb-2">🔍</div>
          <h3 className="text-sm font-bold text-foreground mb-1">No vehicle records found</h3>
          <p className="text-xs text-muted-foreground">
            No matching vehicle number, receipt, or phone found in {currentSiteId === "ALL" ? "enterprise records" : currentSite?.name || "this site"}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-[11px] font-bold text-muted-foreground px-1 flex justify-between">
            <span>Matches Found ({results?.length || 0})</span>
            <span>Tap card for details</span>
          </div>

          {results?.map((s: any) => {
            const isCompleted = s.status === "COMPLETED";
            const vConfig = VEHICLE_TYPE_CONFIG[s.vehicle_type as keyof typeof VEHICLE_TYPE_CONFIG];
            const sConfig = SESSION_STATUS_CONFIG[s.status as keyof typeof SESSION_STATUS_CONFIG];
            const isExpanded = expandedId === s.id;
            const payment = Array.isArray(s.payment) ? s.payment[0] : s.payment;
            
            return (
              <div 
                key={s.id} 
                className="bg-card border border-border/80 rounded-2xl p-4 flex flex-col gap-3.5 cursor-pointer hover:border-primary/40 transition-all shadow-sm"
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl shrink-0">
                      {vConfig?.icon || "🚗"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-mono font-black text-sm text-foreground tracking-wide truncate">
                          {s.vehicle_number}
                        </h3>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0",
                          isCompleted ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600"
                        )}>
                          {sConfig?.label || s.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                        <span>{s.site_name || "Main Site"}</span>
                        <span>•</span>
                        <span>In: {formatDateTimeIST(s.entry_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-black text-sm text-primary">
                      {payment?.amount ? formatINR(payment.amount) : (s.gross_amount ? formatINR(s.gross_amount) : "-")}
                    </div>
                    {payment?.method && (
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                        {payment.method}
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="pt-3 border-t border-border/80 space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-xl">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Entry Operator</span>
                        <span className="font-bold text-foreground">{s.entry_operator_name || "-"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Exit Operator</span>
                        <span className="font-bold text-foreground">{s.exit_operator_name || "-"}</span>
                      </div>
                      {s.exit_at && (
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Exit Time</span>
                          <span className="font-semibold text-foreground">{formatDateTimeIST(s.exit_at)}</span>
                        </div>
                      )}
                      {s.duration_minutes && (
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Total Duration</span>
                          <span className="font-bold text-primary">{humanizeDuration(s.duration_minutes)}</span>
                        </div>
                      )}
                      {payment?.receipt_number && (
                        <div className="col-span-2">
                          <span className="text-[10px] text-muted-foreground block">Receipt Number</span>
                          <span className="font-mono font-bold text-foreground">{payment.receipt_number}</span>
                        </div>
                      )}
                      {s.driver_number && (
                        <div className="col-span-2">
                          <span className="text-[10px] text-muted-foreground block">Driver Phone</span>
                          <span className="font-mono font-semibold text-foreground">📞 {s.driver_number}</span>
                        </div>
                      )}
                    </div>

                    {s.vehicle_photos && (
                      <div className="grid grid-cols-2 gap-2">
                        {s.vehicle_photos.front && (
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1 font-bold">Front View</p>
                            <img src={s.vehicle_photos.front} alt="Front" className="w-full h-28 object-cover rounded-xl border" />
                          </div>
                        )}
                        {s.vehicle_photos.rear && (
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1 font-bold">Rear View</p>
                            <img src={s.vehicle_photos.rear} alt="Rear" className="w-full h-28 object-cover rounded-xl border" />
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
                      className="w-full py-2.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>View & Print Official Receipt</span>
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
