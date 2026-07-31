"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { sessionsService } from "@/services/sessions.service";
import { VEHICLE_TYPE_CONFIG, SESSION_STATUS_CONFIG } from "@/lib/constants";
import { formatDateTimeIST, formatINR } from "@/lib/formatters";
import { Search, Loader2, FileText, CheckCircle2 } from "lucide-react";
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
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 500);

  const { data: results, isLoading, isFetching } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => sessionsService.searchSessions(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-heading-lg text-foreground">Global Search</h1>
        <p className="text-caption">Search by vehicle number or driver phone</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. MH14 or 98765..."
          autoFocus
          className="w-full h-14 pl-12 pr-12 rounded-2xl border-2 border-input bg-card text-body focus:outline-none focus:border-primary transition-base font-mono uppercase"
        />
        {isFetching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}
      </div>

      {query.length < 2 ? (
        <div className="text-center py-16 text-muted-foreground text-body-sm">
          Type at least 2 characters to search
        </div>
      ) : results?.length === 0 && !isLoading ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="text-heading-md text-foreground mb-1">No results found</h3>
          <p className="text-body-sm text-muted-foreground">Try a different search term</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results?.map((s: any) => {
            const isCompleted = s.status === "COMPLETED";
            const vConfig = VEHICLE_TYPE_CONFIG[s.vehicle_type as keyof typeof VEHICLE_TYPE_CONFIG];
            const sConfig = SESSION_STATUS_CONFIG[s.status as keyof typeof SESSION_STATUS_CONFIG];
            return (
              <div key={s.id} className="bg-card border border-border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="text-3xl bg-muted p-2 rounded-xl">{vConfig?.icon}</div>
                  <div>
                    <h3 className="text-label font-mono text-foreground mb-1">{s.vehicle_number}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
                      <span>{vConfig?.label}</span>
                      <span>Entry: {formatDateTimeIST(s.entry_at)}</span>
                      {s.driver_number && <span>📞 {s.driver_number}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between md:flex-col md:items-end gap-2 border-t md:border-0 border-border pt-3 md:pt-0">
                  <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold", sConfig?.color)}>
                    {sConfig?.label || s.status}
                  </span>
                  {isCompleted && s.gross_amount && (
                    <span className="text-label text-foreground">{formatINR(s.gross_amount)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
