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
import { useBackHandler } from "@/providers/back-button-provider";
import { useLanguage } from "@/providers/language-provider";
import { AnimatedCount } from "@/components/animated-count";
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
  Car,
  Phone,
  User,
  FileText,
  Image as ImageIcon,
  Plus,
  ChevronRight,
  Download
} from "lucide-react";
import { downloadImageNative } from "@/lib/native-share";

export default function ActiveVehiclesPage() {
  const router = useRouter();
  const { employee } = useAuth();
  const { currentSite, currentSiteId, isAdmin } = useSite();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<ActiveVehicle | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [completedSession, setCompletedSession] = useState<SessionWithRelations | null>(null);
  const [viewPhotosVehicle, setViewPhotosVehicle] = useState<ActiveVehicle | null>(null);

  useBackHandler(showExitDialog, () => { setShowExitDialog(false); setSelectedVehicle(null); }, 20);
  useBackHandler(!!completedSession, () => setCompletedSession(null), 25);
  useBackHandler(!!viewPhotosVehicle, () => setViewPhotosVehicle(null), 15);

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

  const [selectedType, setSelectedType] = useState<string>("ALL");

  const filtered = (vehicles || []).filter((v) => {
    const matchesSearch =
      v.vehicle_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.driver_number.includes(searchQuery) ||
      (v.driver_name && v.driver_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = selectedType === "ALL" || v.vehicle_type === selectedType;
    return matchesSearch && matchesType;
  });

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
    <div className="p-4 md:p-6 pb-36 max-w-4xl mx-auto space-y-5 font-sans">
      
      {/* ────────── TOP BAR WITH BACK BUTTON & SITE CONTEXT ────────── */}
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
            <h1 className="text-xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight">{t.activeVehicles.title}</h1>
            <p className="text-xs text-[var(--ink3)] flex items-center gap-1.5 mt-0.5">
              <Building2 className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>{currentSiteId === "ALL" ? t.nav.allSites : (site?.name || t.dashboard.terminal)}</span>
            </p>
          </div>
        </div>

        <div className="pill flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold text-[var(--ink)] bg-[var(--soft)]">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span>{vehicles?.length || 0} {t.activeVehicles.parked}</span>
        </div>
      </div>

      {/* ────────── SEARCH & CATEGORY FILTER CHIPS ────────── */}
      <div className="flex flex-col sm:flex-row gap-3 rv" style={{ ["--i" as any]: 1 }}>
        <div className="vx-sbox flex-1">
          <Search className="w-4 h-4 text-[var(--ink3)] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.activeVehicles.searchPlaceholder}
            className="w-full text-xs font-mono font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-[var(--ink3)] hover:text-[var(--ink)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="pill flex p-1 bg-[var(--soft)] gap-1 overflow-x-auto hide-scrollbar">
          {[
            { id: "ALL", label: "All" },
            { id: "TWO_WHEELER", label: "2-Wheeler" },
            { id: "FOUR_WHEELER", label: "4-Wheeler" },
            { id: "AUTO", label: "Auto" },
            { id: "BUS", label: "Heavy / Bus" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedType(cat.id)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-full transition-all whitespace-nowrap",
                selectedType === cat.id
                  ? "bg-[var(--card)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--ink3)] hover:text-[var(--ink)]"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ────────── VEHICLES LIST ────────── */}
      {isVehiclesLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
          <p className="text-xs text-[var(--ink3)] font-medium">{t.activeVehicles.loadingParkedVehicles}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 vx-card p-8">
          <div className="w-14 h-14 rounded-2xl bg-[var(--soft)] text-[var(--ink3)] flex items-center justify-center mx-auto mb-3">
            <Car className="w-7 h-7 text-[var(--accent)]" />
          </div>
          <h3 className="text-base font-bold text-[var(--ink)] mb-1">
            {searchQuery ? t("activeVehicles.noMatchingVehicles") : t("activeVehicles.noActiveVehicles")}
          </h3>
          <p className="text-xs text-[var(--ink3)] max-w-xs mx-auto">
            {searchQuery ? t("activeVehicles.checkSearchOrSite") : t("activeVehicles.lotCurrentlyEmpty")}
          </p>
          <button
            type="button"
            onClick={() => router.push("/gate/")}
            className="mt-5 vx-btn accent text-xs"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{t("activeVehicles.registerNewVehicle")}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 rv" style={{ ["--i" as any]: 2 }}>
          {filtered.map((vehicle, idx) => {
            const config = VEHICLE_TYPE_CONFIG[vehicle.vehicle_type];
            return (
              <div
                key={vehicle.id}
                className="vx-card p-4 flex flex-col justify-between gap-3 hover:translate-y-[-2px] transition-transform"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-[var(--soft)] flex items-center justify-center text-xl shrink-0 border border-[var(--line)]">
                      {config?.icon || "🚗"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-mono font-black text-sm sm:text-base text-[var(--ink)] tracking-wide truncate">
                          {vehicle.vehicle_number}
                        </h4>
                        {vehicle.is_overstaying && (
                          <span className="vx-badge vx-down">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>Overstay</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--ink3)] mt-1">
                        <span className="font-semibold text-[var(--ink2)]">{config?.label || vehicle.vehicle_type}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-semibold text-[var(--ink)] font-mono">
                          <Clock className="w-3 h-3 text-[var(--accent)]" />
                          {humanizeDuration(vehicle.elapsed_minutes)}
                        </span>
                      </div>
                      {(vehicle.driver_name || vehicle.driver_number) && (
                        <p className="text-[11px] font-medium text-[var(--ink2)] mt-1 truncate">
                          👤 {vehicle.driver_name ? `${vehicle.driver_name} ` : ""}{vehicle.driver_number ? `(${vehicle.driver_number})` : ""}
                        </p>
                      )}
                      {vehicle.notes && (
                        <p className="text-[10px] text-[var(--ink3)] mt-0.5 truncate">
                          📍 {vehicle.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="vx-stt text-xs">
                      Parked
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-[var(--line)] mt-1">
                  <div className="text-[10.5px] text-[var(--ink3)] font-mono">
                    In: {vehicle.entry_at ? formatDateTimeIST(vehicle.entry_at).split(" ")[1] : "Now"}
                  </div>

                  <div className="flex items-center gap-2">
                    {(() => {
                      const p = typeof vehicle.vehicle_photos === 'string'
                        ? (() => { try { return JSON.parse(vehicle.vehicle_photos); } catch { return null; } })()
                        : vehicle.vehicle_photos;
                      return Boolean(p?.front || p?.rear);
                    })() && (
                      <button
                        type="button"
                        onClick={() => setViewPhotosVehicle(vehicle)}
                        className="w-8 h-8 rounded-full bg-[var(--soft)] hover:bg-[var(--soft2)] border border-[var(--line)] flex items-center justify-center text-[var(--accent)] hover:text-[var(--ink)] transition-colors shadow-sm"
                        title={t.activeVehicles.viewPhotos}
                      >
                        <CameraIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleInitiateExit(vehicle)}
                      className="vx-btn accent !py-1.5 !px-3.5 text-xs font-bold"
                    >
                      <span>{t.activeVehicles.checkOut}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
          
          <div className="relative w-full max-w-md bg-[var(--card)] border border-[var(--line)] rounded-t-[32px] sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] z-10 overflow-hidden animate-in slide-in-from-bottom-6 duration-300">
            
            {/* Header */}
            <div className="p-5 pb-3 border-b border-[var(--line)] flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-extrabold text-[var(--ink)]">{t.activeVehicles.vehicleCheckOutAndBill}</h2>
                <p className="text-xs font-mono font-bold text-[var(--accent)] mt-0.5">
                  {selectedVehicle.vehicle_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExitDialog(false)}
                className="w-8 h-8 rounded-full bg-[var(--soft)] flex items-center justify-center text-[var(--ink3)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {exitMutation.isError && (
              <div className="p-3 mx-4 mt-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold">
                {(exitMutation.error as any)?.message || t.gate.failedCreateEntry}
              </div>
            )}

            {/* Content */}
            <div className="p-4 space-y-4 overflow-y-auto pb-8">
              
              {/* Summary Card */}
              <div className="bg-[var(--soft)] border border-[var(--line)] rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--ink3)]">{t.activeVehicles.entryTimeLabel}</span>
                  <span className="font-semibold text-[var(--ink)]">{formatDateTimeIST(selectedVehicle.entry_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink3)]">{t.activeVehicles.parkedDuration}</span>
                  <span className="font-bold text-[var(--ink)] font-mono">{humanizeDuration(billingResult.rawMinutes)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink3)]">{t.activeVehicles.rateCategory}</span>
                  <span className="font-semibold text-[var(--ink)]">
                    {VEHICLE_TYPE_CONFIG[selectedVehicle.vehicle_type]?.label || selectedVehicle.vehicle_type}
                  </span>
                </div>
                <div className="flex justify-between pt-2.5 border-t border-[var(--line)] text-sm font-bold items-center">
                  <span className="text-[var(--ink)]">{t.activeVehicles.totalBillableAmount}</span>
                  <AnimatedCount
                    value={Math.round(billingResult.grossAmount / 100)}
                    prefix="₹"
                    duration={400}
                    className="text-2xl font-black text-[var(--accent)] font-mono"
                  />
                </div>
              </div>

              {/* Payment Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--ink)] block">
                  {t.activeVehicles.selectPaymentMethodRequired}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CASH")}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1 text-center",
                      paymentMethod === "CASH"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm"
                        : "border-[var(--line)] bg-[var(--soft)] text-[var(--ink3)] hover:text-[var(--ink)] font-semibold"
                    )}
                  >
                    <Banknote className="w-5 h-5" />
                    <span className="text-xs">{t.activeVehicles.cashMode}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("UPI")}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1 text-center",
                      paymentMethod === "UPI"
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] font-bold shadow-sm"
                        : "border-[var(--line)] bg-[var(--soft)] text-[var(--ink3)] hover:text-[var(--ink)] font-semibold"
                    )}
                  >
                    <Smartphone className="w-5 h-5" />
                    <span className="text-xs">{t.activeVehicles.upiQrMode}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CARD")}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1 text-center",
                      paymentMethod === "CARD"
                        ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold shadow-sm"
                        : "border-[var(--line)] bg-[var(--soft)] text-[var(--ink3)] hover:text-[var(--ink)] font-semibold"
                    )}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span className="text-xs">{t.activeVehicles.cardPosMode}</span>
                  </button>
                </div>
              </div>

              {/* UPI Dynamic QR Code */}
              {paymentMethod === "UPI" && billingResult.grossAmount > 0 && (
                <div className="bg-[var(--card)] border border-[var(--line)] rounded-2xl p-4 text-center space-y-2">
                  <p className="text-xs font-bold text-[var(--ink)]">{t.activeVehicles.scanUpiQr}</p>
                  <div className="inline-block p-3.5 bg-white rounded-2xl shadow-sm border border-slate-100">
                    <QRCodeSVG
                      value={`upi://pay?pa=${UPI_CONFIG.vpa}&pn=${encodeURIComponent(UPI_CONFIG.payeeName)}&am=${(billingResult.grossAmount / 100).toFixed(2)}&cu=INR`}
                      size={150}
                    />
                  </div>
                  <p className="text-[10px] text-[var(--ink3)] font-mono">VPA: {UPI_CONFIG.vpa}</p>
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
                className="w-full vx-btn accent !py-3.5 !rounded-2xl text-xs font-bold shadow-lg"
              >
                {exitMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Exit...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Confirm Vehicle Exit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────── PHOTO PREVIEW MODAL ────────── */}
      {viewPhotosVehicle && (
        <div 
          onClick={() => setViewPhotosVehicle(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl"
          >
            <div className="flex justify-between items-center pb-2 border-b border-border/80">
              <div>
                <h3 className="font-mono font-black text-base text-primary">
                  {viewPhotosVehicle.vehicle_number}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {t.gate.timestamp}: {formatDateTimeIST(viewPhotosVehicle.entry_at)}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setViewPhotosVehicle(null)} 
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {(() => {
              const photos: { front?: string; rear?: string } | null = typeof viewPhotosVehicle.vehicle_photos === 'string'
                ? (() => { try { return JSON.parse(viewPhotosVehicle.vehicle_photos as string); } catch { return null; } })()
                : (viewPhotosVehicle.vehicle_photos as { front?: string; rear?: string } | null);

              if (!photos?.front && !photos?.rear) {
                return (
                  <div className="py-8 text-center text-xs text-muted-foreground font-semibold">
                    No photo record found for this session.
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
                  {photos.front && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-foreground font-bold">{t.activeVehicles.frontView}</span>
                        <span className="text-[10px] text-primary font-semibold">{t.activeVehicles.entryProof}</span>
                      </div>
                      <div className="rounded-2xl overflow-hidden border border-border bg-black/20 aspect-video flex items-center justify-center">
                        <img 
                          src={photos.front} 
                          alt={t.activeVehicles.frontView} 
                          className="w-full h-full object-contain" 
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadImageNative(photos.front!, `${viewPhotosVehicle.vehicle_number}-front.jpg`)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[var(--soft)] hover:bg-[var(--soft2)] text-[var(--ink)] text-xs font-bold border border-[var(--line)] shadow-xs transition-colors active:scale-98 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
                        <span>Download Front Photo</span>
                      </button>
                    </div>
                  )}
                  {photos.rear && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-foreground font-bold">{t.activeVehicles.rearView}</span>
                        <span className="text-[10px] text-primary font-semibold">{t.activeVehicles.entryProof}</span>
                      </div>
                      <div className="rounded-2xl overflow-hidden border border-border bg-black/20 aspect-video flex items-center justify-center">
                        <img 
                          src={photos.rear} 
                          alt={t.activeVehicles.rearView} 
                          className="w-full h-full object-contain" 
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadImageNative(photos.rear!, `${viewPhotosVehicle.vehicle_number}-rear.jpg`)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[var(--soft)] hover:bg-[var(--soft2)] text-[var(--ink)] text-xs font-bold border border-[var(--line)] shadow-xs transition-colors active:scale-98 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
                        <span>Download Rear Photo</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
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
