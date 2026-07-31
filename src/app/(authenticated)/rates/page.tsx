"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { ratesService } from "@/services/rates.service";
import { VEHICLE_TYPE_CONFIG, VEHICLE_TYPES } from "@/lib/constants";
import { formatINR, formatDateIST } from "@/lib/formatters";
import type { VehicleType } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { Plus, X, Check, Loader2, CreditCard, History } from "lucide-react";

export default function RatesPage() {
  const { employee } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ vehicle_type: "TRAILOR" as VehicleType, hourly_rate: 0, daily_rate: 0 });

  const { data: rates, isLoading } = useQuery({
    queryKey: ["rate-cards", employee?.site_id],
    queryFn: () => ratesService.getAll(employee?.site_id),
    enabled: !!employee,
  });

  const createMutation = useMutation({
    mutationFn: () => ratesService.create(employee!.site_id, {
      vehicle_type: formData.vehicle_type,
      hourly_rate: Math.round(formData.hourly_rate * 100),
      daily_rate: Math.round(formData.daily_rate * 100),
    }, employee!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rate-cards"] });
      setShowForm(false);
      setFormData({ vehicle_type: "TRAILOR", hourly_rate: 0, daily_rate: 0 });
    },
  });

  const activeRates = (rates || []).filter(r => !r.effective_to);
  const historyRates = (rates || []).filter(r => r.effective_to);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-lg text-foreground">Rate Cards</h1>
          <p className="text-caption">Manage pricing for vehicle types</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-label hover:opacity-90 transition-base">
          <Plus className="w-4 h-4" /> New Rate
        </button>
      </div>

      {isLoading && <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>}

      {/* Active Rates */}
      <div>
        <h2 className="text-label text-foreground mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Current Rates</h2>
        {activeRates.length === 0 && !isLoading && (
          <div className="text-center py-8 bg-card border border-border rounded-2xl">
            <p className="text-body-sm text-muted-foreground">No active rates configured</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {activeRates.map((rate) => {
            const config = VEHICLE_TYPE_CONFIG[rate.vehicle_type];
            return (
              <div key={rate.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{config?.icon}</span>
                  <div>
                    <p className="text-label text-foreground">{config?.label}</p>
                    <p className="text-caption">Since {formatDateIST(rate.effective_from)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-body-sm text-muted-foreground">Hourly</span>
                    <span className="text-label text-foreground">{formatINR(rate.hourly_rate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body-sm text-muted-foreground">Daily</span>
                    <span className="text-label text-foreground">{formatINR(rate.daily_rate)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rate History */}
      {historyRates.length > 0 && (
        <div>
          <h2 className="text-label text-foreground mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Rate History</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 text-caption font-semibold">Type</th>
                  <th className="text-left p-3 text-caption font-semibold">Hourly</th>
                  <th className="text-left p-3 text-caption font-semibold">Daily</th>
                  <th className="text-left p-3 text-caption font-semibold">Period</th>
                </tr>
              </thead>
              <tbody>
                {historyRates.slice(0, 20).map((rate) => (
                  <tr key={rate.id} className="border-b border-border last:border-0">
                    <td className="p-3">{VEHICLE_TYPE_CONFIG[rate.vehicle_type]?.icon} {VEHICLE_TYPE_CONFIG[rate.vehicle_type]?.label}</td>
                    <td className="p-3">{formatINR(rate.hourly_rate)}</td>
                    <td className="p-3">{formatINR(rate.daily_rate)}</td>
                    <td className="p-3 text-muted-foreground">{formatDateIST(rate.effective_from)} → {rate.effective_to ? formatDateIST(rate.effective_to) : "Now"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-card rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 safe-bottom">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            <h2 className="text-heading-md text-foreground mb-5">New Rate Card</h2>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div>
                <label className="text-label mb-3 block">Vehicle Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {VEHICLE_TYPES.map((type) => {
                    const config = VEHICLE_TYPE_CONFIG[type];
                    return (
                      <button key={type} type="button" onClick={() => setFormData({ ...formData, vehicle_type: type })}
                        className={cn("flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-base",
                          formData.vehicle_type === type ? "border-primary bg-primary/5" : "border-border")}>
                        <span className="text-2xl">{config.icon}</span>
                        <span className="text-caption font-semibold">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-label mb-2 block">Hourly Rate (₹)</label>
                <input type="number" min="0" step="1" value={formData.hourly_rate || ""} onChange={(e) => setFormData({ ...formData, hourly_rate: Number(e.target.value) })}
                  placeholder="40" className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-label mb-2 block">Daily Rate (₹)</label>
                <input type="number" min="0" step="1" value={formData.daily_rate || ""} onChange={(e) => setFormData({ ...formData, daily_rate: Number(e.target.value) })}
                  placeholder="500" className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              {createMutation.isError && <p className="text-destructive text-body-sm">{(createMutation.error as Error).message}</p>}
              <button type="submit" disabled={createMutation.isPending || !formData.hourly_rate || !formData.daily_rate}
                className="w-full h-13 rounded-2xl bg-primary text-primary-foreground text-label flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-base">
                {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Create Rate Card</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
