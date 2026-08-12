"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { useSite } from "@/providers/site-provider";
import { sessionsService } from "@/services/sessions.service";
import { VEHICLE_TYPE_CONFIG, VEHICLE_TYPES, BUSINESS_NAME } from "@/lib/constants";
import type { VehicleType } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { generatePdfBill } from "@/lib/pdf-bill";
import { formatDateTimeIST, formatDateIST, formatTimeIST } from "@/lib/formatters";
import { sharePdfNative, downloadPdfNative } from "@/lib/native-share";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import {
  Check,
  Loader2,
  Hash,
  Phone,
  FileText,
  Printer,
  MessageCircle,
  Download,
  Camera as CameraIcon,
  X,
  ArrowLeft,
  Building2,
  ChevronDown
} from "lucide-react";

export default function GateEntryPage() {
  const router = useRouter();
  const { employee } = useAuth();
  const { currentSite, currentSiteId, authorizedSites, switchSite } = useSite();
  const queryClient = useQueryClient();

  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [driverNumber, setDriverNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
  const [rearPhoto, setRearPhoto] = useState<string | null>(null);

  // Concrete active site ID for the entry transaction
  const effectiveSiteId = (currentSiteId && currentSiteId !== "ALL")
    ? currentSiteId
    : (authorizedSites[0]?.id || employee?.site_id || "");

  const activeSite = authorizedSites.find((s) => s.id === effectiveSiteId) || currentSite;

  const entryMutation = useMutation({
    mutationFn: (data: Parameters<typeof sessionsService.createEntry>[0]) =>
      sessionsService.createEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  const resetForm = useCallback(() => {
    setVehicleNumber("");
    setVehicleType(null);
    setDriverNumber("");
    setNotes("");
    setFrontPhoto(null);
    setRearPhoto(null);
    entryMutation.reset();
  }, [entryMutation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleType || !vehicleNumber.trim() || !employee) return;
    if (!effectiveSiteId) {
      alert("Please select an active parking site first.");
      return;
    }

    entryMutation.mutate({
      site_id: effectiveSiteId,
      vehicle_number: vehicleNumber.trim().toUpperCase(),
      vehicle_type: vehicleType,
      driver_number: driverNumber.trim(),
      notes: notes.trim() || undefined,
      vehicle_photos: frontPhoto || rearPhoto ? { front: frontPhoto || undefined, rear: rearPhoto || undefined } : undefined,
      entry_operator_id: employee.id,
    });
  };

  const handlePrintEntryTicket = async () => {
    if (!entryMutation.data) return;
    try {
      const filename = `entry-ticket-${entryMutation.data.vehicle_number}-${entryMutation.data.id.slice(-6)}.pdf`;
      const pdfData = {
        id: entryMutation.data.id,
        vehicleNumber: entryMutation.data.vehicle_number,
        vehicleType: entryMutation.data.vehicle_type,
        driverNumber: entryMutation.data.driver_number || "",
        entryAt: entryMutation.data.entry_at,
        entryOperatorName: employee?.name || "Gate Operator",
        site: activeSite,
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

  const handleShareWhatsApp = async () => {
    if (!entryMutation.data) return;
    const session = entryMutation.data;
    
    if (!session.driver_number) {
      alert("No driver phone number provided for this vehicle.");
      return;
    }

    try {
      const filename = `entry-ticket-${session.vehicle_number}-${session.id.slice(-6)}.pdf`;
      const pdfData = {
        id: session.id,
        vehicleNumber: session.vehicle_number,
        vehicleType: session.vehicle_type,
        driverNumber: session.driver_number,
        entryAt: session.entry_at,
        entryOperatorName: employee?.name || "Gate Operator",
        site: activeSite,
      };

      const brandName = activeSite?.brand_name || activeSite?.name || BUSINESS_NAME;
      const text = `*${brandName}* - Parking Entry Slip\n\nDate: ${formatDateIST(session.entry_at)}\nTime: ${formatTimeIST(session.entry_at)}\nVehicle: ${session.vehicle_number}\nCategory: ${VEHICLE_TYPE_CONFIG[session.vehicle_type as keyof typeof VEHICLE_TYPE_CONFIG]?.label || session.vehicle_type}\nEntry Operator: ${employee?.name || "Staff"}\n\n*Please keep this message for checkout reference.*`;

      if (Capacitor.isNativePlatform()) {
        const base64 = await generatePdfBill(pdfData, "base64", "thermal", "entry");
        await sharePdfNative(base64 as string, filename, text);
      } else {
        await generatePdfBill(pdfData, false, "thermal", "entry");
        window.open(`https://wa.me/91${session.driver_number}?text=${encodeURIComponent(text)}`, "_blank");
      }
    } catch (err) {
      console.error("Error sharing entry ticket:", err);
    }
  };

  const capturePhoto = async (type: 'front' | 'rear') => {
    try {
      const image = await Camera.getPhoto({
        quality: 60,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        width: 800,
      });
      
      const base64Data = `data:image/${image.format};base64,${image.base64String}`;
      if (type === 'front') {
        setFrontPhoto(base64Data);
      } else {
        setRearPhoto(base64Data);
      }
    } catch (error) {
      console.log('User cancelled or error capturing photo:', error);
    }
  };

  // Success state
  if (entryMutation.isSuccess && entryMutation.data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center max-w-md mx-auto">
        <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center mb-5 animate-in zoom-in-75 duration-300">
          <Check className="w-10 h-10 text-emerald-500" strokeWidth={3} />
        </div>
        <h2 className="text-2xl font-black text-foreground mb-1">Vehicle Checked In!</h2>
        <p className="text-sm font-mono font-bold text-primary mb-1">
          {entryMutation.data.vehicle_number} ({VEHICLE_TYPE_CONFIG[entryMutation.data.vehicle_type as keyof typeof VEHICLE_TYPE_CONFIG]?.label})
        </p>
        <p className="text-xs text-muted-foreground mb-1">
          Site: <span className="font-semibold text-foreground">{activeSite?.name || "Main Site"}</span>
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          Timestamp: <span className="font-semibold text-foreground">{formatDateTimeIST(entryMutation.data.entry_at)}</span>
        </p>
        
        <div className="w-full space-y-2.5">
          <button
            type="button"
            onClick={handlePrintEntryTicket}
            className="w-full border-2 border-primary text-primary bg-primary/5 px-6 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/10 transition-all active:scale-95 shadow-sm"
          >
            <Download className="w-4 h-4" />
            Download Thermal Ticket
          </button>

          {entryMutation.data.driver_number && (
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#25D366] text-white text-xs font-bold shadow-md hover:opacity-95 transition-opacity active:scale-95"
            >
              <MessageCircle className="w-4 h-4" />
              Share Ticket on WhatsApp
            </button>
          )}

          <button
            type="button"
            onClick={resetForm}
            className="w-full bg-primary text-white py-3 rounded-2xl text-xs font-bold shadow-lg shadow-primary/25 hover:opacity-95 transition-all active:scale-95"
          >
            Register Next Vehicle
          </button>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-36 max-w-xl mx-auto space-y-5 font-sans">
      
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
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">New Vehicle Entry</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Building2 className="w-3 h-3 text-primary" />
              <span>Location: <strong>{activeSite?.name || "Main Site"}</strong></span>
            </p>
          </div>
        </div>
      </div>

      {entryMutation.isError && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold">
          {(entryMutation.error as any)?.message || "Failed to register vehicle entry. Please check details and retry."}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Vehicle Number */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm space-y-1.5">
          <label className="text-xs font-bold text-foreground block">
            Vehicle Registration Number *
          </label>
          <div className="relative">
            <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
              placeholder="e.g. MH 23 AE 3029"
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-input bg-background text-sm font-mono font-bold focus:outline-none focus:border-primary uppercase tracking-wider text-foreground placeholder:text-muted-foreground/60"
              autoComplete="off"
              autoFocus
              required
            />
          </div>
        </div>

        {/* Vehicle Type */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm space-y-2.5">
          <label className="text-xs font-bold text-foreground block">
            Select Vehicle Category *
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {VEHICLE_TYPES.map((type) => {
              const config = VEHICLE_TYPE_CONFIG[type];
              const selected = vehicleType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setVehicleType(type)}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all text-center",
                    selected
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                      : "border-border/80 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground font-semibold"
                  )}
                >
                  <span className="text-2xl mb-1">{config.icon}</span>
                  <span className="text-xs">{config.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Driver Contact Number */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm space-y-1.5">
          <label className="text-xs font-bold text-foreground block">
            Driver Phone Number (Optional)
          </label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="tel"
              value={driverNumber}
              onChange={(e) => setDriverNumber(e.target.value)}
              placeholder="10-digit Mobile for WhatsApp Ticket"
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-input bg-background text-sm font-mono focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/60"
              autoComplete="off"
              maxLength={10}
            />
          </div>
        </div>

        {/* Notes / Remarks */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm space-y-1.5">
          <label className="text-xs font-bold text-foreground block">
            Notes / Parking Bay (Optional)
          </label>
          <div className="relative">
            <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Slot B-12, Transport trailer..."
              rows={2}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-xs focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/60 resize-none"
            />
          </div>
        </div>

        {/* Vehicle Photo Capture */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm space-y-2.5">
          <label className="text-xs font-bold text-foreground block">
            Vehicle Photos (Optional)
          </label>
          <div className="grid grid-cols-2 gap-3">
            {/* Front Photo */}
            <div>
              {frontPhoto ? (
                <div className="relative rounded-xl overflow-hidden border border-border aspect-video">
                  <img src={frontPhoto} alt="Front" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFrontPhoto(null)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => capturePhoto('front')}
                  className="w-full aspect-video rounded-xl border border-dashed border-border bg-muted/30 hover:bg-muted/60 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CameraIcon className="w-5 h-5" />
                  <span className="text-[11px] font-semibold">Front View</span>
                </button>
              )}
            </div>

            {/* Rear Photo */}
            <div>
              {rearPhoto ? (
                <div className="relative rounded-xl overflow-hidden border border-border aspect-video">
                  <img src={rearPhoto} alt="Rear" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setRearPhoto(null)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => capturePhoto('rear')}
                  className="w-full aspect-video rounded-xl border border-dashed border-border bg-muted/30 hover:bg-muted/60 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CameraIcon className="w-5 h-5" />
                  <span className="text-[11px] font-semibold">Rear View</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!vehicleNumber.trim() || !vehicleType || entryMutation.isPending}
          className="w-full h-14 bg-gradient-to-r from-primary via-orange-600 to-amber-600 text-white rounded-2xl font-black text-sm tracking-wide shadow-xl shadow-primary/25 hover:opacity-95 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {entryMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Saving Entry...</span>
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              <span>Generate Entry Slip</span>
            </>
          )}
        </button>

      </form>

    </div>
  );
}
