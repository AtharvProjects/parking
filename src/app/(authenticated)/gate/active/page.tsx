"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { useSite } from "@/providers/site-provider";
import { sessionsService } from "@/services/sessions.service";
import { sitesService } from "@/services/sites.service";
import { ratesService } from "@/services/rates.service";
import { computeCharges, type BillingConfig, type RateInfo } from "@/core/billing";
import { formatINR, humanizeDuration, formatDateTimeIST } from "@/lib/formatters";
import { VEHICLE_TYPE_CONFIG, PAYMENT_METHOD_CONFIG, UPI_CONFIG } from "@/lib/constants";
import type { ActiveVehicle, PaymentMethod, SessionWithRelations } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { BillReceiptModal } from "@/components/bill-receipt-modal";
import {
  Search,
  Clock,
  AlertTriangle,
  X,
  Check,
  Loader2,
  CreditCard,
  Banknote,
  Smartphone,
  Printer,
  Camera as CameraIcon,
  ArrowLeft,
  Building2,
  Car
} from "lucide-react";

export default function ActiveVehiclesPage() {
  const router = useRouter();
  const { employee } = useAuth();
  const { currentSite, currentSiteId, isAdmin } = useSite();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<ActiveVehicle | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [completedSession, setCompletedSession] = useState<SessionWithRelations | null>(null);
  const [viewPhotosVehicle, setViewPhotosVehicle] = useState<ActiveVehicle | null>(null);

  const querySiteId = currentSiteId === "ALL" ? "" : currentSiteId;

  const { data: vehicles, isLoading: isVehiclesLoading } = useQuery({
    queryKey: ["active-vehicles", querySiteId, employee?.company_id],
    queryFn: () => sessionsService.getActiveSessions(querySiteId),
    enabled: !!employee,
    refetchInterval: 20_000,
  });

  const { data: site } = useQuery({
    queryKey: ["site", currentSiteId],
    queryFn: () => (currentSiteId && currentSiteId !== "ALL") ? sitesService.getById(currentSiteId) : Promise.resolve(null),
    enabled: !!currentSiteId && currentSiteId !== "ALL",
    initialData: currentSite || undefined,
  });

  const { data: activeRates } = useQuery({
    queryKey: ["active-rates", currentSiteId],
    queryFn: () => (currentSiteId && currentSiteId !== "ALL") ? ratesService.getActive(currentSiteId) : Promise.resolve([]),
    enabled: !!currentSiteId && currentSiteId !== "ALL",
  });

  const exitMutation = useMutation({
    mutationFn: async ({
      sessionId,
      grossAmount,
      durationMinutes,
    }: {
      sessionId: string;
      grossAmount: number;
      durationMinutes: number;
    }) => {
      return sessionsService.processExit(
        sessionId,
        employee!.id,
        paymentMethod,
        grossAmount,
        durationMinutes
      );
    },
    onSuccess: async (sessionInfo) => {
      queryClient.invalidateQueries({ queryKey: ["active-vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });

      setShowExitDialog(false);
      setSelectedVehicle(null);
      
      try {
        const fullSession = await sessionsService.getSession(sessionInfo.id);
        if (fullSession) {
          setCompletedSession(fullSession);
        }
      } catch (err) {
        console.error("Failed to load receipt details:", err);
      }
    },
  });

  const filtered = (vehicles || []).filter(
    (v) =>
      v.vehicle_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.driver_number.includes(searchQuery)
  );

  const calculateBilling = (vehicle: ActiveVehicle) => {
    const rate = activeRates?.find((r) => r.vehicle_type === vehicle.vehicle_type);
    const rateInfo: RateInfo = {
      hourlyRate: rate ? rate.hourly_rate : 5000,
      dailyRate: rate ? rate.daily_rate : 20000,
    };

    const config: BillingConfig = {
      gracePeriodMinutes: site?.grace_period_minutes ?? 15,
      roundingIntervalMin: site?.rounding_interval_min ?? 30,
      dayRateSwitchoverHrs: site?.day_rate_switchover_hrs ?? 12,
    };

    return computeCharges(new Date(vehicle.entry_at), new Date(), rateInfo, config);
  };


  const handleInitiateExit = (vehicle: ActiveVehicle) => {
    setSelectedVehicle(vehicle);
    setPaymentMethod("CASH");
    setShowExitDialog(true);
    exitMutation.reset();
  };

  const billingResult = selectedVehicle ? calculateBilling(selectedVehicle) : null;

  return (
    <div className="p-4 md:p-6 pb-36 max-w-2xl mx-auto space-y-5 font-sans">
      
      {/* ────────── TOP BAR WITH BACK BUTTON & SITE CONTEXT ────────── */}
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
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">Active Vehicles</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3 text-primary" />
              <span>{currentSiteId === "ALL" ? "All Sites (Combined)" : (site?.name || "Terminal")}</span>
            </p>
          </div>
        </div>

        <div className="px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold">
          {vehicles?.length || 0} Parked
        </div>
      </div>

      {/* ────────── SEARCH BAR ────────── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by vehicle number or mobile..."
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-input bg-card text-xs font-mono font-medium focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/70 shadow-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ────────── VEHICLES LIST ────────── */}
      {isVehiclesLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground font-medium">Loading parked vehicles...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border/80 rounded-3xl p-6 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto mb-3">
            <Car className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-foreground mb-1">
            {searchQuery ? "No matching vehicles" : "No vehicles parked"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            {searchQuery ? "Check the search term or try searching another site." : "The parking lot is currently empty for this site."}
          </p>
          <button
            type="button"
            onClick={() => router.push("/gate")}
            className="mt-4 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/20 hover:opacity-95 transition-opacity"
          >
            + Register New Vehicle
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((vehicle) => {
            const config = VEHICLE_TYPE_CONFIG[vehicle.vehicle_type];
            return (
              <div
                key={vehicle.id}
                className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm hover:border-primary/40 transition-all flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-xl shrink-0">
                    {config?.icon || "🚗"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-mono font-black text-sm text-foreground tracking-wide truncate">
                        {vehicle.vehicle_number}
                      </h4>
                      {vehicle.is_overstaying && (
                        <span className="px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold shrink-0 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> Overstay
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      <span>{config?.label || vehicle.vehicle_type}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        {humanizeDuration(vehicle.elapsed_minutes)}
                      </span>
                    </div>
                    {vehicle.notes && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        📍 {vehicle.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {vehicle.vehicle_photos && (
                    <button
                      type="button"
                      onClick={() => setViewPhotosVehicle(vehicle)}
                      className="w-9 h-9 rounded-xl bg-muted/80 hover:bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      title="View Photos"
                    >
                      <CameraIcon className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleInitiateExit(vehicle)}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-primary to-orange-600 text-white font-bold text-xs shadow-md shadow-primary/20 hover:opacity-95 transition-all active:scale-95"
                  >
                    Check Out
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ────────── EXIT / CHECKOUT DIALOG ────────── */}
      {showExitDialog && selectedVehicle && billingResult && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowExitDialog(false)} />
          
          <div className="relative w-full max-w-md bg-card border border-border rounded-t-[32px] sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] z-10 overflow-hidden animate-in slide-in-from-bottom-6 duration-300">
            
            {/* Header */}
            <div className="p-5 pb-3 border-b border-border/80 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-black text-foreground">Vehicle Check-Out & Bill</h2>
                <p className="text-xs font-mono font-bold text-primary mt-0.5">
                  {selectedVehicle.vehicle_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExitDialog(false)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {exitMutation.isError && (
              <div className="p-3 mx-4 mt-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold">
                {(exitMutation.error as any)?.message || "Failed to complete exit. Vehicle might have already been exited."}
              </div>
            )}

            {/* Content */}
            <div className="p-4 space-y-4 overflow-y-auto pb-8">
              
              {/* Summary Card */}
              <div className="bg-muted/40 border border-border rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entry Time</span>
                  <span className="font-semibold text-foreground">{formatDateTimeIST(selectedVehicle.entry_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parked Duration</span>
                  <span className="font-bold text-foreground">{humanizeDuration(billingResult.rawMinutes)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rate Category</span>
                  <span className="font-semibold text-foreground">
                    {VEHICLE_TYPE_CONFIG[selectedVehicle.vehicle_type]?.label || selectedVehicle.vehicle_type}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border/80 text-sm font-bold">
                  <span className="text-foreground">Total Billable Amount</span>
                  <span className="text-lg font-black text-primary">{formatINR(billingResult.grossAmount)}</span>
                </div>
              </div>

              {/* Payment Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground block">
                  Select Payment Method *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CASH")}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1 text-center",
                      paymentMethod === "CASH"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm"
                        : "border-border bg-muted/40 text-muted-foreground hover:text-foreground font-semibold"
                    )}
                  >
                    <Banknote className="w-5 h-5" />
                    <span className="text-xs">Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("UPI")}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1 text-center",
                      paymentMethod === "UPI"
                        ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shadow-sm"
                        : "border-border bg-muted/40 text-muted-foreground hover:text-foreground font-semibold"
                    )}
                  >
                    <Smartphone className="w-5 h-5" />
                    <span className="text-xs">UPI QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CARD")}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1 text-center",
                      paymentMethod === "CARD"
                        ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold shadow-sm"
                        : "border-border bg-muted/40 text-muted-foreground hover:text-foreground font-semibold"
                    )}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span className="text-xs">Card / POS</span>
                  </button>
                </div>
              </div>

              {/* UPI Dynamic QR Code */}
              {paymentMethod === "UPI" && billingResult.grossAmount > 0 && (
                <div className="bg-card border border-border rounded-2xl p-4 text-center space-y-2">
                  <p className="text-xs font-bold text-foreground">Scan QR with any UPI App</p>
                  <div className="inline-block p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                    <QRCodeSVG
                      value={`upi://pay?pa=${UPI_CONFIG.vpa}&pn=${encodeURIComponent(UPI_CONFIG.payeeName)}&am=${(billingResult.grossAmount / 100).toFixed(2)}&cu=INR`}
                      size={150}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">VPA: {UPI_CONFIG.vpa}</p>
                </div>
              )}

              {/* Confirm Exit Button */}
              <button
                type="button"
                disabled={exitMutation.isPending}
                onClick={() => {
                  exitMutation.mutate({
                    sessionId: selectedVehicle.id,
                    grossAmount: billingResult.grossAmount,
                    durationMinutes: billingResult.rawMinutes,
                  });
                }}
                className="w-full h-13 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-black text-sm tracking-wide shadow-xl shadow-emerald-600/25 hover:opacity-95 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >

                {exitMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Exit...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Confirm Payment & Complete Exit</span>
                  </>
                )}
              </button>

            </div>

          </div>
        </div>
      )}

      {/* ────────── PHOTO PREVIEW MODAL ────────── */}
      {viewPhotosVehicle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-3xl p-5 max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-mono font-bold text-sm text-foreground">
                {viewPhotosVehicle.vehicle_number} Photos
              </h3>
              <button onClick={() => setViewPhotosVehicle(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {viewPhotosVehicle.vehicle_photos?.front && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1 font-bold">Front View</p>
                  <img src={viewPhotosVehicle.vehicle_photos.front} alt="Front" className="w-full h-28 object-cover rounded-xl border" />
                </div>
              )}
              {viewPhotosVehicle.vehicle_photos?.rear && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1 font-bold">Rear View</p>
                  <img src={viewPhotosVehicle.vehicle_photos.rear} alt="Rear" className="w-full h-28 object-cover rounded-xl border" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────── COMPLETED SESSION BILL RECEIPT MODAL ────────── */}
      {completedSession && (
        <BillReceiptModal
          session={completedSession}
          onClose={() => setCompletedSession(null)}
        />
      )}

    </div>
  );
}
