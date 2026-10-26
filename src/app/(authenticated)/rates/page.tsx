"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { useSite } from "@/providers/site-provider";
import { ratesService } from "@/services/rates.service";
import { VEHICLE_TYPE_CONFIG, VEHICLE_TYPES, getVehicleTypeLabel } from "@/lib/constants";
import { formatINR, formatDateIST } from "@/lib/formatters";
import type { VehicleType } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { Plus, X, Check, Loader2, CreditCard, History, ArrowLeft, Building2 } from "lucide-react";
import { useBackHandler } from "@/providers/back-button-provider";
import { useLanguage } from "@/providers/language-provider";

export default function RatesPage() {
  const router = useRouter();
  const { employee } = useAuth();
  const { currentSite, currentSiteId } = useSite();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ vehicle_type: "TRAILOR" as VehicleType, hourly_rate: 0, daily_rate: 0 });

  useBackHandler(showForm, () => setShowForm(false), 20);

  const effectiveSiteId = (currentSiteId && currentSiteId !== "ALL") ? currentSiteId : employee?.site_id;

  const { data: rates, isLoading } = useQuery({
    queryKey: ["rate-cards", effectiveSiteId],
    queryFn: () => effectiveSiteId ? ratesService.getAll(effectiveSiteId) : Promise.resolve([]),
    enabled: !!employee,
  });

  const createMutation = useMutation({
    mutationFn: () => ratesService.create(effectiveSiteId || employee!.site_id, {
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
    <div className="p-4 md:p-6 space-y-6 pb-36 font-sans">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/settings/")}
            className="w-9 h-9 rounded-full bg-muted/80 hover:bg-muted border border-border flex items-center justify-center text-foreground transition-colors active:scale-95 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-heading-lg text-foreground">{t("rates.title")}</h1>
            <p className="text-caption">{t("rates.pricingFor")} {currentSite?.name || t("rates.selectedSite")}</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-label hover:opacity-90 transition-base shadow-sm font-bold">
          <Plus className="w-4 h-4" /> {t("rates.newRate")}
        </button>
      </div>

      {/* Active Rates */}
      <div>
        <h2 className="text-label text-foreground mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4" /> {t("rates.currentRates")}</h2>
        {activeRates.length === 0 && !isLoading && (
          <div className="text-center py-8 bg-card border border-border rounded-2xl">
            <p className="text-body-sm text-muted-foreground">{t("rates.noActiveRates")}</p>
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
                    <p className="text-label text-foreground">{getVehicleTypeLabel(rate.vehicle_type, t)}</p>
                    <p className="text-caption">{t("rates.since")} {formatDateIST(rate.effective_from)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-body-sm text-muted-foreground">{t("rates.hourly")}</span>
                    <span className="text-label text-foreground">{formatINR(rate.hourly_rate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body-sm text-muted-foreground">{t("rates.daily")}</span>
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
          <h2 className="text-label text-foreground mb-3 flex items-center gap-2"><History className="w-4 h-4" /> {t("rates.rateHistory")}</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 text-caption font-semibold">{t("rates.type")}</th>
                  <th className="text-left p-3 text-caption font-semibold">{t("rates.hourly")}</th>
                  <th className="text-left p-3 text-caption font-semibold">{t("rates.daily")}</th>
                  <th className="text-left p-3 text-caption font-semibold">{t("rates.period")}</th>
                </tr>
              </thead>
              <tbody>
                {historyRates.slice(0, 20).map((rate) => (
                  <tr key={rate.id} className="border-b border-border last:border-0">
                    <td className="p-3">{VEHICLE_TYPE_CONFIG[rate.vehicle_type]?.icon} {getVehicleTypeLabel(rate.vehicle_type, t)}</td>
                    <td className="p-3">{formatINR(rate.hourly_rate)}</td>
                    <td className="p-3">{formatINR(rate.daily_rate)}</td>
                    <td className="p-3 text-muted-foreground">{formatDateIST(rate.effective_from)} → {rate.effective_to ? formatDateIST(rate.effective_to) : t("rates.now")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-card border border-border rounded-t-[32px] sm:rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden z-10">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
              <h2 className="text-heading-md text-foreground font-bold">{t("rates.newRateCard")}</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="p-6 overflow-y-auto space-y-4 pb-28">
              <div>
                <label className="text-label mb-2 block">{t("rates.vehicleType")}</label>
                <div className="grid grid-cols-3 gap-3">
                  {VEHICLE_TYPES.map((type) => {
                    const config = VEHICLE_TYPE_CONFIG[type];
                    return (
                      <button key={type} type="button" onClick={() => setFormData({ ...formData, vehicle_type: type })}
                        className={cn("flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-base",
                          formData.vehicle_type === type ? "border-primary bg-primary/5" : "border-border")}>
                        <span className="text-2xl">{config.icon}</span>
                        <span className="text-caption font-semibold">{getVehicleTypeLabel(type, t)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-label mb-1.5 block">{t("rates.hourlyRateRs")}</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.hourly_rate === 0 ? "" : (formData.hourly_rate ?? "")}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value === "" ? 0 : Number(e.target.value) })}
                  placeholder="40"
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-label mb-1.5 block">{t("rates.dailyRateRs")}</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.daily_rate === 0 ? "" : (formData.daily_rate ?? "")}
                  onChange={(e) => setFormData({ ...formData, daily_rate: e.target.value === "" ? 0 : Number(e.target.value) })}
                  placeholder="500"
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {createMutation.isError && <p className="text-destructive text-body-sm font-semibold">{(createMutation.error as Error).message}</p>}
              <button type="submit" disabled={createMutation.isPending || !formData.hourly_rate || !formData.daily_rate}
                className="w-full h-13 rounded-2xl bg-primary text-primary-foreground text-label flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-base font-bold shadow-lg shadow-primary/25 mt-2">
                {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> {t("rates.createRateCard")}</>}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

