"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { sessionsService } from "@/services/sessions.service";
import { sitesService } from "@/services/sites.service";
import { VEHICLE_TYPE_CONFIG, VEHICLE_TYPES, BUSINESS_NAME } from "@/lib/constants";
import type { VehicleType } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { generatePdfBill } from "@/lib/pdf-bill";
import { formatDateTimeIST } from "@/lib/formatters";
import { sharePdfNative, downloadPdfNative } from "@/lib/native-share";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Check, Loader2, Hash, Phone, FileText, Printer, MessageCircle, Download, Camera as CameraIcon, X } from "lucide-react";

export default function GateEntryPage() {
  const { employee } = useAuth();
  const queryClient = useQueryClient();
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [driverNumber, setDriverNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
  const [rearPhoto, setRearPhoto] = useState<string | null>(null);

  const { data: site } = useQuery({
    queryKey: ["site", employee?.site_id],
    queryFn: () => sitesService.getById(employee!.site_id),
    enabled: !!employee,
  });

  const entryMutation = useMutation({
    mutationFn: (data: Parameters<typeof sessionsService.createEntry>[0]) =>
      sessionsService.createEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
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

    entryMutation.mutate({
      site_id: employee.site_id,
      vehicle_number: vehicleNumber,
      vehicle_type: vehicleType,
      driver_number: driverNumber,
      notes: notes || undefined,
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

  const handleShareWhatsApp = async () => {
    if (!entryMutation.data) return;
    const session = entryMutation.data;
    
    if (!session.driver_number) {
      alert("No driver phone number provided for this vehicle.");
      return;
    }
    
    try {
      const filename = `entry-ticket-${session.vehicle_number}-${session.id.slice(-6)}.pdf`;
      const text = `*${BUSINESS_NAME}* - Entry Ticket\n\nVehicle: ${session.vehicle_number}\nEntry: ${formatDateTimeIST(session.entry_at)}\n\nApplicable parking charges will be calculated at exit.\nThank you for visiting!`;
      
      const pdfData = {
        id: session.id,
        vehicleNumber: session.vehicle_number,
        vehicleType: session.vehicle_type,
        driverNumber: session.driver_number || "",
        entryAt: session.entry_at,
        entryOperatorName: employee?.name || "Gate Operator",
        site: site,
      };

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
  if (entryMutation.isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center mb-6">
          <Check className="w-10 h-10 text-emerald-500" strokeWidth={3} />
        </div>
        <h2 className="text-heading-lg text-foreground mb-2">Vehicle Registered!</h2>
        <p className="text-body-sm text-muted-foreground mb-2">
          {vehicleNumber.toUpperCase()} ({VEHICLE_TYPE_CONFIG[vehicleType!]?.label})
        </p>
        <p className="text-caption mb-8">
          Entry at {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </p>
        
        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={handlePrintEntryTicket}
            className="w-full bg-primary/10 text-primary px-8 py-3 rounded-2xl text-label flex items-center justify-center gap-2 hover:bg-primary/20 transition-base"
          >
            <Download className="w-5 h-5" />
            Download Ticket
          </button>
          <button
            onClick={handleShareWhatsApp}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#25D366] text-white text-label shadow-sm hover:opacity-90 transition-opacity"
          >
            <MessageCircle className="w-5 h-5" />
            Share on WhatsApp
          </button>
          <button
            onClick={resetForm}
            className="w-full bg-primary text-primary-foreground px-8 py-3 rounded-2xl text-label hover:opacity-90 transition-base"
          >
            Register Next Vehicle
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-heading-lg text-foreground">New Entry</h1>
        <p className="text-caption">Register a vehicle entering the lot</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Vehicle Number */}
        <div>
          <label className="text-label text-foreground mb-2 block">Vehicle Number *</label>
          <div className="relative">
            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
              placeholder="MH 14 AB 1234"
              className="w-full h-13 pl-12 pr-4 rounded-xl border border-input bg-background text-body font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-base uppercase"
              autoComplete="off"
              required
            />
          </div>
        </div>

        {/* Vehicle Type */}
        <div>
          <label className="text-label text-foreground mb-3 block">Vehicle Type *</label>
          <div className="grid grid-cols-3 gap-3">
            {VEHICLE_TYPES.map((type) => {
              const config = VEHICLE_TYPE_CONFIG[type];
              const selected = vehicleType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setVehicleType(type)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-base",
                    selected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:border-primary/30"
                  )}
                >
                  <span className="text-3xl">{config.icon}</span>
                  <span className={cn("text-caption font-semibold", selected ? "text-primary" : "text-foreground")}>
                    {config.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Driver Number */}
        <div>
          <label className="text-label text-foreground mb-2 block">Driver Phone</label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="tel"
              value={driverNumber}
              onChange={(e) => setDriverNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="9876543210"
              maxLength={10}
              className="w-full h-13 pl-12 pr-4 rounded-xl border border-input bg-background text-body font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-base"
            />
          </div>
        </div>

        {/* Vehicle Photos */}
        <div>
          <label className="text-label text-foreground mb-3 block">Vehicle Photos (Optional)</label>
          <div className="grid grid-cols-2 gap-3">
            {/* Front Photo */}
            <div className="flex flex-col gap-2">
              {frontPhoto ? (
                <div className="relative rounded-2xl overflow-hidden border-2 border-primary/30 aspect-video bg-black/5">
                  <img src={frontPhoto} alt="Front View" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFrontPhoto(null)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-[10px] text-white font-medium">Front View</div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => capturePhoto('front')}
                  className="flex flex-col items-center justify-center gap-2 aspect-video rounded-2xl border-2 border-dashed border-border bg-card hover:border-primary/50 transition-colors text-muted-foreground hover:text-primary"
                >
                  <CameraIcon className="w-6 h-6" />
                  <span className="text-[11px] font-medium">Capture Front</span>
                </button>
              )}
            </div>

            {/* Rear Photo */}
            <div className="flex flex-col gap-2">
              {rearPhoto ? (
                <div className="relative rounded-2xl overflow-hidden border-2 border-primary/30 aspect-video bg-black/5">
                  <img src={rearPhoto} alt="Rear View" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setRearPhoto(null)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-[10px] text-white font-medium">Rear View</div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => capturePhoto('rear')}
                  className="flex flex-col items-center justify-center gap-2 aspect-video rounded-2xl border-2 border-dashed border-border bg-card hover:border-primary/50 transition-colors text-muted-foreground hover:text-primary"
                >
                  <CameraIcon className="w-6 h-6" />
                  <span className="text-[11px] font-medium">Capture Rear</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-label text-foreground mb-2 block">Notes</label>
          <div className="relative">
            <FileText className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground" />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special notes..."
              rows={2}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-base resize-none"
            />
          </div>
        </div>

        {/* Error */}
        {entryMutation.isError && (
          <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-body-sm font-medium">
            {(entryMutation.error as Error).message}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!vehicleNumber.trim() || !vehicleType || entryMutation.isPending}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground text-label flex items-center justify-center gap-2 transition-base hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {entryMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Check className="w-5 h-5" />
              Register Entry
            </>
          )}
        </button>
      </form>
    </div>
  );
}
