"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { sessionsService } from "@/services/sessions.service";
import { sitesService } from "@/services/sites.service";
import { ratesService } from "@/services/rates.service";
import { computeCharges, type BillingConfig, type RateInfo } from "@/lib/billing";
import { formatINR, humanizeDuration } from "@/lib/formatters";
import { VEHICLE_TYPE_CONFIG, PAYMENT_METHOD_CONFIG, UPI_CONFIG } from "@/lib/constants";
import type { ActiveVehicle, PaymentMethod, SessionWithRelations } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { BillReceiptModal } from "@/components/bill-receipt-modal";
import { generatePdfBill } from "@/lib/pdf-bill";
import { downloadPdfNative } from "@/lib/native-share";
import { Capacitor } from "@capacitor/core";
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
} from "lucide-react";

export default function ActiveVehiclesPage() {
  const { employee } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<ActiveVehicle | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [completedSession, setCompletedSession] = useState<SessionWithRelations | null>(null);
  const [viewPhotosVehicle, setViewPhotosVehicle] = useState<ActiveVehicle | null>(null);

  const { data: vehicles, isLoading: isVehiclesLoading } = useQuery({
    queryKey: ["active-vehicles", employee?.site_id],
    queryFn: () => sessionsService.getActiveSessions(employee?.site_id),
    enabled: !!employee,
    refetchInterval: 30_000,
  });

  const { data: site } = useQuery({
    queryKey: ["site", employee?.site_id],
    queryFn: () => sitesService.getById(employee!.site_id),
    enabled: !!employee,
  });

  const { data: activeRates } = useQuery({
    queryKey: ["active-rates", employee?.site_id],
    queryFn: () => ratesService.getActive(employee!.site_id),
    enabled: !!employee,
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
      // processExit creates the payment and returns the updated SessionWithRelations
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
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setShowExitDialog(false);
      setSelectedVehicle(null);
      
      // Need to fetch full session with relations to show in receipt correctly
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
      !searchQuery ||
      v.vehicle_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.driver_number && v.driver_number.includes(searchQuery))
  );

  const computeBill = (vehicle: ActiveVehicle) => {
    const entryAt = new Date(vehicle.entry_at);
    const exitAt = new Date();
    
    // Use dynamic config if available, fallback to defaults
    const config: BillingConfig = { 
      gracePeriodMinutes: site?.grace_period_minutes ?? 15, 
      roundingIntervalMin: site?.rounding_interval_min ?? 30, 
      dayRateSwitchoverHrs: site?.day_rate_switchover_hrs ?? 12 
    };

    // Use dynamic rates if available, fallback to defaults
    const dynamicRate = activeRates?.find(r => r.vehicle_type === vehicle.vehicle_type);
    
    let rate: RateInfo;
    if (dynamicRate) {
      rate = { hourlyRate: dynamicRate.hourly_rate, dailyRate: dynamicRate.daily_rate };
    } else {
      const defaultRates: Record<string, RateInfo> = {
        TRAILOR: { hourlyRate: 4000, dailyRate: 50000 },
        BODY_VEHICLE: { hourlyRate: 3000, dailyRate: 40000 },
        EICHER: { hourlyRate: 2000, dailyRate: 30000 },
      };
      rate = defaultRates[vehicle.vehicle_type] || defaultRates.TRAILOR;
    }
    
    return computeCharges(entryAt, exitAt, rate, config);
  };

  const handleExitClick = (vehicle: ActiveVehicle) => {
    setSelectedVehicle(vehicle);
    setPaymentMethod("CASH");
    setShowExitDialog(true);
  };

  const handleConfirmExit = () => {
    if (!selectedVehicle) return;
    const bill = computeBill(selectedVehicle);
    exitMutation.mutate({
      sessionId: selectedVehicle.id,
      grossAmount: bill.grossAmount,
      durationMinutes: bill.rawMinutes,
    });
  };

  const handlePrintEntry = async (vehicle: ActiveVehicle) => {
    try {
      const filename = `entry-ticket-${vehicle.vehicle_number}-${vehicle.id.slice(-6)}.pdf`;
      const pdfData = {
        id: vehicle.id,
        vehicleNumber: vehicle.vehicle_number,
        vehicleType: vehicle.vehicle_type,
        driverNumber: vehicle.driver_number || "",
        entryAt: vehicle.entry_at,
        entryOperatorName: vehicle.entry_operator_name,
        site: site,
      };

      if (Capacitor.isNativePlatform()) {
        const base64 = await generatePdfBill(pdfData, "base64", "thermal", "entry");
        await downloadPdfNative(base64 as string, filename);
      } else {
        await generatePdfBill(pdfData, false, "thermal", "entry");
      }
    } catch (err) {
      console.error("Failed to generate entry bill:", err);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-heading-lg text-foreground">Active Vehicles</h1>
        <p className="text-caption">{filtered.length} vehicle{filtered.length !== 1 ? "s" : ""} currently parked</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by vehicle number or phone..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-input bg-card text-body focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-base"
        />
      </div>

      {/* Loading */}
      {isVehiclesLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      )}

      {/* Empty */}
      {!isVehiclesLoading && filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🅿️</div>
          <h3 className="text-heading-md text-foreground mb-2">No Active Vehicles</h3>
          <p className="text-body-sm text-muted-foreground">
            {searchQuery ? "No vehicles match your search" : "The parking lot is empty"}
          </p>
        </div>
      )}

      {/* Vehicle List */}
      <div className="space-y-3">
        {filtered.map((v) => {
          const config = VEHICLE_TYPE_CONFIG[v.vehicle_type];
          const bill = computeBill(v);
          return (
            <div key={v.id} className="bg-card rounded-2xl p-4 border border-border">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{config?.icon || "🚗"}</span>
                  <div>
                    <p className="text-label font-mono text-foreground">{v.vehicle_number}</p>
                    <p className="text-caption">{config?.label} • {v.entry_operator_name}</p>
                    {v.driver_number && <p className="text-caption">📞 {v.driver_number}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("text-label flex items-center gap-1", v.is_overstaying ? "text-destructive" : "text-foreground")}>
                    <Clock className="w-3.5 h-3.5" />
                    {humanizeDuration(v.elapsed_minutes)}
                  </p>
                  <p className="text-caption font-mono">{formatINR(bill.grossAmount)}</p>
                  {v.is_overstaying && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full mt-1">
                      <AlertTriangle className="w-3 h-3" /> Overstay
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handlePrintEntry(v)}
                  className="w-14 py-2.5 rounded-xl bg-muted text-foreground flex items-center justify-center hover:bg-muted/80 transition-base shrink-0"
                  title="Print Entry Ticket"
                >
                  <Printer className="w-5 h-5" />
                </button>
                {v.vehicle_photos && (v.vehicle_photos.front || v.vehicle_photos.rear) && (
                  <button
                    onClick={() => setViewPhotosVehicle(v)}
                    className="w-14 py-2.5 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100 transition-base shrink-0"
                    title="View Photos"
                  >
                    <CameraIcon className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => handleExitClick(v)}
                  className="flex-1 py-2.5 rounded-xl bg-primary/10 text-primary text-label hover:bg-primary/20 transition-base"
                >
                  Process Exit
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Exit Dialog */}
      {showExitDialog && selectedVehicle && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowExitDialog(false)} />
          <div className="relative bg-card rounded-t-3xl md:rounded-3xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="p-6 pb-2 shrink-0 relative">
              <button
                onClick={() => setShowExitDialog(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-heading-md text-foreground mb-1">Process Exit</h2>
              <p className="text-caption">{selectedVehicle.vehicle_number}</p>
            </div>

            <div className="p-6 pt-2 overflow-y-auto">
              {(() => {
                const bill = computeBill(selectedVehicle);
                const upiString = `upi://pay?pa=${UPI_CONFIG.vpa}&pn=${encodeURIComponent(UPI_CONFIG.payeeName)}&am=${(bill.grossAmount / 100).toFixed(2)}&cu=INR`;

                return (
                  <>
                    <div className="bg-muted rounded-xl p-4 mb-5 space-y-2">
                      <div className="flex justify-between text-body-sm">
                        <span className="text-muted-foreground">Duration</span>
                        <span className="font-medium">{humanizeDuration(bill.rawMinutes)}</span>
                      </div>
                      <div className="flex justify-between text-body-sm">
                        <span className="text-muted-foreground">Breakdown</span>
                        <span className="font-medium">{bill.breakdown}</span>
                      </div>
                      <div className="border-t border-border pt-2 flex justify-between">
                        <span className="text-label">Total</span>
                        <span className="text-heading-md text-primary">{formatINR(bill.grossAmount)}</span>
                      </div>
                    </div>

                    <p className="text-label mb-3">Payment Method</p>
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      {(["CASH", "UPI", "CARD"] as PaymentMethod[]).map((method) => {
                        const config = PAYMENT_METHOD_CONFIG[method];
                        return (
                          <button
                            key={method}
                            onClick={() => setPaymentMethod(method)}
                            className={cn(
                              "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-base",
                              paymentMethod === method
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border hover:border-primary/30"
                            )}
                          >
                            <span className="text-xl">{config.icon}</span>
                            <span className="text-caption font-semibold">{config.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {paymentMethod === "UPI" && bill.grossAmount > 0 && (
                      <div className="flex flex-col items-center justify-center p-4 mb-6 bg-white border border-gray-100 rounded-xl shadow-sm">
                        <p className="text-sm font-semibold text-gray-500 mb-3">Scan to Pay {formatINR(bill.grossAmount)}</p>
                        <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                          <QRCodeSVG value={upiString} size={130} />
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="p-6 pt-4 border-t border-border shrink-0 safe-bottom bg-card rounded-b-3xl">
              <button
                onClick={handleConfirmExit}
                disabled={exitMutation.isPending}
                className="w-full h-14 rounded-2xl bg-primary text-primary-foreground text-label flex items-center justify-center gap-2 hover:opacity-90 transition-base disabled:opacity-50"
              >
                {exitMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Confirm Exit • {formatINR(computeBill(selectedVehicle).grossAmount)}
                  </>
                )}
              </button>

              {exitMutation.isError && (
                <p className="mt-3 text-center text-body-sm text-destructive">
                  {(exitMutation.error as Error).message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bill Receipt Modal */}
      {completedSession && (
        <BillReceiptModal 
          session={completedSession} 
          onClose={() => setCompletedSession(null)} 
        />
      )}

      {/* View Photos Modal */}
      {viewPhotosVehicle && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setViewPhotosVehicle(null)} />
          <div className="relative bg-card rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-heading-md text-foreground">Vehicle Photos</h2>
                <p className="text-caption font-mono">{viewPhotosVehicle.vehicle_number}</p>
              </div>
              <button
                onClick={() => setViewPhotosVehicle(null)}
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              {viewPhotosVehicle.vehicle_photos?.front && (
                <div>
                  <h3 className="text-label text-muted-foreground mb-3">Front View</h3>
                  <div className="rounded-2xl overflow-hidden border border-border">
                    <img src={viewPhotosVehicle.vehicle_photos.front} alt="Front View" className="w-full object-contain" />
                  </div>
                </div>
              )}
              {viewPhotosVehicle.vehicle_photos?.rear && (
                <div>
                  <h3 className="text-label text-muted-foreground mb-3">Rear View</h3>
                  <div className="rounded-2xl overflow-hidden border border-border">
                    <img src={viewPhotosVehicle.vehicle_photos.rear} alt="Rear View" className="w-full object-contain" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
